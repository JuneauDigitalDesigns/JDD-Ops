#!/usr/bin/env node
/**
 * jdd-ops/onboard.js — provisioning orchestrator.
 *
 * Usage:
 *   npm run onboard -- --schema clients/{slug}/site.ts [--dry-run] [--receptionist forwarded|published|declined]
 *
 * Plan-tier behavior (since the 2026-10-12 reprice, EVERY tier includes the AI receptionist;
 * tiers differ by capability, not by whether a receptionist exists):
 *   - starter    → site + 1 Retell agent + 1 JDD-owned Twilio number + 1 Airtable base,
 *                  with web-form leads delivered by email (LEAD_DELIVERY_MODE=email). The only
 *                  provisioning difference from growth is that email vs the 60-second callback.
 *   - growth     → same stack, with outbound callback (LEAD_DELIVERY_MODE=callback).
 *   - enterprise → N sites (N from intake.sites.length); each with its own Retell agent +
 *                  Twilio number; shared master Retell account (= shared minute pool); shared
 *                  Airtable base with a per-site Site column.
 *
 * The one exception is WEB-ONLY: a Starter client who declined the receptionist
 * (receptionistMode === "declined"). That client gets the site and nothing else — no number,
 * no agent, no Airtable — which is exactly the old Starter path. Web-only is not a plan; it is
 * `plan: "starter"` + the declined mode, and it is gated on `isWebOnly`, never on the plan.
 *
 * Intake shape (clients/{slug}/site.ts):
 *   - New: `export const INTAKE: Intake = { plan, receptionistMode, siteCount, sites: [...] }`
 *   - Legacy: `export const CONTENT: SiteContent = {...}` (auto-wrapped to a single-site Intake
 *     using CONTENT._meta.selectedPlan as the plan; pass --receptionist to supply the mode).
 */

import dotenv from 'dotenv';
// Load .env as the authoritative config. override:true makes the file win over
// any stale/empty same-named var already present in the environment (e.g. an
// empty ANTHROPIC_API_KEY injected by a parent shell) — which plain dotenv would
// otherwise refuse to replace, silently breaking provisioning mid-run.
dotenv.config({ override: true });
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, basename, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import Anthropic from '@anthropic-ai/sdk';
import { Octokit } from '@octokit/rest';
import twilio from 'twilio';
import {
  syncEnvToVercel,
  syncVercelFirewall,
  triggerPreviewDeploy,
  redeployProductionIfStale,
  sanitizeProjectName,
  vercelAppHost,
  getVercelProjectId,
  getProjectAnalytics,
  listProjectDomains,
} from './lib/vercel-sync.js';
import { createClerkClient } from '@clerk/backend';
import { FONT_DIR, FONT_LOADER, googleFontImports, writeSiteFonts } from './lib/site-fonts.js';
// toE164 comes from the package for the same reason vercelAppHost does: five copies had
// already diverged on the E.164 regex, and nothing compared them. lib/site-routes/*.ts keep
// their own inline copy deliberately — those files are written verbatim into client repos,
// which have no @jdd/schema dependency.
import { buildPortalSiteEntries, isWebOnly, toE164 } from '@jdd/schema';
import {
  attachSiteToAccount,
  detachSiteFromAccount,
  accountStoreConfigured,
  getAccountRecord,
  registerLeadIngestToken,
} from './lib/account-store.js';
import {
  ensureClientRecord,
  clientRecordsConfigured,
} from './lib/client-record-store.js';
// The .env.local template, shared with the console's plan-upgrade route. It lives in lib/
// rather than here because onboard.js pulls in dotenv, Anthropic, Octokit, twilio and Clerk —
// too heavy for a Next server route — so the console previously kept its own copy, and that
// copy had already drifted to an unsafe ring window. See lib/client-env.js.
import { buildClientEnvLines, placesCallbacks } from './lib/client-env.js';
import {
  extractContentObject,
  hasConsoleMarker,
  setPath,
} from './lib/provisioned-fields.js';
// The correctness predicates, shared verbatim with test/*.test.mjs. See lib/onboard-checks.js
// for why they are a separate module rather than inline assertions.
import {
  checkEnvTierMatrix,
  checkForwardNotSelf,
  checkSitePublishesTwilioNumber,
  checkForwardPreserved,
  checkBlueprintFieldsResolve,
  checkBlueprintEventFilter,
  checkBlueprintNoDatastore,
  checkAnalysisCoversBlueprint,
  checkPromptHasConsentAsk,
  checkSelectMappingsTotal,
  checkCallbackNumberColumn,
  checkPromptParity,
  checkOwnerBriefViaAgency,
  checkConnectedCallsOnly,
  checkAirtableSchemaCovers,
  checkNotMasterBase,
  checkNotMasterHook,
  formatCheckLines,
  summarizeChecks,
} from './lib/onboard-checks.js';
// Make rate-limits per organization per minute; a 429 is "wait", not "unreachable".
import { fetchWithRetry } from './lib/make-fetch.js';
// stdout is narrated into the console UI and pasted into chats; nothing printed may carry a
// credential. See lib/secrets.js for the run that printed two.
import { redactUrlCredentials, gitAuthEnv } from './lib/secrets.js';
// The spoken consent wording + post-call analysis schema, and the Call Log columns that record it.
import {
  buildPostCallAnalysisData,
  inboundOpeningLine,
  smsConsentAsk,
  VOICEMAIL_OPTION,
  SIGNED_RECORDING_SETTINGS,
  voiceConsentInstructions,
  callerDetailsInstructions,
  SPELLING_RULE,
  PROMPT_SECTIONS,
} from './lib/voice-consent.js';
import { CALL_LOG_FIELDS } from './lib/call-log-fields.js';
// Which finished calls get logged and briefed: connected ones only (operator rule, 2026-11-03).
import { CALL_OUTCOME_CASES, shouldLog } from './lib/call-outcomes.js';

// Hard ceiling on a single AI call, in milliseconds.
//
// Retell's own default is 3,600,000 (60 minutes). A receptionist call that runs
// even close to that is a malfunction — a loop, a held line, a caller who walked
// away — not a conversation, and at the measured ~$0.0985/min blended rate a
// single 60-minute call costs about $5.91. Measured median call length on this
// account is 91 seconds, so 10 minutes is roughly 6x the p50 and still well clear
// of any real call. This bounds the blast radius of one stuck call; it is NOT the
// monthly plan allowance, which is enforced separately against usage.
const MAX_CALL_DURATION_MS = 600_000;

// Anchor to onboard.js's own directory so lib/ assets resolve regardless of cwd.
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

let DRY_RUN = false;
let FORCE_TEST_PORTAL = false;   // set by --test-portal; forces the test-login path for non-_e2e slugs
let CURRENT_SITE_LABEL = ''; // e.g., "site 2/3" when looping

// Monotonic step counter. The run's steps are NOT a fixed 1..10: markers repeat (site content +
// api routes both printed "step 3"), several sub-actions shared "step 8", and for enterprise the
// whole block loops per site — so the old constant `/10` denominator was always a lie. Each
// emitted step now gets the next sequence number and no denominator. The console parser keys
// phases on the message text, not this number, so the value is purely for a human reading the raw
// log. The legacy `step` argument on log()/fail() is kept as a loose grouping hint at call sites
// but no longer printed.
let STEP_N = 0;

function log(step, msg) {
  const tag = CURRENT_SITE_LABEL ? ` ${CURRENT_SITE_LABEL}` : '';
  console.log(`\n[step ${++STEP_N}${tag}] ${msg}`);
}

/**
 * A fatal provisioning stop.
 *
 * `fail()` used to call `process.exit(1)` directly. That made every validation path
 * untestable: `node:test` runs the suite in-process, so one assertion on a refusal
 * (`validateIntake` rejecting an unstated receptionistMode, `preflight` catching a missing
 * credential) would have taken the whole runner down with it instead of failing one case.
 *
 * Throwing instead changes nothing at the ~44 call sites — `fail()` still never returns — and
 * the CLI guard at the bottom of this file turns it back into the exact same stderr line and
 * exit code. The format is load-bearing: console/src/lib/onboard-parse.ts keys a fatal run on
 * the literal `FAIL:` token, so the wording below must not drift.
 *
 * Verified before the change: all three `fail()` calls that sit near a `try` are inside its
 * `catch` clause, not its body, so none of them is swallowed by the throw.
 */
class OnboardError extends Error {
  constructor(message, { step, cause } = {}) {
    super(message);
    this.name = 'OnboardError';
    this.step = step;
    if (cause !== undefined) this.cause = cause;
  }
}

function fail(step, msg, err) {
  throw new OnboardError(msg, { step: STEP_N, cause: err });
}

/** Render a fatal stop exactly as the pre-throw `fail()` did, for the CLI and the console parser. */
function reportFatal(err) {
  if (err instanceof OnboardError) {
    console.error(`\n[step ${err.step || '?'}] FAIL: ${err.message}`);
    if (err.cause) console.error(err.cause);
  } else {
    console.error(`\n[step ${STEP_N || '?'}] FAIL: unhandled error in onboard.js`);
    console.error(err);
  }
}

function dryLog(msg) {
  console.log(`  [dry-run] ${msg}`);
}

function run(cmd, opts = {}) {
  if (DRY_RUN) {
    dryLog(`would run: ${redactUrlCredentials(cmd)}`);
    return;
  }
  // Redacted as a second line of defence — the first is never putting a credential in a command.
  console.log(`  $ ${redactUrlCredentials(cmd)}`);
  execSync(cmd, { stdio: 'inherit', ...opts });
}

function parseArgs(argv) {
  const args = { schema: null, dryRun: false, slug: null, linkPortal: false, testPortal: false, email: null, receptionist: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--schema' && argv[i + 1]) {
      args.schema = argv[i + 1];
      i++;
    } else if (argv[i] === '--dry-run') {
      args.dryRun = true;
    } else if (argv[i] === '--slug' && argv[i + 1]) {
      args.slug = argv[i + 1];
      i++;
    } else if (argv[i] === '--link-portal') {
      args.linkPortal = true;
    } else if (argv[i] === '--test-portal') {
      args.testPortal = true;
    } else if (argv[i] === '--email' && argv[i + 1]) {
      args.email = argv[i + 1];
      i++;
    } else if (argv[i] === '--receptionist' && argv[i + 1]) {
      // Operator override for the activation choice, for an intake that predates the field.
      // Validated below against the three allowed values; a bad value is rejected, never
      // coerced. Mirrors how --email overrides the portal address.
      args.receptionist = argv[i + 1];
      i++;
    } else if (argv[i] === '--help' || argv[i] === '-h') {
      console.log('Usage:');
      console.log('  npm run onboard -- --schema clients/{slug}/site.ts [--dry-run] [--receptionist forwarded|published|declined]');
      console.log('  npm run onboard -- --slug {slug} --link-portal [--email addr] [--test-portal]');
      process.exit(0);
    }
  }
  return args;
}

function deriveBaseSlug(schemaPath) {
  const parts = resolve(schemaPath).split(/[\\/]/);
  const idx = parts.lastIndexOf('clients');
  if (idx === -1 || !parts[idx + 1]) {
    return basename(dirname(schemaPath));
  }
  return parts[idx + 1];
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    if (DRY_RUN) {
      dryLog(`env ${name} not set (dry-run continues)`);
      return `<${name}>`;
    }
    fail(0, `Missing required env: ${name}. Copy .env.example to .env and fill in.`);
  }
  return v;
}

// ───────────────────────────────────────────────────────────────────────────
// Step 1: Load + validate Intake
// ───────────────────────────────────────────────────────────────────────────

/**
 * Remove every `interface … { … }` / `export interface … { … }` block from TS
 * source, honoring nested braces. The naive `^export type …;` regex below only
 * handles single-line type aliases; interface blocks span multiple lines and
 * nest braces, so they need a brace-counting pass or the data:URL import throws
 * `Unexpected token 'export'`.
 */
function stripInterfaceBlocks(src) {
  const headerRe = /(?:export\s+)?interface\s+\w+[^{]*\{/g;
  let result = '';
  let lastIndex = 0;
  let m;
  while ((m = headerRe.exec(src)) !== null) {
    const start = m.index;
    let depth = 0;
    let i = start + m[0].length - 1; // index of the opening '{'
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') {
        depth--;
        if (depth === 0) { i++; break; }
      }
    }
    result += src.slice(lastIndex, start);
    lastIndex = i;
    headerRe.lastIndex = i;
  }
  result += src.slice(lastIndex);
  return result;
}

async function loadIntake(schemaPath) {
  if (!schemaPath) fail(1, 'Missing --schema argument');
  if (!existsSync(schemaPath)) fail(1, `Schema file not found: ${schemaPath}`);

  const ext = schemaPath.endsWith('.ts') ? '.ts' : '.js';
  let mod;
  try {
    if (ext === '.ts') {
      const src = readFileSync(schemaPath, 'utf8');
      const stripped = stripInterfaceBlocks(src)
        .replace(/:\s*SiteContent/g, '')
        .replace(/:\s*Intake/g, '')
        .replace(/^import .*$/gm, '')
        .replace(/^export type .*?;$/gms, '');
      const dataUrl = 'data:text/javascript;base64,' + Buffer.from(stripped).toString('base64');
      mod = await import(dataUrl);
    } else {
      mod = await import(pathToFileURL(resolve(schemaPath)).href);
    }
  } catch (err) {
    fail(1, `Could not import schema: ${err.message}`, err);
  }

  // Prefer new INTAKE export; fall back to legacy CONTENT
  if (mod.INTAKE) {
    return mod.INTAKE;
  }
  if (mod.CONTENT) {
    // No default here on purpose. Guessing "growth" for a schema that never said so buys a
    // Twilio number and creates a Retell agent for what may well be a starter client — a
    // silent, billable wrong answer. Make the operator state the plan.
    const plan = mod.CONTENT?._meta?.selectedPlan;
    if (!plan) {
      fail(1, `Legacy CONTENT schema has no _meta.selectedPlan — set it to "starter", "growth", or "enterprise" in ${schemaPath}. Refusing to guess: the wrong guess provisions paid Twilio/Retell resources.`);
    }
    // receptionistMode is deliberately left unset here. A legacy CONTENT file predates the
    // activation step, so the schema cannot know whether the client wanted a receptionist.
    // validateIntake then refuses the run unless the operator supplies --receptionist, which is
    // the same "refuse to guess" stance as the plan above: assuming a receptionist spends money,
    // and assuming "declined" withholds a service the client may have paid for.
    //
    // No smsAlerts on this path either, and that is correct: a legacy CONTENT file predates
    // consent capture, so there is no record of the owner agreeing to anything. Absent
    // reads as "not consented" downstream and the Twilio module is left out of the clone.
    return { plan, siteCount: 1, sites: [mod.CONTENT] };
  }
  fail(1, 'Schema must export INTAKE or CONTENT');
}

/**
 * Two tiers, because "missing" means two different things here.
 *
 * ERRORS are structural. Step 3 splices this object into a repo that type-checks under
 * `strict`, so an absent field is a `npm run build` failure at step 5 — one step AFTER
 * step 2 created the GitHub repo and step 4 wrote secrets. Far cheaper to catch at step 1.
 * The old list checked 7 fields while the build needs ~25, which is how the _e2e-starter
 * fixture drifted to a 3-field brand without anything noticing.
 *
 * WARNINGS are fields whose key must exist but whose value is legitimately null: hgco ships
 * `brand.tagline: null` and an all-null `seo`, and its onboard is designed to be re-runnable.
 * Hard-erroring on those would break re-provisioning a live client, so they only ever warn.
 */
function validateSite(content, label) {
  const errors = [];
  const warnings = [];
  const brand = content?.brand;
  const palette = brand?.palette;
  const typography = brand?.typography;

  // Present AND non-empty: every one of these is rendered or dereferenced unguarded.
  const required = [
    ['brand.name', brand?.name],
    ['brand.short', brand?.short],
    ['brand.long', brand?.long],
    ['brand.phone', brand?.phone],
    ['brand.phoneHref', brand?.phoneHref],
    ['brand.email', brand?.email],
    ['brand.address', brand?.address],
    ['brand.palette.accent', palette?.accent],
    ['brand.palette.bg', palette?.bg],
    ['brand.palette.bgSoft', palette?.bgSoft],
    ['brand.palette.ink', palette?.ink],
    ['brand.palette.inkSoft', palette?.inkSoft],
    ['brand.palette.rule', palette?.rule],
    // typographyVars() reads brand.typography with no guard — an absent block is a
    // TypeError at render, not a blank CSS variable.
    ['brand.typography.fontSans', typography?.fontSans],
    ['brand.typography.fontHeading', typography?.fontHeading],
    ['brand.typography.headingWeight', typography?.headingWeight],
    ['brand.typography.bodyWeight', typography?.bodyWeight],
    ['_meta.selectedPlan', content?._meta?.selectedPlan],
  ];
  for (const [path, val] of required) {
    if (!val) errors.push(`${label}: missing required field ${path}`);
  }

  // page.tsx calls .map() on both of these without a guard. Empty is fine; absent is not.
  for (const key of ['services', 'faq']) {
    if (!Array.isArray(content?.[key]?.items)) {
      errors.push(`${label}: missing required field ${key}.items (must be an array)`);
    }
  }

  // Nullable-but-required: SiteContent declares the key, so it has to be there, but null
  // is a legal value that only costs you a blank spot on the page.
  const nullable = [
    ['brand.established', brand],
    ['brand.license', brand],
    ['brand.tagline', brand],
    ['seo.title', content?.seo],
    ['seo.description', content?.seo],
    ['seo.canonical', content?.seo],
  ];
  for (const [path, parent] of nullable) {
    const key = path.split('.').pop();
    if (!parent || typeof parent !== 'object' || !(key in parent)) {
      errors.push(`${label}: missing required field ${path}`);
    } else if (!parent[key]) {
      warnings.push(`${label}: ${path} is empty — renders blank`);
    }
  }

  return { errors, warnings };
}

/**
 * Website-only client: Starter with the receptionist declined. Adapts the envelope-level
 * mode onto the PortalSite shape the canonical `isWebOnly` expects, so there is one definition
 * of the rule across the agency app, the console and here.
 */
function intakeIsWebOnly(intake) {
  return isWebOnly({ plan: intake.plan, receptionistMode: intake.receptionistMode });
}

function validateIntake(intake) {
  const errors = [];
  const warnings = [];
  const validPlans = new Set(['starter', 'growth', 'enterprise']);
  if (!validPlans.has(intake.plan)) {
    errors.push(`unknown plan "${intake.plan}" (expected starter|growth|enterprise)`);
  }
  // The activation choice must be stated, never inferred. Same reasoning as the plan guard:
  // the wrong guess spends money. Assuming a receptionist buys a Twilio number and stands up a
  // Retell agent for a client who declined one; assuming "declined" delivers a bare website to
  // a client who paid for a receptionist. An intake predating the activation step carries no
  // mode, so the operator supplies one with --receptionist (resolved before this runs).
  const validModes = new Set(['forwarded', 'published', 'declined']);
  if (!validModes.has(intake.receptionistMode)) {
    errors.push(
      `receptionistMode is "${intake.receptionistMode ?? '(unset)'}" (expected forwarded|published|declined). ` +
      `Refusing to guess: the wrong guess provisions, or withholds, paid Twilio/Retell resources. ` +
      `Pass --receptionist forwarded|published|declined if the intake predates this field.`,
    );
  }
  // Web-only is a Starter-only arrangement. A declined receptionist on growth/enterprise is a
  // contradiction (those tiers are sold on the receptionist), so catch it rather than silently
  // skipping provisioning the client paid for.
  if (intake.receptionistMode === 'declined' && intake.plan !== 'starter') {
    errors.push(`receptionistMode "declined" is only valid on the starter plan, not "${intake.plan}"`);
  }
  if (!Array.isArray(intake.sites) || intake.sites.length < 1) {
    errors.push('intake.sites must contain at least 1 site');
  }
  if (intake.plan === 'enterprise' && (intake.sites.length < 2 || intake.sites.length > 3)) {
    errors.push(`enterprise plan requires 2 or 3 sites (got ${intake.sites.length})`);
  }
  // Enforce `plan === 'enterprise'` ⟺ multi-site. Without this the two are independent, and
  // a growth intake carrying 2 sites builds site-1/ and site-2/ dirs while the portal
  // attaches only the base slug — naming a Vercel project that was never created.
  if (intake.plan !== 'enterprise' && Array.isArray(intake.sites) && intake.sites.length > 1) {
    errors.push(`plan "${intake.plan}" requires exactly 1 site (got ${intake.sites.length}) — only enterprise is multi-site`);
  }
  intake.sites.forEach((site, i) => {
    const res = validateSite(site, `site[${i + 1}/${intake.sites.length}]`);
    errors.push(...res.errors);
    warnings.push(...res.warnings);
  });
  if (intake.plan === 'enterprise') {
    const shorts = intake.sites.map((s) => s?.brand?.short);
    const dupes = shorts.filter((s, i, arr) => s && arr.indexOf(s) !== i);
    if (dupes.length) {
      errors.push(`enterprise sites must have unique brand.short values; duplicates: ${[...new Set(dupes)].join(', ')}`);
    }
  }
  // Warnings first, so they are visible even on a run that goes on to fail.
  for (const w of warnings) console.warn(`  ! ${w}`);
  if (errors.length) {
    for (const e of errors) console.error(`  - ${e}`);
    fail(1, `Intake validation failed (${errors.length} error${errors.length === 1 ? '' : 's'})`);
  }
  log(
    1,
    `Intake loaded: plan="${intake.plan}", ${intake.sites.length} site${intake.sites.length === 1 ? '' : 's'}`,
  );
  intake.sites.forEach((site, i) => {
    const missing = site?._meta?.missing_fields ?? site?._meta?.missingFields ?? [];
    console.log(`  site ${i + 1}/${intake.sites.length}: "${site.brand.name}" (${missing.length} missing fields)`);
  });
}

// ───────────────────────────────────────────────────────────────────────────
// Slug + directory helpers
// ───────────────────────────────────────────────────────────────────────────

/**
 * The one definition of "multi-site". validateIntake enforces that this is equivalent to
 * `plan === 'enterprise'`, so slug layout, directory layout, Airtable base sharing and portal
 * attachment all key off the same fact instead of three lookalike conditions that could drift.
 */
function isMultiSite(intake) {
  return intake.sites.length > 1;
}

function siteSlugFor(baseSlug, intake, i) {
  if (!isMultiSite(intake)) return baseSlug;
  return `${baseSlug}-${i + 1}`;
}

function siteDirFor(baseSlug, intake, i) {
  if (!isMultiSite(intake)) return resolve('clients', baseSlug);
  return resolve('clients', baseSlug, `site-${i + 1}`);
}

/** The client dir holding the shared/primary values (Airtable base, portal email, Clerk user). */
function primaryClientDirFor(baseSlug, intake) {
  return siteDirFor(baseSlug, intake, 0);
}

// ───────────────────────────────────────────────────────────────────────────
// Step 2: Create empty GitHub repo + use the local repo (local-first)
//
// JDD builds each client site locally (copy of template/, components dropped in,
// previewed on a dev server) at clients/{slug}/repo. We no longer clone from a
// GitHub template. Step 2 just creates an EMPTY GitHub repo and points the local
// repo's origin at it; step 8c (commitAndPush) does the actual push.
// ───────────────────────────────────────────────────────────────────────────

async function createRepoFromLocal(siteSlug, content, clientDir) {
  log(2, `Create empty GitHub repo + use local repo at ${clientDir}/repo`);
  const repoDir = resolve(clientDir, 'repo');
  if (DRY_RUN) {
    dryLog(`would require local repo at ${repoDir}`);
    dryLog(`would create empty repo ${process.env.GITHUB_ORG || '<GITHUB_ORG>'}/${siteSlug} (auto_init: false)`);
    dryLog(`would git init (if needed) + set origin + push (step 8c)`);
    return { repoDir, repoUrl: `https://github.com/${process.env.GITHUB_ORG || '<GITHUB_ORG>'}/${siteSlug}.git` };
  }

  if (!existsSync(repoDir)) {
    fail(2, `No local repo at ${repoDir}. Run \`npm run new-client -- --slug ${siteSlug}\`, build it locally, then re-run onboard.`);
  }

  const token = requireEnv('GITHUB_TOKEN');
  const githubOrg = requireEnv('GITHUB_ORG');
  const octokit = new Octokit({ auth: token });

  let repoUrl;
  try {
    const existing = await octokit.repos.get({ owner: githubOrg, repo: siteSlug });
    console.log(`  GitHub repo ${githubOrg}/${siteSlug} already exists — reusing`);
    repoUrl = existing.data.clone_url;
  } catch (err) {
    if (err.status !== 404) fail(2, `GitHub API error checking ${githubOrg}/${siteSlug}`, err);
    console.log(`  Creating empty repo ${githubOrg}/${siteSlug}…`);

    // GITHUB_ORG may be either a real GitHub organization or a personal user
    // account. Org repos are created via POST /orgs/{org}/repos, but user repos
    // must use POST /user/repos — calling the org endpoint for a user account
    // 404s. Detect which one we're dealing with and route accordingly.
    const { data: me } = await octokit.users.getAuthenticated();
    const isSelf = me.login.toLowerCase() === githubOrg.toLowerCase();
    const createParams = {
      name: siteSlug,
      private: true,
      auto_init: false,
      description: `${content.brand.name} — managed site`,
    };
    let created;
    try {
      created = isSelf
        ? await octokit.repos.createForAuthenticatedUser(createParams)
        : await octokit.repos.createInOrg({ org: githubOrg, ...createParams });
    } catch (createErr) {
      // Fallback: if we guessed "org" but it's actually a user (or vice versa), retry the other endpoint.
      if (createErr.status === 404) {
        created = isSelf
          ? await octokit.repos.createInOrg({ org: githubOrg, ...createParams })
          : await octokit.repos.createForAuthenticatedUser(createParams);
      } else {
        throw createErr;
      }
    }
    repoUrl = created.data.clone_url;
  }

  // Make the local repo a git repo (if needed) and point origin at the new GitHub
  // repo. commitAndPush (step 8c) handles the commit + `git push HEAD:main`.
  if (!existsSync(resolve(repoDir, '.git'))) {
    run('git init', { cwd: repoDir });
  }
  try {
    execSync('git remote get-url origin', { cwd: repoDir, stdio: 'ignore' });
    run(`git remote set-url origin ${repoUrl}`, { cwd: repoDir });
  } catch {
    run(`git remote add origin ${repoUrl}`, { cwd: repoDir });
  }

  return { repoDir, repoUrl };
}

// ───────────────────────────────────────────────────────────────────────────
// Step 3: Write src/data/site.ts
// ───────────────────────────────────────────────────────────────────────────

/**
 * Step 3 proper: install the schema, UNLESS the console already authored it.
 *
 * ── Why this can't just overwrite ───────────────────────────────────────────
 *
 * The console's exporter is the editor for a client's site: it writes generated copy, the
 * palette, route-based nav, localized imagery, and per-section styling into the repo's
 * site.ts. This step used to splice `clients/{slug}/site.ts` — the raw INTAKE — straight over
 * all of it, every run. So the loop "edit in the console, export, re-run onboard" silently
 * reverted the site to its intake: anchor nav instead of routes, intake copy instead of
 * generated copy, hotlinked placeholders instead of localized images. That is how a client
 * shipped with `nav` pointing at `#about` on a multi-page site.
 *
 * So the ownership is field-level, not file-level (jdd-ops/lib/provisioned-fields.js). The
 * console owns the content; this script owns the provisioned facts and writes them through
 * `updateRepoSchemaFields` instead of rewriting the whole file.
 *
 * The intake is still spliced for a repo the console has NOT authored — a freshly scaffolded
 * template copy — because then it is the only content there is.
 *
 * Deliberately keeps step 3's single `log()` call on every path. The phase contract
 * (console/test/phase-contract.test.mjs) replays recorded dry-run stdout through the real
 * parser and asserts the phases match; adding, dropping or reordering a log() here fails it.
 * The skip also must not emit the token `FAIL:`, which onboard-parse.ts treats as fatal.
 */
function installClientSchema(repoDir, content) {
  const siteFile = resolve(repoDir, 'src/data/site.ts');
  let consoleAuthored = false;
  if (existsSync(siteFile)) {
    const src = readFileSync(siteFile, 'utf8');
    consoleAuthored = hasConsoleMarker(src) && Boolean(extractContentObject(src));
  }

  if (!consoleAuthored) {
    writeClientSchema(repoDir, content);
    return;
  }

  // Phrased to START with "Write src/data/site.ts" so PHASE_MAP's /Write src\/data\/site\.ts/
  // entry still matches (console/src/lib/onboard-parse.ts). A message it doesn't match falls
  // through to labelFor's raw-message fallback and renders as an `unplanned` coral node — which
  // is what every re-provision of a console-authored client would otherwise have shown.
  log(3, `Write src/data/site.ts — keeping console-authored content`);
  if (DRY_RUN) {
    // A dry run answers "would this provision correctly?", so it must not claim it "would
    // splice CONTENT" when it would do no such thing. Misreporting the one step that decides
    // whose content ships is exactly the lie a dry run exists to prevent.
    dryLog(`would KEEP the console's src/data/site.ts and not splice the intake over it`);
    dryLog(`would still apply provisioned fields individually (see "Publish number on the site")`);
    return;
  }
  console.log(`  ${siteFile} was written by the console's export — its content wins.`);
  console.log(`  Provisioned fields are applied individually; see "Publish number on the site".`);
}

/**
 * Apply specific dotted-path fields to the repo's EXISTING site.ts content, leaving everything
 * else byte-for-byte alone.
 *
 * This is how provisioning writes its own fields without reverting the console's. Reading the
 * file rather than using the in-memory intake object is the whole point: after
 * `installClientSchema` declines to splice, the intake and the repo hold different content,
 * and the repo's is the one that is deployed.
 *
 * Returns false when the file can't be read as content, so the caller can fall back to the
 * wholesale write rather than silently skipping a provisioned value.
 */
function updateRepoSchemaFields(repoDir, updates) {
  const siteFile = resolve(repoDir, 'src/data/site.ts');
  if (!existsSync(siteFile)) return false;
  const src = readFileSync(siteFile, 'utf8');
  const current = extractContentObject(src);
  if (!current) return false;

  for (const [path, value] of Object.entries(updates)) {
    if (!setPath(current, path, value)) return false;
  }

  const marker = 'export const CONTENT: SiteContent = ';
  const idx = src.indexOf(marker);
  if (idx === -1) return false;
  const out = `${src.slice(0, idx)}${marker}${JSON.stringify(current, null, 2)};\n`;
  writeFileSync(siteFile, out, 'utf8');
  return true;
}

function writeClientSchema(repoDir, content) {
  log(3, `Write src/data/site.ts in local repo`);
  if (DRY_RUN) {
    dryLog(`would splice CONTENT into ${repoDir}/src/data/site.ts (${JSON.stringify(content).length.toLocaleString()} chars)`);
    return;
  }
  const siteFile = resolve(repoDir, 'src/data/site.ts');
  if (!existsSync(siteFile)) {
    fail(3, `Expected ${siteFile} (the cloned template should have this). Template may be out of date.`);
  }
  const original = readFileSync(siteFile, 'utf8');
  const marker = 'export const CONTENT: SiteContent = ';
  const idx = original.indexOf(marker);
  if (idx === -1) {
    fail(3, `Could not find "${marker}" in template's site.ts — refusing to overwrite blindly`);
  }
  const typePrefix = original.slice(0, idx);
  const serialized = JSON.stringify(content, null, 2);
  const newFile = `${typePrefix}export const CONTENT: SiteContent = ${serialized};\n`;
  writeFileSync(siteFile, newFile, 'utf8');
  console.log(`  Wrote ${siteFile} (${newFile.length.toLocaleString()} chars)`);
}

/**
 * Repoint the site's PUBLISHED phone number at the JDD-owned Twilio number.
 *
 * Until this existed, the deployed site advertised the number the owner gave us at intake,
 * while the whole voice stack hung off a Twilio number that appeared nowhere public. Every
 * real caller dialed the owner's line directly and so bypassed `/api/voice` entirely: no
 * human-first forward, no Retell fallback on no-answer, no Airtable call log. The
 * receptionist worked perfectly and was simply never reached.
 *
 * Two numbers, two different jobs, and they must not be confused:
 *   - `brand.phone` / `brand.phoneHref` — what the website shows. Becomes the Twilio number.
 *   - `CLIENT_FORWARD_PHONE` in .env.local — where `/api/voice` forwards. Stays the owner's
 *     real line, forever.
 * This is why the call order matters: `writeClientEnvLocal` has already run and captured
 * `content.brand.phone` while it was still the owner's number. Mutating the content any
 * earlier would set CLIENT_FORWARD_PHONE to the Twilio number, and `/api/voice` would dial
 * the number that invoked it — an inbound call forwarding to itself.
 *
 * Gated on `!webOnly`, not on plan: since the 2026-10-12 reprice a Starter client WITH a
 * receptionist also owns a Twilio number and needs it published, exactly like Growth. Only
 * a declined-receptionist client has no number to swap in.
 */
/**
 * What the site would advertise for a given Twilio number — or null if it isn't dialable.
 *
 * Pure, so the dry-run checks can state the published number without writing a file. All three
 * forms derive from `toE164` in @jdd/schema, so nothing here holds a second opinion about what
 * a valid number is — the mistake that left five diverging copies of that regex in the tree.
 */
function resolvePublishedPhone(twilioNumber) {
  const e164 = toE164(twilioNumber);
  if (!e164) return null;
  return { e164, display: formatPhoneForDisplay(e164), href: `tel:${e164}` };
}

function applyTwilioNumberToSite(repoDir, content, twilioNumber) {
  const previous = content.brand.phone;
  const published = resolvePublishedPhone(twilioNumber);

  // provisionTwilioNumber returns a '<dry-run-number>' sentinel rather than a real one, so a
  // dry run reports against a stand-in: validating the sentinel would print a scary "not
  // dialable" warning on every dry run and preview nothing useful. When .env.local already
  // carries a real number (the reuse path), `published` is real and the checks can assert it.
  if (DRY_RUN) {
    log(3, `Publish number on the site (was ${previous})`);
    const preview = published ?? resolvePublishedPhone('+14075551212');
    dryLog(`would rewrite brand.phone → ${preview.display} / phoneHref → ${preview.href}${published ? '' : ' (illustrative — no number provisioned yet)'}`);
    dryLog(`would leave CLIENT_FORWARD_PHONE=${previous} untouched as the forward target`);
    return { written: false, published, previous };
  }

  if (!published) {
    // Don't publish a number we can't dial. Leaving the owner's number up is the lesser
    // failure: the site still rings a human, where a mangled number rings nobody.
    console.warn(`  ⚠ Twilio number "${twilioNumber}" is not dialable — leaving the published number as-is.`);
    console.warn(`    The site will advertise ${previous}, so calls bypass /api/voice and nothing is logged.`);
    return { written: false, published: null, previous };
  }

  log(3, `Publish number on the site (was ${previous})`);
  // Keep the in-memory copy in step with the file: the correctness checks, the Vercel env
  // sync and the agent prompt all read `content` after this point.
  content.brand.phone = published.display;
  content.brand.phoneHref = published.href;

  /**
   * Write the two fields INTO whatever the repo currently holds, rather than writing
   * `content` wholesale.
   *
   * On a re-provision of a console-authored repo those are not the same document: `content` is
   * the intake, the repo is the console's exported site. A wholesale write here would undo
   * everything `installClientSchema` just declined to overwrite — publishing the number
   * correctly while reverting the copy, nav and imagery in the same breath.
   *
   * Falls back to the wholesale write when the file can't be parsed as content (a hand-edited
   * repo, a template that changed shape). Publishing the number is the more important of the
   * two: leave it unwritten and the site advertises the owner's line and every caller bypasses
   * /api/voice.
   */
  const patched = updateRepoSchemaFields(repoDir, {
    'brand.phone': published.display,
    'brand.phoneHref': published.href,
  });
  if (!patched) writeClientSchema(repoDir, content);
  console.log(`  Published number ${published.display}; forwards to ${previous}`);
  return { written: true, published, previous };
}

/**
 * E.164 → the punctuation the rest of the schema uses, e.g. +14075551212 → "(407) 555-1212".
 *
 * Presentation only. The dialable forms both come from `toE164` in @jdd/schema, so this adds
 * no second opinion about what a valid number is — the mistake that left five diverging
 * copies of that regex in the tree.
 */
function formatPhoneForDisplay(e164) {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
}

// ───────────────────────────────────────────────────────────────────────────
// Step 3b: Write the infrastructure API routes into the client repo
//
// onboard.js is the master orchestrator: the code that wires up lead delivery
// (/api/contact) and inbound call routing (/api/voice, /api/voice/no-answer)
// lives here (lib/site-routes/*.ts), NOT in the template or client repos. We
// write these files on every run so they are always current — overwriting
// whatever the local build / console export scaffolded in.
// ───────────────────────────────────────────────────────────────────────────

const API_ROUTES = [
  { asset: 'contact.route.ts',   dest: 'src/app/api/contact/route.ts' },
  { asset: 'voice.route.ts',     dest: 'src/app/api/voice/route.ts' },
  { asset: 'no-answer.route.ts', dest: 'src/app/api/voice/no-answer/route.ts' },
];

function writeApiRoutes(repoDir) {
  log(3, `Write infrastructure API routes (onboard-owned)`);
  if (DRY_RUN) {
    for (const { dest } of API_ROUTES) dryLog(`would write ${dest}`);
    return;
  }
  for (const { asset, dest } of API_ROUTES) {
    const src = resolve(SCRIPT_DIR, 'lib/site-routes', asset);
    if (!existsSync(src)) fail(3, `Missing route asset ${src} — onboard.js install is incomplete`);
    const target = resolve(repoDir, dest);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, readFileSync(src, 'utf8'), 'utf8');
    console.log(`  Wrote ${dest}`);
  }
}

/**
 * Step 3b, continued: the self-hosted fonts (lib/site-fonts.js has the why).
 *
 * Every client repo already in existence was copied from a template whose fonts.loader.ts
 * imported next/font/google, so each of its Vercel builds downloaded seven families and failed
 * at random. Writing the template's loader and font files here, every run, is how those repos get
 * the fix: the run that deploys a repo makes its fonts current, exactly as writeApiRoutes does
 * for the routes. Step 5's build then proves the result compiles before anything is pushed.
 *
 * Deliberately no log() of its own: it is part of step 3b's "onboard-owned files", and a new
 * phase would have to be added to PHASE_MAP and expectedPhases() for no gain (see the phase
 * contract in CLAUDE.md).
 */
function writeSelfHostedFonts(repoDir) {
  if (DRY_RUN) {
    dryLog(`would write ${FONT_LOADER} + ${FONT_DIR}/ (self-hosted fonts; the build never fetches from Google)`);
    return;
  }
  const written = writeSiteFonts(repoDir, resolve(SCRIPT_DIR, 'template'));
  console.log(`  Wrote ${FONT_LOADER} + ${written.length - 1} files in ${FONT_DIR}/ (self-hosted fonts)`);
  // Not fatal: the site still builds, it just goes back to building only when Google answers.
  // The hard gate is test/template-fonts.test.mjs, which covers the template and the console's
  // catalog components, the two places a client repo's code comes from.
  for (const rel of googleFontImports(repoDir)) {
    console.warn(`  ⚠ ${rel} imports next/font/google, so this site's builds still download from Google and can fail at random.`);
    console.warn(`    Vendor the family into template/src/lib/fonts/ (scripts/vendor-fonts.js) and load it with next/font/local.`);
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Step 4: Write clients/{slug}/.env.local
// ───────────────────────────────────────────────────────────────────────────

/** Parse clients/{slug}/.env.local into a plain object (returns {} if absent). */
function readEnvLocal(clientDir) {
  const envPath = resolve(clientDir, '.env.local');
  if (!existsSync(envPath)) return {};
  const out = {};
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return out;
}

function writeClientEnvLocal(clientDir, siteSlug, plan, content, webOnly) {
  log(4, `Write .env.local (plan=${plan}${webOnly ? ', website-only' : ''})`);
  // Preserve already-provisioned values so re-runs are idempotent and don't
  // wipe RETELL_AGENT_ID / TWILIO_NUMBER / AIRTABLE_BASE_ID.
  const prev = readEnvLocal(clientDir);
  // `env` is passed explicitly rather than defaulted, so the builder stays pure and a test can
  // drive it without touching the real environment.
  const { lines, carried } = buildClientEnvLines({ siteSlug, plan, content, webOnly, prev, env: process.env });

  // Computed above even in dry mode, and returned either way, so the correctness checks can
  // inspect what WOULD be written without anything touching disk.
  if (DRY_RUN) {
    dryLog(`would write ${clientDir}/.env.local (preserving any already-provisioned IDs)`);
    return { lines, carried };
  }

  const envPath = resolve(clientDir, '.env.local');
  writeFileSync(envPath, lines.join('\n') + '\n', 'utf8');
  const preserved = [
    ...['RETELL_AGENT_ID', 'TWILIO_NUMBER', 'CLIENT_FORWARD_PHONE', 'AIRTABLE_BASE_ID'].filter((k) => prev[k]),
    ...carried,
  ];
  console.log(`  Wrote ${envPath}${preserved.length ? ` (preserved: ${preserved.join(', ')})` : ''}`);
  return { lines, carried };
}

function patchEnvLocal(clientDir, key, value) {
  if (DRY_RUN) {
    dryLog(`would patch ${key}=${value} in ${clientDir}/.env.local`);
    return;
  }
  const envPath = resolve(clientDir, '.env.local');
  const original = readFileSync(envPath, 'utf8');
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (!re.test(original)) {
    writeFileSync(envPath, original + `${key}=${value}\n`, 'utf8');
  } else {
    writeFileSync(envPath, original.replace(re, `${key}=${value}`), 'utf8');
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Step 5: npm install + npm run build
// ───────────────────────────────────────────────────────────────────────────

function buildClientRepo(repoDir) {
  log(5, `npm install + npm run build`);
  if (DRY_RUN) {
    dryLog(`would run npm install + npm run build in ${repoDir}`);
    return;
  }
  run('npm install', { cwd: repoDir });
  run('npm run build', { cwd: repoDir });
}

// ───────────────────────────────────────────────────────────────────────────
// Step 6: Generate Retell prompt via Claude
// ───────────────────────────────────────────────────────────────────────────

/**
 * The instructions Claude gets when it writes a client's agent prompt. Pure, and exported so the
 * suite builds EXACTLY what a new Growth or Starter client's generator is handed — every rule from
 * the 2026-11-04 live tests (direction from {{direction}}, no name re-ask outbound, the spoken
 * number, the email from the name, plain-letter spelling, no square brackets) is asserted against
 * this, not against a grep of the source.
 */
export function promptGeneratorSystem(content, { callbacks = false } = {}) {
  return `You write the complete system prompt for a Retell AI voice agent that works the phones for a single local service business. ${callbacks ? 'The agent handles inbound calls and returns outbound callbacks placed within ~60 seconds of a website form submission.' : 'The agent ONLY answers inbound calls; it never places outbound calls or callbacks, so the prompt must contain no outbound or callback branches.'}

Output ONLY the finished agent prompt as a Markdown document with "##" section headers, in this exact order:
${PROMPT_SECTIONS.join(', ')}.
Use exactly these "##" headers and no others; everything below goes inside one of them. No preamble, no explanation, no code fences — just the prompt itself, written as direct second-person instructions to the agent ("You are…", "You never…").

PERSONA
- Give the agent ONE warm first name and use that same name everywhere (greeting, callbacks, every example). If an agentName is provided in the context, use it exactly. If it is null, choose one natural, friendly first name and never switch names.
- The agent is honest that it's a virtual assistant if asked, but leads with its first name like a human coordinator and does not announce being an AI unprompted.

ABSOLUTE CONSTRAINTS — bake these in as hard rules and restate the key ones in the NEVER section:
- The agent NEVER books, schedules, holds, confirms, or commits to any appointment, time window, arrival time, or ETA — not even a tentative or "pending confirmation" one. Its job is to COLLECT the caller's details and tell them a real person from the team will reach out to schedule. If the caller pushes to book, warmly explain that a team member handles scheduling and will follow up shortly. There is NO soft-booking and NO offering of time windows.
- NEVER quote prices, price ranges, or estimates — prices are always deferred to the team.
- NEVER invent facts. Answer questions ONLY from the provided business data. For anything not in the data (hours if not provided, license numbers, specific pricing, availability), say you'll have the team follow up.
- NEVER mention or compare to competitors.
- NEVER pressure the caller (to book, to give an email, etc.).

CORE SPEAKING RULES (write as direct instructions to the agent) — this is a voice conversation, so:
- One thought per turn: usually one or two sentences, then stop. Never read a paragraph aloud.
- One question at a time. Never stack questions. Ask, wait, acknowledge, then ask the next.
- Acknowledge what the caller said before advancing.
- Mirror the caller's energy (casual → relaxed; stressed or formal → calm and steady).
- If interrupted, stop talking immediately and listen.
- Don't repeat yourself or re-greet, and don't ask for a detail already given.
- Always use contractions; use light, occasional conversational fillers ("okay," "gotcha," "I see," "no problem") sparingly.
- Spoken-number formatting: read phone numbers back digit by digit in natural grouped chunks (area code… three digits… four digits), exactly the digits given — never write an example phone number into the prompt, say times like a person ("tomorrow around two," not "14:00"), and when taking a callback number READ IT BACK GROUPED and confirm it's right.
${SPELLING_RULE}

${callbacks
  ? "GREETING: include an inbound variant and an outbound-callback variant (for website inquiries), both using the persona name and the exact business name — written as the agent's FIRST OWN TURN after the fixed opening line below, not as a replacement for it."
  : "GREETING: one inbound greeting using the persona name and the exact business name — written as the agent's FIRST OWN TURN after the fixed opening line below, not as a replacement for it."}

${voiceConsentInstructions(content.brand.name, { callbacks })}

QUALIFICATION: let the caller describe the problem first, then fill gaps ONE question at a time — what they need (map to the provided services), timeline/urgency, and location. Define a short list of URGENT triggers appropriate to THIS business's trade (infer from the services/industry — e.g. for HVAC: no heat/AC in dangerous weather, burning smells, sparking or electrical issues, heavy water leaks, vulnerable people in the home). For urgent calls, tell the agent to stay calm, reassure the caller the team prioritizes emergencies, and collect details quickly — but STILL never promise an arrival time.

SERVICE AREA (part of the QUALIFICATION section, not a section of its own): if a serviceArea list is provided, use those town names; otherwise refer to the business's city (from its address) and "the surrounding area." If a caller is outside it, be gracious and say the team will confirm whether they can help.

NO SCHEDULING (its own section): state plainly that the agent collects details and hands off to a human for scheduling; it never offers, holds, or confirms a time. Give one or two example lines of redirecting a caller who wants to book right now.

${callerDetailsInstructions({ callbacks })}

ANSWERING QUESTIONS: answer only from provided data; for unknowns, offer to have the team follow up. SERVICES: list from the provided services. FAQ: derive from the provided FAQ data and answer in natural words, not verbatim. WHY CHOOSE: include only verifiable points grounded in the provided data (about/pillars/trust badges) — no invented awards, review counts, or guarantees. PRICING: never quote; defer to the team.

NO SQUARE BRACKETS: the voice model speaks the prompt's lines word for word and imitates its examples, so the prompt must contain NO square brackets anywhere — no bracketed placeholders, stage directions or fill-ins, not even as an example of what not to say. Where a line needs a value, put the instruction outside the quote in plain words — e.g. read the number back, then ask: "Is that a good number to reach you?"

CLOSING: warm, brief summary that the agent has what it needs and a person from the team will reach out to schedule / follow up — then the SMS CONSENT question exactly as specified above, as the last question of the call — then a short goodbye${callbacks ? ' (on an outbound callback the agent placed the call, so it thanks them for their time — never "thanks for calling")' : ''}.

EDGE CASES to cover: silence/no response; ${callbacks ? 'reaching voicemail on an outbound callback (hang up at once and leave NO message — the system normally hangs up on its own); ' : ''}an angry or frustrated caller; off-topic / non-service requests; and a caller who wants a human right now (reassure and capture details for a fast callback — never pretend to transfer if it can't).

NEVER (consolidated list): sounding robotic or scripted; reading an instruction to yourself aloud; spelling with phonetic or military alphabet words; stacking questions; quoting prices; booking/scheduling/holding appointments or promising arrival times or ETAs; inventing hours, names, license numbers, or any fact; mentioning competitors; pressuring the caller; talking over an interruption.

Keep everything warm, specific to this business, and grounded only in the provided data.`;
}

async function generateRetellPrompt(content, clientDir, siteSlug, { regenerate = false, callbacks = false } = {}) {
  log(6, `Claude → Retell agent prompt`);

  /**
   * On a resume, reuse the prompt on disk instead of regenerating it.
   *
   * If RETELL_AGENT_ID is set, that agent's LLM already carries the prompt uploaded when it was
   * created. Regenerating would then do three unhelpful things at once: spend an Anthropic call,
   * OVERWRITE agent-prompt.txt — destroying any hand-tuning, which is the whole point of
   * writing it to disk for review — and change nothing about the live agent, because
   * createRetellAgent short-circuits on the existing id and never uploads the new text. The
   * file would end up disagreeing with the agent, and the console's voice-agent editor reads
   * that file with no read-back from Retell, so it would show a prompt that was never applied.
   *
   * Changing a live prompt stays the job of `npm run update-prompt`, which targets the LLM.
   *
   * Keyed on the AGENT, not the file: if no agent exists the file is a leftover from a run that
   * died before creating one, and regenerating is correct.
   */
  // `regenerate` is the deliberate exception (`npm run regenerate-prompt`): an agent whose prompt
  // predates a wording change — the consent ask, the opening-line rules — must get a new one, and
  // the caller has already saved the old file for review.
  const promptFile = resolve(clientDir, 'agent-prompt.txt');
  if (!regenerate && readEnvLocal(clientDir).RETELL_AGENT_ID && existsSync(promptFile)) {
    const existing = readFileSync(promptFile, 'utf8');
    console.log(`  Reusing ${promptFile} (${existing.length.toLocaleString()} chars) — agent already exists, so not regenerating`);
    console.log(`  To change the live prompt: npm run update-prompt -- --slug ${basename(clientDir)}`);
    return existing;
  }

  if (DRY_RUN) {
    dryLog(`would call Anthropic Claude (model claude-sonnet-4-6) to generate agent prompt for "${content.brand.name}"`);
    dryLog(`would write ${clientDir}/agent-prompt.txt`);
    return '<dry-run prompt>';
  }
  requireEnv('ANTHROPIC_API_KEY');
  const anthropic = new Anthropic();

  const agentContext = {
    business: {
      name: content.brand.name,
      short: content.brand.short,
      phone: content.brand.phone,
      email: content.brand.email,
      address: content.brand.address,
      license: content.brand.license,
      tagline: content.brand.tagline,
    },
    // Optional persona name; if null the generator picks one and uses it consistently.
    agentName: content.extensions?.agentName ?? null,
    // Optional list of towns served; if null the generator falls back to the city + "surrounding area".
    serviceArea: content.extensions?.serviceArea ?? null,
    services: (content.services?.items ?? []).map((s) => ({
      name: s.t,
      description: s.d,
      tag: s.tag,
    })),
    faq: content.faq?.items ?? [],
    about: content.about?.body ?? '',
    pillars: (content.about?.pillars ?? []).map((p) => ({ title: p.t, detail: p.d })),
    trustBadges: content.extensions?.trustBadges ?? [],
    // Hours are for answering "what are your hours?" ONLY — never for offering appointments.
    hours: content.extensions?.hours ?? null,
  };

  const system = promptGeneratorSystem(content, { callbacks });

  const user = `Business context:\n${JSON.stringify(agentContext, null, 2)}\n\nWrite the complete agent system prompt now.`;

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const prompt = msg.content[0]?.text?.trim();
  if (!prompt) fail(6, 'Claude returned an empty prompt');

  const promptPath = resolve(clientDir, 'agent-prompt.txt');
  writeFileSync(promptPath, prompt, 'utf8');
  console.log(`  Wrote ${promptPath} (${prompt.length} chars)`);
  // The consent ask is evidence, so a paraphrase is not good enough — refuse before an agent is
  // built on it. The file is already written so the miss can be inspected; delete it to retry.
  const askCheck = checkPromptHasConsentAsk({ prompt, ask: smsConsentAsk(content.brand.name) });
  if (askCheck.ok === false) {
    fail(6, `${askCheck.detail}. Delete ${promptPath} and re-run to regenerate.`);
  }
  // The same predicate verify-agents holds live agents to, so a new client can't start below the
  // bar the test fixtures were tuned to. The generator is Claude: check what it actually wrote.
  const parity = checkPromptParity({ prompt, business: content.brand.name, callbacks });
  if (parity.ok === false) {
    fail(6, `${parity.detail}. Delete ${promptPath} and re-run to regenerate.`);
  }
  console.log(`  Review this before Checkpoint 2 — you will tune it on a test call`);
  return prompt;
}

// ───────────────────────────────────────────────────────────────────────────
// Step 7: Create Retell agent
// ───────────────────────────────────────────────────────────────────────────

/**
 * The body of create-retell-llm for a client's OWN LLM: the master template's model and tools,
 * this client's prompt, and the recording disclosure as the fixed opening line. Pure, and used by
 * the real run, the dry run's report and the tests alike — so "what would a new client get?" has
 * one answer.
 */
export function clientLlmCreateBody({ tpl = {}, agentPrompt, businessName }) {
  return {
    model: tpl.model ?? 'gpt-4.1-mini',
    ...(tpl.model_high_priority !== undefined ? { model_high_priority: tpl.model_high_priority } : {}),
    ...(tpl.tool_call_strict_mode !== undefined ? { tool_call_strict_mode: tpl.tool_call_strict_mode } : {}),
    ...(Array.isArray(tpl.general_tools) ? { general_tools: tpl.general_tools } : {}),
    general_prompt: agentPrompt,
    // The recording disclosure, spoken verbatim before the caller can say anything. Fixed
    // text rather than generated, because it is evidence — see lib/voice-consent.js.
    start_speaker: 'agent',
    begin_message: inboundOpeningLine(businessName),
  };
}

/** The body of create-agent for a client: bound to its own LLM, the consent schema, voicemail hang-up. */
export function clientAgentCreateBody({ businessName, llmId, voiceId }) {
  return {
    agent_name: businessName,
    response_engine: { type: 'retell-llm', llm_id: llmId },
    voice_id: voiceId,
    max_call_duration_ms: MAX_CALL_DURATION_MS,
    // Structured fields Retell extracts after each call (call_analysis.custom_analysis_data).
    // Defined in lib/voice-consent.js, shared with scripts/update-agent-prompt.js, so a new agent
    // and a backfilled one carry the identical schema the Make clone reads from.
    post_call_analysis_data: buildPostCallAnalysisData(businessName),
    // Hang up on voicemail. An API-created agent has detection OFF unless this is set, and then
    // talks to the voicemail — see lib/voice-consent.js.
    voicemail_option: VOICEMAIL_OPTION,
    // Recording and log links expire instead of opening for anyone, forever. See lib/voice-consent.js.
    ...SIGNED_RECORDING_SETTINGS,
  };
}

async function createRetellAgent(content, agentPrompt, clientDir) {
  log(7, `Create Retell AI agent`);
  const existingAgentId = readEnvLocal(clientDir).RETELL_AGENT_ID;
  if (existingAgentId) {
    // Verify the saved agent still exists in Retell before trusting it. A stale id
    // (agent deleted in the dashboard) otherwise silently breaks call routing —
    // /api/voice/no-answer registers against a dead agent and the AI leg fails.
    if (DRY_RUN) {
      dryLog(`would GET https://api.retellai.com/get-agent/${existingAgentId} to confirm it still exists`);
      console.log(`  Reusing existing Retell agent ${existingAgentId} (skipping create)`);
      return existingAgentId;
    }
    const apiKey = requireEnv('RETELL_API_KEY');
    const check = await fetch(`https://api.retellai.com/get-agent/${existingAgentId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (check.ok) {
      console.log(`  Reusing existing Retell agent ${existingAgentId} (verified, skipping create)`);
      return existingAgentId;
    }
    if (check.status === 404) {
      console.warn(`  ⚠ Saved RETELL_AGENT_ID ${existingAgentId} no longer exists in Retell (404) — creating a fresh agent and overwriting it.`);
      // fall through to create
    } else {
      fail(7, `Retell get-agent for ${existingAgentId} returned ${check.status}: ${await check.text()}`);
    }
  }
  if (DRY_RUN) {
    // Reported from the same builders the real run sends, so the dry run shows what a new client
    // actually gets rather than restating it.
    const llm = clientLlmCreateBody({ agentPrompt, businessName: content.brand.name });
    const agent = clientAgentCreateBody({ businessName: content.brand.name, llmId: '<new per-client LLM>', voiceId: '<default voice>' });
    dryLog(`would create this client's OWN Retell LLM (cloned from the template's model + tools, never the template itself)`);
    dryLog(`  opening line (begin_message): "${llm.begin_message}"`);
    dryLog(`  prompt: the generator's — refused unless it carries the approved SMS consent ask word for word`);
    dryLog(`would POST https://api.retellai.com/create-agent for "${content.brand.name}", bound to that LLM`);
    dryLog(`  voicemail: ${agent.voicemail_option.action.type}; analysis fields: ${agent.post_call_analysis_data.map((x) => x.name).join(', ')}`);
    dryLog(`would record the new LLM id and agent id in ${clientDir}/.env.local`);
    return '<dry-run-agent-id>';
  }
  const apiKey = requireEnv('RETELL_API_KEY');
  const templateLlmId = requireEnv('RETELL_LLM_ID'); // used only as a config template (model + tools)
  const voiceId = requireEnv('RETELL_DEFAULT_VOICE_ID');
  const authHeaders = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };

  // For a retell-llm agent, the prompt lives on the LLM object — NOT on the agent.
  // Passing general_prompt to create-agent is silently ignored, which would make
  // every client share one LLM/prompt. So create a per-client LLM (cloning the
  // master template's model + tools) carrying this client's prompt, then bind the
  // agent to it. The LLM's begin_message is the fixed recording disclosure; the persona's own
  // greeting follows it and is baked into agentPrompt.
  // Adopt a per-client LLM a previous interrupted run already created.
  //
  // RETELL_LLM_ID is recorded immediately after creation, but the only reuse check used to be
  // on RETELL_AGENT_ID — so a run that died between creating the LLM and creating the agent
  // (a real window: that is two sequential API calls) would, on resume, create a SECOND LLM
  // and orphan the first. Each one carries a copy of the prompt, so the orphan is both clutter
  // and a second place the prompt could appear to live.
  //
  // Note the same key names the master template: `RETELL_LLM_ID` in the ROOT .env is the
  // template to clone from, while `RETELL_LLM_ID` in the CLIENT .env.local is this client's own
  // LLM. readEnvLocal only ever reads the latter.
  let clientLlmId = readEnvLocal(clientDir).RETELL_LLM_ID || null;
  // Never adopt the master template as this client's "own" LLM. A .env.local that names it (copied
  // from the root, or hand-edited) would bind the new agent to the master — the growth fixture's
  // agent ran exactly that way until 2026-11-04, so its prompt was every client's template.
  if (clientLlmId && clientLlmId === templateLlmId) {
    console.warn(`  ⚠ ${basename(clientDir)}/.env.local names the MASTER LLM as its own — creating a per-client LLM instead.`);
    clientLlmId = null;
  }
  if (clientLlmId) {
    const check = await fetch(`https://api.retellai.com/get-retell-llm/${clientLlmId}`, { headers: authHeaders });
    if (check.ok) {
      console.log(`  Reusing per-client LLM ${clientLlmId} from an earlier interrupted run`);
    } else if (check.status === 404) {
      console.warn(`  ⚠ Saved RETELL_LLM_ID ${clientLlmId} no longer exists in Retell (404) — creating a fresh one.`);
      clientLlmId = null;
    } else {
      fail(7, `Retell get-retell-llm for ${clientLlmId} returned ${check.status}: ${await check.text()}`);
    }
  }

  if (!clientLlmId) {
    const tplRes = await fetch(`https://api.retellai.com/get-retell-llm/${templateLlmId}`, { headers: authHeaders });
    if (!tplRes.ok) fail(7, `Retell get-retell-llm (template ${templateLlmId}) returned ${tplRes.status}: ${await tplRes.text()}`);
    const tpl = await tplRes.json();

    const llmRes = await fetch('https://api.retellai.com/create-retell-llm', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(clientLlmCreateBody({ tpl, agentPrompt, businessName: content.brand.name })),
    });
    if (!llmRes.ok) fail(7, `Retell create-retell-llm returned ${llmRes.status}: ${await llmRes.text()}`);
    const llmData = await llmRes.json();
    clientLlmId = llmData.llm_id;
    if (!clientLlmId) fail(7, `Retell create-retell-llm response missing llm_id: ${JSON.stringify(llmData)}`);
    console.log(`  Per-client LLM: ${clientLlmId}`);
    patchEnvLocal(clientDir, 'RETELL_LLM_ID', clientLlmId);
  }

  // Belt and braces: whatever happened above, the agent never binds to the template.
  if (clientLlmId === templateLlmId) fail(7, 'refusing to bind a client agent to the MASTER Retell LLM');

  const res = await fetch('https://api.retellai.com/create-agent', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(clientAgentCreateBody({ businessName: content.brand.name, llmId: clientLlmId, voiceId })),
  });

  if (!res.ok) fail(7, `Retell create-agent returned ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const agentId = data.agent_id;
  if (!agentId) fail(7, `Retell response missing agent_id: ${JSON.stringify(data)}`);
  console.log(`  Agent: ${agentId}`);
  patchEnvLocal(clientDir, 'RETELL_AGENT_ID', agentId);
  return agentId;
}

// ───────────────────────────────────────────────────────────────────────────
// Step 8a: Provision a JDD-owned Twilio number with custom call routing.
//
// Inbound calls → /api/voice on the client site → tries CLIENT_FORWARD_PHONE
// first (25s), then falls back to the Retell AI agent. The number is stored as
// TWILIO_NUMBER and used by /api/contact as the from_number for the outbound
// lead callback (create-phone-call). voiceUrl uses the permanent .vercel.app URL.
// ───────────────────────────────────────────────────────────────────────────

async function provisionTwilioNumber(content, siteSlug, clientDir) {
  log(8, `Provision JDD Twilio number (human-first routing → Retell fallback)`);
  const existingNumber = readEnvLocal(clientDir).TWILIO_NUMBER;
  if (existingNumber) {
    console.log(`  Reusing existing number ${existingNumber} (skipping purchase)`);
    return existingNumber;
  }
  if (DRY_RUN) {
    const dryHost = vercelAppHost(siteSlug);
    dryLog(`would search Twilio for local number (area code from brand.phone) then toll-free`);
    dryLog(`would purchase number and set voiceUrl → https://${dryHost}.vercel.app/api/voice`);
    dryLog(`would patch TWILIO_NUMBER into ${clientDir}/.env.local`);
    return '<dry-run-number>';
  }

  const accountSid = requireEnv('TWILIO_ACCOUNT_SID');
  const authToken  = requireEnv('TWILIO_AUTH_TOKEN');
  const client     = twilio(accountSid, authToken);
  // The Vercel alias for this project. Vercel REMOVES characters that aren't valid in a
  // DNS label rather than substituting hyphens for them — see vercelAppHost. The number is
  // bought before the project exists, so this is derived; step 9 re-checks it against the
  // real host once Vercel can answer.
  const vercelHost = vercelAppHost(siteSlug);
  const voiceUrl   = `https://${vercelHost}.vercel.app/api/voice`;

  // We buy LOCAL numbers only, never toll-free. A toll-free number cannot join the A2P 10DLC
  // Messaging Service, so its texts fail with 30034 until a separate Toll-Free Verification
  // clears (1–3 weeks) — a client provisioned that way is silently textless. A local number in
  // the client's region joins the campaign immediately, so SMS works the day we provision.
  //
  // Search is geography-first: ZIP from the business address, then the brand-phone area code
  // if it's one we serve, then the configured defaults (Central FL / Orlando metro by default),
  // then anywhere in the default region. Region + area codes are env-driven so expanding beyond
  // Florida later is a config edit, not a code change.
  const allowedAreaCodes = (process.env.TWILIO_DEFAULT_AREA_CODES || '407,321,689')
    .split(',').map((s) => s.trim()).filter(Boolean);
  const defaultRegion = process.env.TWILIO_DEFAULT_REGION || 'FL';

  const addressText = content.brand?.address || content.brand?.contactDetails?.address || '';
  const zip = (addressText.match(/\b\d{5}\b/) || [])[0] || null;
  const phoneDigits = (content.brand.phone || '').replace(/\D/g, '');
  const phoneAreaCode = phoneDigits.length >= 10 ? phoneDigits.slice(-10, -7) : null;

  // Priority-ordered search strategies; first hit wins. Labels are for the log.
  const strategies = [];
  if (zip) strategies.push({ label: `ZIP ${zip}`, query: { inPostalCode: zip } });
  if (phoneAreaCode && allowedAreaCodes.includes(phoneAreaCode)) {
    strategies.push({ label: `area code ${phoneAreaCode} (brand phone)`, query: { areaCode: phoneAreaCode } });
  }
  for (const ac of allowedAreaCodes) {
    strategies.push({ label: `area code ${ac}`, query: { areaCode: ac } });
  }
  strategies.push({ label: `region ${defaultRegion}`, query: { inRegion: defaultRegion } });

  let numberRecord = null;
  for (const { label, query } of strategies) {
    console.log(`  Searching for a local number by ${label}…`);
    let results;
    try {
      results = await client.availablePhoneNumbers('US').local.list({ ...query, limit: 1 });
    } catch (err) {
      // Twilio's SDK throws a RestException here. Left uncaught it reaches the top as
      // "unhandled error in onboard.js" plus a stack trace through the SDK's internals, which
      // tells an operator nothing about the cause — and this is the first Twilio call in the
      // run, so it is where an account-level problem lands. 20003 is authentication failure,
      // which covers both a bad token and a live-but-suspended account.
      if (err?.code === 20003 || err?.status === 401) {
        fail(8,
          `Twilio rejected the request while searching for a number: ${err.message}\n` +
          '    If it says the account is "not active", the account is suspended or closed — settle ' +
          'billing or clear the verification hold in the Twilio Console, then re-run. The Retell ' +
          'agent and repo from this run are preserved and will be reused.');
      }
      fail(8, `Twilio number search failed (${label}): ${err?.message ?? err}`, err);
    }
    if (results.length) {
      numberRecord = await client.incomingPhoneNumbers.create({
        phoneNumber: results[0].phoneNumber,
        voiceUrl,
        voiceMethod: 'POST',
      });
      console.log(`  Purchased local number ${numberRecord.phoneNumber} (${label})`);
      break;
    }
  }

  if (!numberRecord) {
    fail(8,
      `No local US number available (tried ${strategies.map((s) => s.label).join(', ')}). ` +
      'We never fall back to toll-free — it cannot join the A2P campaign. Widen ' +
      'TWILIO_DEFAULT_AREA_CODES / TWILIO_DEFAULT_REGION in .env and re-run.');
  }

  const number = numberRecord.phoneNumber;
  patchEnvLocal(clientDir, 'TWILIO_NUMBER', number);

  // The number must live in the A2P Messaging Service or its texts are unregistered-sender
  // sends (30034). preflight already hard-failed if this client wants SMS without the SID; a
  // client with no SMS consent doesn't need the pool, so the SID is optional here.
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  if (messagingServiceSid) {
    try {
      await client.messaging.v1
        .services(messagingServiceSid)
        .phoneNumbers.create({ phoneNumberSid: numberRecord.sid });
    } catch (err) {
      // "already in service" is fine; anything else we surface via the verify below.
      if (!/already/i.test(err?.message || '')) {
        console.warn(`  ⚠ Adding ${number} to Messaging Service raised: ${err.message}`);
      }
    }
    // Trust nothing: read the pool back and confirm the number actually landed. A 200 from
    // create is not proof it stuck, and "we think SMS works" is exactly the silent failure
    // this whole change exists to kill.
    const pool = await client.messaging.v1.services(messagingServiceSid).phoneNumbers.list({ limit: 1000 });
    const joined = pool.some((p) => p.sid === numberRecord.sid || p.phoneNumber === number);
    if (!joined) {
      fail(8,
        `Bought ${number} but it did not land in Messaging Service ${messagingServiceSid}'s sender pool — ` +
        'SMS from it would fail with 30034. Add it by hand (Twilio Console → Messaging → Services → ' +
        'Sender Pool) and re-run, or investigate the API error above. No SMS was wired.');
    }
    console.log(`  Added ${number} to A2P Messaging Service ${messagingServiceSid} (verified in pool)`);
  } else {
    console.log(`  TWILIO_MESSAGING_SERVICE_SID not set — skipping A2P pool join (this client sends no SMS).`);
  }

  return number;
}

// ───────────────────────────────────────────────────────────────────────────
// Step 8b: Create Airtable base (shared for Enterprise)
// ───────────────────────────────────────────────────────────────────────────

/**
 * The value written into the Call Log's `Site` column for one site.
 *
 * This is the **provisioning slug**, not brand.short. The portal filters call rows with
 * `row.Site === site.slug` (CallsSection), so anything else silently filters every row out.
 */
function siteTagFor(baseSlug, intake, i) {
  return isMultiSite(intake) ? siteSlugFor(baseSlug, intake, i) : null;
}

/**
 * Widen an existing base's `Site` choices to cover every current site.
 *
 * Matters when an enterprise client adds a location after first provisioning: the base
 * already exists so createAirtableBase short-circuits, and Make would then write a value
 * that isn't a valid singleSelect option. Best-effort — the PAT may not carry
 * `schema.bases:write`, and a missing choice is not worth aborting a run over.
 */
async function ensureSiteChoices(baseId, tags) {
  const wanted = tags.filter(Boolean);
  if (!wanted.length) return;
  if (DRY_RUN) {
    dryLog(`would ensure base ${baseId} Site choices cover: ${wanted.join(', ')}`);
    return;
  }
  const apiKey = process.env.AIRTABLE_API_KEY;
  if (!apiKey) return;
  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };

  try {
    const res = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, { headers });
    if (!res.ok) {
      console.warn(`  ⚠ Could not read base ${baseId} schema (${res.status}) — skipping Site choice check.`);
      return;
    }
    const { tables } = await res.json();
    const table = (tables ?? []).find((t) => t.name === 'Call Log');
    const field = (table?.fields ?? []).find((f) => f.name === 'Site');
    if (!table || !field) {
      console.warn(`  ⚠ Base ${baseId} has no Call Log."Site" field — enterprise call rows will not be separable by site.`);
      return;
    }
    const existing = (field.options?.choices ?? []).map((c) => c.name);
    const missing = wanted.filter((t) => !existing.includes(t));
    if (!missing.length) return;

    const patch = await fetch(
      `https://api.airtable.com/v0/meta/bases/${baseId}/tables/${table.id}/fields/${field.id}`,
      {
        method: 'PATCH',
        headers,
        // Airtable rejects a choices array that drops existing options, so send the union.
        body: JSON.stringify({
          options: { choices: [...(field.options?.choices ?? []), ...missing.map((name) => ({ name }))] },
        }),
      },
    );
    if (!patch.ok) {
      console.warn(`  ⚠ Could not add Site choices ${missing.join(', ')} (${patch.status}) — add them by hand in Airtable.`);
      return;
    }
    console.log(`  Added Site choices: ${missing.join(', ')}`);
  } catch (err) {
    console.warn(`  ⚠ Site choice check failed (${err?.message ?? err}) — continuing.`);
  }
}

/**
 * Read one base's `Call Log` schema as both directions of a name↔field-id map.
 *
 * Airtable table and field ids are **base-scoped**: `tbl3YWgGdVXNPz3Eg` and every `fld…`
 * in the master scenario's Airtable module belong to the master base alone. Cloning the
 * scenario and swapping only `mapper.base` left the module pointed at a table id that does
 * not exist in the client's new base, so every post-call write failed — the scenario looked
 * healthy and the call log stayed empty. Column *names* are the only stable join between
 * the two bases, so the blueprint patch translates master-id → name → client-id.
 *
 * Returns null if the schema can't be read, which the caller treats as "don't touch the
 * Airtable module" rather than guessing at ids.
 */
async function airtableFieldMap(baseId) {
  const apiKey = process.env.AIRTABLE_API_KEY;
  if (!apiKey || !baseId) return null;
  try {
    const res = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      console.warn(`  ⚠ Could not read base ${baseId} schema (${res.status}).`);
      return null;
    }
    const table = ((await res.json()).tables ?? []).find((t) => t.name === 'Call Log');
    if (!table) {
      console.warn(`  ⚠ Base ${baseId} has no "Call Log" table.`);
      return null;
    }
    const byName = {};
    const byId = {};
    // singleSelect choices, by column name. Needed because a choice the master writes but the
    // client base lacks is rejected as an invalid option under `typecast: false` — and that
    // rejects the ENTIRE row, not just the cell. This is why `Call type` is lowercase.
    const choices = {};
    for (const f of table.fields ?? []) {
      byName[f.name] = f.id;
      byId[f.id] = f.name;
      if (Array.isArray(f.options?.choices)) {
        choices[f.name] = f.options.choices.map((c) => c.name);
      }
    }
    return { tableId: table.id, byName, byId, choices };
  } catch (err) {
    console.warn(`  ⚠ Base ${baseId} schema read failed (${err?.message ?? err}).`);
    return null;
  }
}

// The Call Log columns live in lib/call-log-fields.js — one copy, shared with lib/repair-ops.js.

async function createAirtableBase(intake, primaryContent, clientDir, baseSlug) {
  const siteTags = intake.sites.map((_, i) => siteTagFor(baseSlug, intake, i));
  const existingBaseId = readEnvLocal(clientDir).AIRTABLE_BASE_ID;
  if (existingBaseId) {
    log(8, `Reusing existing Airtable base ${existingBaseId} (skipping create)`);
    await ensureSiteChoices(existingBaseId, siteTags);
    return existingBaseId;
  }
  const isEnterprise = isMultiSite(intake);
  const baseLabel = isEnterprise
    ? `${primaryContent.brand.name} — Calls (${intake.sites.length} sites)`
    : `${primaryContent.brand.name} — Calls`;
  log(8, `Create Airtable base "${baseLabel}"`);
  if (DRY_RUN) {
    dryLog(`would create Airtable base "${baseLabel}" with Call Log table`);
    if (isEnterprise) {
      dryLog(`  + Site singleSelect column with choices: ${siteTags.filter(Boolean).join(', ')}`);
    }
    dryLog(`would patch AIRTABLE_BASE_ID into ${clientDir}/.env.local`);
    return '<dry-run-base-id>';
  }
  const apiKey = requireEnv('AIRTABLE_API_KEY');
  const workspaceId = requireEnv('AIRTABLE_WORKSPACE_ID');

  const fields = [...CALL_LOG_FIELDS];

  if (isEnterprise) {
    fields.push({
      name: 'Site',
      type: 'singleSelect',
      options: {
        // Provisioning slugs, NOT brand.short — the portal matches these against site.slug.
        choices: siteTags.filter(Boolean).map((name) => ({ name })),
      },
    });
  }

  const res = await fetch('https://api.airtable.com/v0/meta/bases', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: baseLabel,
      workspaceId,
      tables: [{ name: 'Call Log', fields }],
    }),
  });

  if (!res.ok) fail(8, `Airtable create-base returned ${res.status}: ${await res.text()}`);
  const { id: baseId } = await res.json();
  console.log(`  Airtable base: ${baseId}`);
  patchEnvLocal(clientDir, 'AIRTABLE_BASE_ID', baseId);
  return baseId;
}

// ───────────────────────────────────────────────────────────────────────────
// Step 8c: Clone the master post-call scenario for THIS client, point its
// Airtable + Twilio SMS modules at this client, activate it, and set the
// clone's webhook URL as the Retell agent's post-call webhook.
//
// Replaces the old shared-scenario + data-store approach. Idempotent: if the
// client already has RETELL_POST_CALL_WEBHOOK_URL, we reuse it and skip cloning.
// ───────────────────────────────────────────────────────────────────────────

const MAKE_ZONE = 'https://us2.make.com/api/v2';

/**
 * Is this `/scenarios/{id}/start` response Make's way of saying "it was already on"?
 *
 * Adoption rests on everything after the clone being safe to repeat, and the comment above the
 * adoption branch used to assert that `/start` on a running scenario is a no-op. It is not.
 * Make answers:
 *
 *   422 {"detail":"Scenario is already running.","message":"Scenario is already running (on
 *        start attempt)","code":"IM306"}
 *
 * which `if (!res.ok) fail(...)` turned into a fatal run. That is the *expected* reply in the
 * commonest adoption case of all — a run that died after activating the clone, which is
 * exactly the shape of failure adoption exists to recover from. So the resume fix could not
 * work until this did: the first run to successfully adopt died on the next line.
 *
 * Matched on the `IM306` code rather than the prose, and narrowed to 422, so a genuine refusal
 * to start (a disabled scenario, a revoked token, an unpayable account) still fails loudly.
 *
 * Exported for `test/checks-env.test.mjs`, which asserts it against the verbatim body a live
 * run recorded — a hand-written one would only encode the belief that produced the bug.
 */
export function isScenarioAlreadyRunning(status, body) {
  return status === 422 && /"code"\s*:\s*"IM306"/.test(String(body ?? ''));
}

async function cloneAndWirePostCall(agentId, content, clientDir, baseId, siteTag) {
  log(8, `Clone post-call Make scenario + wire Retell webhook`);

  const existing = readEnvLocal(clientDir).RETELL_POST_CALL_WEBHOOK_URL;
  if (existing) {
    console.log(`  Reusing existing post-call webhook ${existing} (skipping clone)`);
    return existing;
  }

  const apiKey   = process.env.MAKE_API_KEY;
  const masterId = process.env.MAKE_POST_CALL_MASTER_SCENARIO_ID;
  // The owner's end-of-call text is NOT sent by Make. The clone's HTTP module posts the call to
  // the agency's /api/ingest/call, which reads the owner's SMS consent at send time and texts
  // from the JDD notification number. It used to be a Twilio module whose `to`, `from` and very
  // existence were decided here, at onboarding, and never re-read — so an owner who opted in
  // through the portal afterwards was never texted (the growth fixture's clone had no Twilio
  // module at all on 2026-11-03), and one who revoked kept being texted.
  //
  // The module authenticates with this site's own LEAD_INGEST_TOKEN, the one /api/contact
  // already uses, so the agency resolves the account from the token and a clone can only ever
  // brief its own owner. It is a credential: it goes into the clone and is never printed.
  const ingestToken = readEnvLocal(clientDir).LEAD_INGEST_TOKEN || '';
  if (ingestToken) {
    console.log(`  Owner brief: posted to the agency, authenticated with this site's LEAD_INGEST_TOKEN`);
  } else if (!DRY_RUN) {
    // A dry run writes no .env.local, so a fresh client has no token on disk yet — step 5 of a
    // real run mints it before this. Warning there would describe a run that cannot happen.
    console.warn(`  ⚠ No LEAD_INGEST_TOKEN in ${basename(clientDir)}/.env.local — the HTTP module is removed and the owner gets no end-of-call text.`);
  }

  if (!apiKey || !masterId) {
    console.warn(`  ⚠ MAKE_API_KEY or MAKE_POST_CALL_MASTER_SCENARIO_ID not set — skipping post-call clone.`);
    console.warn(`    Clone by hand: base=${baseId}, agent=${agentId}, HTTP module header = this site's LEAD_INGEST_TOKEN`);
    return null;
  }
  if (DRY_RUN) {
    const adopting = readEnvLocal(clientDir).MAKE_POST_CALL_SCENARIO_ID;
    if (adopting) {
      dryLog(`would ADOPT scenario ${adopting} from an earlier interrupted run (no new clone)`);
    } else {
      // Resolve and show the actual clone parameters. A dry run that said only "would clone"
      // is a dry run that could not have caught the 400 this step died on: teamId, states and
      // organizationId were all missing, and none of them were visible anywhere.
      const master = await resolveMasterResources();
      const teamId = master?.teamId ?? null;
      const organizationId = master?.organizationId ?? null;
      const masterHookId = master?.hookId ?? null;
      const existingHook = readEnvLocal(clientDir).MAKE_POST_CALL_HOOK_ID;
      // "would clone scenario 5315889" read as though 5315889 were the clone. It is the
      // SOURCE — saying so avoids sending someone to Make looking for a scenario by that id.
      dryLog(`would clone FROM master scenario ${masterId} → new scenario "Post-call: ${content.brand.name}"`);
      dryLog(existingHook
        ? `would reuse webhook ${existingHook} recorded by an earlier run`
        : `would first create a gateway-webhook for this client (master's hook ${masterHookId} stays with the master)`);
      if (typeof teamId === 'number' && typeof organizationId === 'number') {
        dryLog(`  POST /scenarios/${masterId}/clone?organizationId=${organizationId} body { teamId: ${teamId}, states: false, hook: { ${masterHookId}: <new> } }`);
      } else {
        console.warn(`  ⚠ Could not resolve teamId/organizationId (got ${teamId}/${organizationId}) — a real run would fail here.`);
        console.warn('    The clone endpoint requires both as integers; check MAKE_API_KEY can read the master scenario and its hook.');
      }
    }
    dryLog(`would repoint Airtable module at base=${baseId}, remapping its table + field ids by column name`);
    if (siteTag) dryLog(`  + Site="${siteTag}" written into mapper.record (not as a top-level mapper key)`);
    dryLog(`would REMOVE the vestigial datastore module, carrying its event filter forward`);
    dryLog(`would set the HTTP module's Authorization to this site's LEAD_INGEST_TOKEN (not printed), and drop any Twilio module`);
    dryLog(`would activate clone, resolve webhook via scenario.hookId → /hooks/{id}, set Retell agent ${agentId} webhook_url`);
    return null;
  }

  const headers = { Authorization: `Token ${apiKey}`, 'Content-Type': 'application/json' };

  // 1) Clone the master scenario — or adopt the clone a previous interrupted run already made.
  //
  // The clone id is recorded the instant it exists, because the six calls that follow (patch
  // blueprint, read scenario, read hook, activate, re-point the agent, record the webhook) are
  // all places a run can die. Before this, the only "already done" marker was
  // RETELL_POST_CALL_WEBHOOK_URL, written LAST — so a failure anywhere in between orphaned a
  // possibly-already-active clone and the next run made another, with no dedupe. Several live
  // scenarios on one Airtable base means duplicate rows for every call.
  //
  // Everything after the clone is safe to repeat, which is what makes adoption sound: patching
  // the blueprint is idempotent, and re-pointing the agent webhook writes the same value.
  //
  // `/start` is the exception, and this comment used to get it wrong by calling it a no-op.
  // Make returns 422 IM306 "Scenario is already running", which is why the first run that
  // actually adopted still died — see `isScenarioAlreadyRunning` above.
  let cloneId = readEnvLocal(clientDir).MAKE_POST_CALL_SCENARIO_ID || null;
  let res;

  if (cloneId) {
    console.log(`  Adopting scenario ${cloneId} from an earlier interrupted run (not cloning again)`);
  } else {
    // `teamId` (integer, body), `states` (boolean, body) and `organizationId` (integer, query)
    // are REQUIRED by POST /scenarios/{id}/clone. Omitting them is what produced
    //   400 SC400 [{"Expected required property"},{"Expected integer"}]
    // on a live run. Both ids come from the master's own hook record, so there is no second
    // place for them to go stale. `states: false` resets module state — a fresh client clone
    // must not inherit the master's.
    const master = await resolveMasterResources();
    const teamId = master?.teamId ?? null;
    const organizationId = master?.organizationId ?? null;
    const masterHookId = master?.hookId ?? null;
    if (typeof teamId !== 'number' || typeof organizationId !== 'number') {
      fail(8,
        `Cannot clone: Make did not report a numeric teamId/organizationId for master scenario ${masterId} ` +
        `(got teamId=${teamId}, organizationId=${organizationId}). The clone endpoint requires both as ` +
        'integers, so attempting it would 400. Check MAKE_API_KEY can read the master scenario and its hook.');
    }
    if (!masterHookId) {
      fail(8, `Cannot clone: master scenario ${masterId} reports no hookId, so there is no trigger to remap.`);
    }

    /**
     * Give the clone its OWN webhook, and tell Make to substitute it.
     *
     * A webhook-triggered scenario cannot simply be duplicated: without a `hook` mapping Make
     * tries to attach the clone to the MASTER's hook, which already belongs to the master, and
     * refuses with `{"detail":"The hook already has a scenario assigned.","code":"IM000"}`.
     * That is also the definitive answer to a question left open earlier — a clone does NOT
     * get a fresh hook automatically. It errors loudly rather than silently sharing one.
     *
     * The settings mirror master hook 2421720 exactly (`method`/`headers`/`stringify` all
     * false). They are not cosmetic: they decide the shape of the payload the modules see, and
     * every mapping in the blueprint reads `{{1.call.…}}` straight off the parsed JSON body.
     * Turning on `headers` or `method` would shift that structure; `stringify` would hand the
     * modules a string instead of an object.
     *
     * Recorded before the clone is attempted, for the same reason the clone id is: creating a
     * hook and then failing would otherwise orphan it, and the next run would make another.
     */
    let cloneHookId = readEnvLocal(clientDir).MAKE_POST_CALL_HOOK_ID || null;
    if (cloneHookId) {
      console.log(`  Reusing hook ${cloneHookId} from an earlier interrupted run`);
    } else {
      const hookRes = await fetch(`${MAKE_ZONE}/hooks`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: `Post-call: ${content.brand.name}`.slice(0, 128), // Make caps hook names at 128
          teamId: String(teamId), // documented as a STRING here, unlike the integer the clone wants
          typeName: 'gateway-webhook',
          method: false,
          headers: false,
          stringify: false,
        }),
      });
      if (!hookRes.ok) fail(8, `Make create-hook returned ${hookRes.status}: ${await hookRes.text()}`);
      cloneHookId = (await hookRes.json())?.hook?.id;
      if (!cloneHookId) fail(8, `Make create-hook response missing hook id`);
      patchEnvLocal(clientDir, 'MAKE_POST_CALL_HOOK_ID', cloneHookId);
      console.log(`  Created webhook ${cloneHookId} for this client (recorded before cloning)`);
    }

    res = await fetch(`${MAKE_ZONE}/scenarios/${masterId}/clone?organizationId=${organizationId}`, {
      method: 'POST', headers,
      body: JSON.stringify({
        name: `Post-call: ${content.brand.name}`.slice(0, 120), // Make caps the name at 120 chars
        teamId,
        states: false,
        // Substitute the master's trigger hook with this client's own.
        hook: { [String(masterHookId)]: cloneHookId },
      }),
    });
    if (!res.ok) fail(8, `Make clone returned ${res.status}: ${await res.text()}`);
    cloneId = (await res.json())?.scenario?.id;
    if (!cloneId) fail(8, `Make clone response missing scenario id`);

    // Recorded FIRST, before anything else can fail.
    patchEnvLocal(clientDir, 'MAKE_POST_CALL_SCENARIO_ID', cloneId);
    console.log(`  Cloned scenario ${cloneId} (recorded, so a failed run resumes rather than re-clones)`);
  }

  // 2) GET the clone's blueprint, patch per-client values, PATCH it back. Safe to repeat on a
  //    resume: the patch is computed from the master's shape and this client's ids either way.
  res = await fetch(`${MAKE_ZONE}/scenarios/${cloneId}/blueprint`, { headers });
  if (!res.ok) fail(8, `Make get-blueprint returned ${res.status}: ${await res.text()}`);
  const blueprint = (await res.json())?.response?.blueprint;

  // The clone still carries the MASTER base's table/field ids. Resolve both schemas so the
  // patch can translate them by column name; the master base id is whatever the inherited
  // Airtable module currently points at, so we never hardcode it.
  const masterBaseId = (blueprint?.flow ?? []).find((m) => (m.module ?? '').startsWith('airtable'))?.mapper?.base;
  const [masterMap, clientMap] = await Promise.all([
    airtableFieldMap(masterBaseId),
    airtableFieldMap(baseId),
  ]);

  patchPostCallBlueprint(blueprint, {
    baseId, siteTag, ingestToken, masterMap, clientMap,
  }); // mutates in place

  res = await fetch(`${MAKE_ZONE}/scenarios/${cloneId}`, {
    method: 'PATCH', headers,
    body: JSON.stringify({ blueprint: JSON.stringify(blueprint) }),
  });
  if (!res.ok) fail(8, `Make patch-blueprint returned ${res.status}: ${await res.text()}`);

  // 3) Resolve the clone's webhook URL.
  //
  // There is no `GET /scenarios/{id}/hooks` in Make API v2 — it 404s, which made this step
  // fail on every single run (after the clone had already been created, so each attempt
  // orphaned a scenario). The scenario record itself carries `hookId`; the hook's url comes
  // from `GET /hooks/{hookId}`.
  res = await fetch(`${MAKE_ZONE}/scenarios/${cloneId}`, { headers });
  if (!res.ok) fail(8, `Make get-scenario returned ${res.status}: ${await res.text()}`);
  const hookId = (await res.json())?.scenario?.hookId;
  if (!hookId) fail(8, `Clone ${cloneId} has no hookId — is the master still webhook-triggered?`);

  res = await fetch(`${MAKE_ZONE}/hooks/${hookId}`, { headers });
  if (!res.ok) fail(8, `Make get-hook ${hookId} returned ${res.status}: ${await res.text()}`);
  const webhookUrl = (await res.json())?.hook?.url;
  if (!webhookUrl) fail(8, `Hook ${hookId} returned no url`);

  // A clone that inherits the master's hook would put every client on one webhook, which is
  // worth catching loudly rather than discovering through crossed-over call logs.
  if (hookId === Number(process.env.MAKE_POST_CALL_MASTER_HOOK_ID)) {
    fail(8, `Clone ${cloneId} reuses the master's hook ${hookId} — refusing to share a webhook across clients.`);
  }

  // 4) Activate the clone. An unchecked failure here is the worst outcome available: Make
  // accepts posts to an inactive scenario's webhook and discards them, so the agent, the
  // number and the webhook all look wired while no call is ever logged.
  res = await fetch(`${MAKE_ZONE}/scenarios/${cloneId}/start`, { method: 'POST', headers });
  if (res.ok) {
    console.log(`  Activated clone; webhook ${webhookUrl}`);
  } else {
    const body = await res.text();
    if (!isScenarioAlreadyRunning(res.status, body)) {
      fail(8, `Make start-scenario returned ${res.status}: ${body}`);
    }
    console.log(`  Clone ${cloneId} was already running — adopted as active; webhook ${webhookUrl}`);
  }

  // 5) Wire the webhook onto the Retell agent's post-call webhook.
  const retell = await fetch(`https://api.retellai.com/update-agent/${agentId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${process.env.RETELL_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ webhook_url: webhookUrl }),
  });
  if (!retell.ok) fail(8, `Retell update-agent (webhook_url) returned ${retell.status}: ${await retell.text()}`);

  patchEnvLocal(clientDir, 'RETELL_POST_CALL_WEBHOOK_URL', webhookUrl);
  console.log(`  Wired Retell agent ${agentId} → post-call webhook`);
  return webhookUrl;
}

// Rewrites the cloned blueprint's Airtable + HTTP modules for this client.
// Modules are matched by app name so it survives module-id changes on clone.
//
// Mapper key shapes below were confirmed against a live GET of the master blueprint:
//   airtable:ActionCreateRecord → { base, table, record: { <fldId>: <expr> }, typecast, useColumnId }
//   http:MakeRequest (v4)       → { url, method, headers: [{ name, value }], contentType: "urlEncoded",
//                                   urlEncodedBodyContent: [{ name, value }], stopOnHttpError, … }
// The HTTP module was built in the Make UI and recorded (2026-11-03), never written from memory:
// with nothing filled in it saves with NO mapper at all, which is how a guessed shape would fail.
// Note that Airtable column values live inside `record`, keyed by field id — NOT as
// top-level mapper keys. An earlier version set `mapper.Site`, a key the module does not
// read, so the enterprise per-site tag was never written and the portal (which filters on
// `row.Site === site.slug`) showed no calls at all for a multi-site client.
function patchPostCallBlueprint(
  blueprint,
  { baseId, siteTag, ingestToken, masterMap, clientMap, quiet = false },
) {
  // `quiet` is for the dry-run preview, which patches a throwaway copy purely to inspect it.
  // Announcing "Removed 1 datastore module(s) from the clone" when no clone exists would be
  // the kind of confidently-wrong log line this whole exercise is about removing.
  const say = quiet ? () => {} : (m) => console.log(m);
  const warn = quiet ? () => {} : (m) => console.warn(m);
  const flows = blueprint?.flow ?? [];
  for (const mod of flows) {
    const app = mod.module ?? '';
    if (app.startsWith('airtable')) {
      mod.mapper = mod.mapper ?? {};
      mod.mapper.base = baseId;

      if (masterMap && clientMap) {
        mod.mapper.table = clientMap.tableId;

        // Translate every record key master-fld-id → column name → client-fld-id. A column
        // the client base lacks is dropped with a warning rather than left pointing at a
        // foreign id, because one unresolvable key fails the entire row, not just that cell.
        const remapped = {};
        const dropped = [];
        for (const [masterFld, expr] of Object.entries(mod.mapper.record ?? {})) {
          const name = masterMap.byId[masterFld];
          const clientFld = name ? clientMap.byName[name] : undefined;
          if (clientFld) remapped[clientFld] = expr;
          else dropped.push(name ?? masterFld);
        }

        // Enterprise per-site tag, written the way every other column is.
        if (siteTag) {
          const siteFld = clientMap.byName.Site;
          if (siteFld) remapped[siteFld] = siteTag;
          else warn(`  ⚠ Base ${baseId} has no "Site" column — per-site call filtering will not work.`);
        }

        mod.mapper.record = remapped;
        if (dropped.length) {
          warn(`  ⚠ Dropped unmapped Airtable column(s): ${dropped.join(', ')} — add them to createAirtableBase.`);
        }
        say(`  Airtable module → base ${baseId}, table ${clientMap.tableId}, ${Object.keys(remapped).length} field(s)`);
      } else {
        warn(`  ⚠ Could not resolve Airtable schemas — left table/field ids pointing at the master base.`);
        warn(`    Fix the Airtable module by hand in the clone, or post-call rows will not be written.`);
      }
    }
    // The owner brief: the master carries a placeholder Authorization header, and each clone
    // gets its own site's token. Any existing Authorization is replaced rather than appended, so
    // the master's placeholder never rides along beside the real one.
    if (app.startsWith('http') && ingestToken) {
      mod.mapper = mod.mapper ?? {};
      const others = (Array.isArray(mod.mapper.headers) ? mod.mapper.headers : [])
        .filter((h) => String(h?.name ?? '').toLowerCase() !== 'authorization');
      mod.mapper.headers = [...others, { name: 'Authorization', value: `Bearer ${ingestToken}` }];
    }
  }

  // The master still carries a `datastore:GetRecord` ("retell-agent-lookup", keyed on
  // {{1.call.agent_id}}) from the superseded one-shared-scenario design, where the Airtable
  // base id was looked up per agent instead of baked into a per-client clone. Each clone
  // hardcodes its own base above, so the lookup is dead weight — and worse than inert: no
  // datastore record is ever written for a newly provisioned agent, and a GetRecord miss
  // emits no bundle, which halts the route before Airtable or Twilio ever run. Left in
  // place it would silently no-op every cloned scenario.
  //
  // Its `filter` must survive the removal, though. In a Make blueprint the filter sits on
  // the module it gates entry to, and this one carries `{{1.event}} = call_analyzed` —
  // Retell posts call_started and call_ended to the same webhook, so dropping the module
  // and its filter together would log three rows per call, two of them with no transcript
  // or summary. So the filter is carried forward onto the next module, unless that module has
  // its own, which then has to be complete (`postCallGateFilter`; checkConnectedCallsOnly runs it).
  if (Array.isArray(blueprint.flow)) {
    const kept = [];
    let carriedFilter = null;
    let removed = 0;
    for (const mod of blueprint.flow) {
      if ((mod.module ?? '').startsWith('datastore')) {
        carriedFilter = carriedFilter ?? mod.filter ?? null;
        removed += 1;
        continue;
      }
      if (carriedFilter) {
        if (!mod.filter) mod.filter = carriedFilter;
        carriedFilter = null;
      }
      kept.push(mod);
    }
    blueprint.flow = kept;
    if (removed > 0) {
      say(`  Removed ${removed} datastore module(s) from the clone (per-client base is hardcoded)`);
      if (carriedFilter) {
        warn(`  ⚠ Could not re-home the datastore module's event filter — the clone may log non-call_analyzed events.`);
      }
    }
  }

  // Make never texts the owner itself any more — the agency does, at send time, from the
  // owner's CURRENT consent. A Twilio module left in a clone (a master edited back, or a clone
  // re-patched from an old blueprint) would text them a second time, under consent decided at
  // onboarding. And an HTTP module with no token would 401 on every call, so it comes out too,
  // loudly, rather than looking wired.
  if (Array.isArray(blueprint?.flow)) {
    const before = blueprint.flow.length;
    blueprint.flow = blueprint.flow.filter((m) => !(m.module ?? '').startsWith('twilio'));
    const twilioRemoved = before - blueprint.flow.length;
    if (twilioRemoved > 0) say(`  Removed ${twilioRemoved} Twilio module(s) — the owner brief is sent by the agency, not Make`);
    if (!ingestToken) {
      const n = blueprint.flow.length;
      blueprint.flow = blueprint.flow.filter((m) => !(m.module ?? '').startsWith('http'));
      if (blueprint.flow.length < n) warn(`  ⚠ Removed the HTTP module — no LEAD_INGEST_TOKEN, so the owner gets no end-of-call text.`);
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Correctness checks
//
// The question a dry run should answer is not "would this provision?" but "would this
// provision CORRECTLY?" — the seven bugs that prompted this all left a run looking fine.
//
// The predicates live in lib/onboard-checks.js and are shared verbatim with test/*.test.mjs.
// That sharing is the design: a dry run with its own copy of the rules could bless a client
// the suite would reject, which is the same mistake as a mocked test certifying a 404.
// ───────────────────────────────────────────────────────────────────────────

/**
 * The master scenario's blueprint, hook, Airtable base, and the team/org ids a clone needs —
 * resolved once per run.
 *
 * Memoized because four callers want it (the pre-flight master-resource refusal, the clone
 * itself, the blueprint preview, and the per-site checks) and an enterprise run would
 * otherwise re-fetch the same endpoints for every site. The master is read-only in all of them.
 *
 * `teamId` and `organizationId` come free: the hook record already fetched here carries both,
 * and `POST /scenarios/{id}/clone` requires them. Taking them from the live hook rather than
 * from env means there is no second place for them to drift out of date.
 *
 * Returns null when credentials are missing or Make is unreachable, which every caller treats
 * as "could not check" rather than as a pass.
 */
let MASTER_RESOURCES;
/**
 * Why MASTER_RESOURCES is null, in words an operator can act on. The old warning said "no Make
 * credentials, or unreachable" for every failure — including a 429, where the credentials were
 * fine and Make was up. A diagnosis that names the wrong cause is worse than none.
 */
let MASTER_RESOURCES_REASON = null;
async function resolveMasterResources() {
  if (MASTER_RESOURCES !== undefined) return MASTER_RESOURCES;
  MASTER_RESOURCES = null;

  const apiKey = process.env.MAKE_API_KEY;
  const masterId = process.env.MAKE_POST_CALL_MASTER_SCENARIO_ID;
  if (!apiKey || !masterId) {
    MASTER_RESOURCES_REASON = 'MAKE_API_KEY or MAKE_POST_CALL_MASTER_SCENARIO_ID is not set in .env';
    return MASTER_RESOURCES;
  }

  const headers = { Authorization: `Token ${apiKey}` };
  // Every GET here goes through the retry: one 429 on any of the three used to null the whole
  // resolution, and every caller of this function — including the live clone — read that as
  // "Make is unreachable". Retries are announced on stderr so a pause is explained without
  // changing stdout, which the dry-run recordings are compared against byte for byte.
  const get = (url) =>
    fetchWithRetry(url, { headers }, {
      onRetry: ({ attempt, waitMs }) =>
        console.warn(`  … Make rate limit reached; waiting ${Math.round(waitMs / 1000)}s before retry ${attempt}`),
    });
  try {
    const bres = await get(`${MAKE_ZONE}/scenarios/${masterId}/blueprint`);
    if (!bres.ok) {
      MASTER_RESOURCES_REASON =
        bres.status === 429
          ? 'Make rate limit — the organization request limit was still exceeded after waiting out a full minute'
          : `Make returned ${bres.status} for the master blueprint`;
      return MASTER_RESOURCES;
    }
    const blueprint = (await bres.json())?.response?.blueprint;
    if (!blueprint?.flow) {
      MASTER_RESOURCES_REASON = 'the master blueprint came back with no modules';
      return MASTER_RESOURCES;
    }

    const masterBaseId =
      blueprint.flow.find((m) => (m.module ?? '').startsWith('airtable'))?.mapper?.base ?? null;

    // The master's own hook, so a client wired to it can be recognised — and the team/org ids
    // the clone endpoint requires, which the hook record happens to carry.
    let masterHookUrl = null;
    let teamId = null;
    let organizationId = null;
    const sres = await get(`${MAKE_ZONE}/scenarios/${masterId}`);
    const scenario = sres.ok ? (await sres.json())?.scenario : null;
    const hookId = scenario?.hookId ?? null;
    // The scenario record carries teamId directly; the hook record carries both.
    if (typeof scenario?.teamId === 'number') teamId = scenario.teamId;
    if (hookId) {
      const hres = await get(`${MAKE_ZONE}/hooks/${hookId}`);
      if (hres.ok) {
        const hook = (await hres.json())?.hook ?? {};
        masterHookUrl = hook.url ?? null;
        if (typeof hook.teamId === 'number') teamId = hook.teamId;
        if (typeof hook.organizationId === 'number') organizationId = hook.organizationId;
      }
    }

    MASTER_RESOURCES = { blueprint, masterBaseId, masterHookUrl, hookId, teamId, organizationId };
  } catch (err) {
    MASTER_RESOURCES = null; // offline: unknown, not broken
    MASTER_RESOURCES_REASON = `Make unreachable (${err?.cause?.code ?? err?.code ?? err?.message ?? 'network error'})`;
  }
  return MASTER_RESOURCES;
}

/**
 * Patch a THROWAWAY copy of the live master blueprint to see how it would come out.
 *
 * Read-only: reads the memoized master blueprint and both Airtable schemas, patches an
 * in-memory clone, and never touches Make. Returns null when credentials are absent, which the
 * checks surface as `?` rather than as a pass — CI has no secrets and must not read as
 * "verified".
 */
async function previewPostCallBlueprint({ baseId, siteTag, clientDir }) {
  if (!baseId) return null;
  const master = await resolveMasterResources();
  if (!master) return null;

  const { masterBaseId, masterHookUrl } = master;
  const [masterMap, clientMap] = await Promise.all([
    airtableFieldMap(masterBaseId),
    airtableFieldMap(baseId),
  ]);
  if (!masterMap || !clientMap) return { blueprint: null, masterBaseId, masterHookUrl, masterMap, clientMap };

  // Deep copy: the memoized blueprint is shared across sites, so patching it in place would
  // leak one site's base and Site tag into the next site's preview.
  const copy = JSON.parse(JSON.stringify(master.blueprint));
  patchPostCallBlueprint(copy, {
    baseId,
    siteTag,
    // The same token the live clone gets, so the check below judges what a real run would write.
    // It never leaves this process: the check reports whether it matches, not what it is.
    ingestToken: readEnvLocal(clientDir).LEAD_INGEST_TOKEN || '',
    masterMap,
    clientMap,
    quiet: true,
  });
  return { blueprint: copy, masterBaseId, masterHookUrl, masterMap, clientMap };
}

/**
 * Run every check for one site and print the report.
 *
 * Returns the summary. A failure is fatal on a real run (there is no reason to push a client
 * we already know is misconfigured) but only reported on a dry run, whose job is to list
 * everything wrong rather than stop at the first thing.
 */
async function runCorrectnessChecks({ envLines, plan, webOnly, twilioNumber, phoneSwap, baseId, siteTag, clientDir }) {
  log(8, `Correctness checks`);

  const checks = [
    checkEnvTierMatrix({ lines: envLines, plan, webOnly }),
    checkForwardNotSelf({ lines: envLines, twilioNumber }),
    checkSitePublishesTwilioNumber({ published: phoneSwap?.published ?? null, twilioNumber, webOnly }),
    checkForwardPreserved({ lines: envLines, previousPhone: phoneSwap?.previous ?? null, webOnly }),
  ];

  // Vendor-facing checks. Skipped wholesale for a web-only client, which has no call log.
  if (!webOnly) {
    const preview = await previewPostCallBlueprint({ baseId, siteTag, clientDir });
    checks.push(
      checkNotMasterBase({ clientBaseId: baseId, masterBaseId: preview?.masterBaseId ?? null }),
      // Re-verified here against what the run actually wired, not just what pre-flight saw —
      // cloneAndWirePostCall runs in between and is the thing that sets the agent's webhook.
      checkNotMasterHook({
        clientWebhookUrl: readEnvLocal(clientDir).RETELL_POST_CALL_WEBHOOK_URL,
        agentWebhookUrl: null, // the live agent is read at pre-flight; avoid a second GET per site
        masterHookUrl: preview?.masterHookUrl ?? null,
      }),
      checkBlueprintFieldsResolve({ blueprint: preview?.blueprint ?? null, clientMap: preview?.clientMap ?? null, siteTag }),
      checkBlueprintEventFilter({ blueprint: preview?.blueprint ?? null }),
      checkBlueprintNoDatastore({ blueprint: preview?.blueprint ?? null }),
      // Falls back to the master: the patch rewrites record keys, never the {{1.call.…}}
      // expressions, so the master answers this even before a client base exists to preview.
      // (Memoized — no extra request.) Field NAMES only, which do not depend on the business name.
      checkAnalysisCoversBlueprint({
        blueprint: preview?.blueprint ?? (await resolveMasterResources())?.blueprint ?? null,
        analysisData: buildPostCallAnalysisData(''),
      }),
      // The patched clone against the client base when both exist; otherwise the master against
      // its own base, which is where every clone's expressions come from.
      preview?.blueprint && preview?.clientMap
        ? checkSelectMappingsTotal({ blueprint: preview.blueprint, fieldMap: preview.clientMap })
        : checkSelectMappingsTotal({
            blueprint: (await resolveMasterResources())?.blueprint ?? null,
            fieldMap: preview?.masterMap ?? null,
          }),
      // The patched clone when there is one, else the master: the gate is carried, not rewritten.
      checkConnectedCallsOnly({
        blueprint: preview?.blueprint ?? (await resolveMasterResources())?.blueprint ?? null,
        cases: CALL_OUTCOME_CASES,
        shouldLog,
      }),
      checkOwnerBriefViaAgency({
        blueprint: preview?.blueprint ?? null,
        ingestToken: readEnvLocal(clientDir).LEAD_INGEST_TOKEN || '',
      }),
      // As with the selects: the patched clone when both exist, otherwise the master it comes from.
      preview?.blueprint && preview?.clientMap
        ? checkCallbackNumberColumn({ blueprint: preview.blueprint, fieldMap: preview.clientMap })
        : checkCallbackNumberColumn({
            blueprint: (await resolveMasterResources())?.blueprint ?? null,
            fieldMap: preview?.masterMap ?? null,
          }),
      checkAirtableSchemaCovers({
        masterMap: preview?.masterMap ?? null,
        clientMap: preview?.clientMap ?? null,
        masterChoices: preview?.masterMap?.choices ?? null,
        clientChoices: preview?.clientMap?.choices ?? null,
      }),
    );
  }

  for (const line of formatCheckLines(checks)) console.log(line);
  const summary = summarizeChecks(checks);
  console.log(`  ${summary.passed} passed, ${summary.failed} failed, ${summary.skipped} not checked`);

  if (!summary.allClear) {
    const msg = `Correctness checks failed: ${summary.failedIds.join(', ')}`;
    // Report-don't-stop in dry mode; a real run refuses to continue.
    if (DRY_RUN) console.warn(`  [dry-run] ${msg} — fix these before a real run`);
    else fail(8, `${msg}. Nothing further was provisioned.`);
  } else if (summary.skipped) {
    console.log(`  Note: ${summary.skipped} check(s) could not run (missing credentials or nothing provisioned yet).`);
  }
  return summary;
}

// ───────────────────────────────────────────────────────────────────────────
// Step 8d: Commit + push client repo
// ───────────────────────────────────────────────────────────────────────────

function commitAndPush(repoDir, brandName) {
  log(8, `Commit + push client repo`);
  if (DRY_RUN) {
    dryLog(`would: git add -A && git commit -m "feat: initial provisioning for ${brandName}" && git push origin main`);
    return;
  }
  run('git add -A', { cwd: repoDir });
  let staged = true;
  try {
    execSync(`git diff --cached --quiet`, { cwd: repoDir });
    staged = false;
  } catch {
    // diff has staged changes — proceed
  }
  if (staged) {
    const safeMsg = brandName.replace(/['`$\\]/g, '');
    run(`git commit -m "feat: initial provisioning for ${safeMsg}"`, { cwd: repoDir });
  } else {
    // Still push. "Nothing to commit" says nothing about the remote: a run whose commit landed but
    // whose push failed leaves HEAD ahead of origin, and returning here stranded that commit on
    // this machine — every later run saw a clean tree and skipped the push again. Pushing an
    // up-to-date HEAD is a no-op.
    console.log(`  Nothing new to commit — pushing anyway, in case an earlier push failed.`);
  }
  const remoteUrl = execSync('git remote get-url origin', { cwd: repoDir }).toString().trim();
  // The token goes in an auth header set through GIT_CONFIG_* env, never in the URL. It used to be
  // `https://${token}@github.com/…`, which run() echoed on every push — and which git itself would
  // also print on any failed push, past any redaction of our own. `credential.helper=` keeps a
  // machine-wide credential helper from being used instead, so the header is the only auth path.
  run(`git -c credential.helper= push ${remoteUrl} HEAD:main`, {
    cwd: repoDir,
    env: { ...process.env, ...gitAuthEnv(process.env.GITHUB_TOKEN) },
  });
}

// ───────────────────────────────────────────────────────────────────────────
// Step 9: Sync env to Vercel
// ───────────────────────────────────────────────────────────────────────────

async function syncVercelEnv(siteSlug, content, clientDir, plan) {
  const projectName = sanitizeProjectName(siteSlug);
  log(9, `Sync env to Vercel project "${projectName}"`);
  if (DRY_RUN) {
    if (projectName !== siteSlug) {
      dryLog(`project name sanitized: "${siteSlug}" → "${projectName}" (GitHub repo keeps "${siteSlug}")`);
    }
    dryLog(`would lookup/create Vercel project "${projectName}" linked to GitHub repo ${process.env.GITHUB_ORG || '<GITHUB_ORG>'}/${siteSlug}`);
    dryLog(`would push env vars from ${clientDir}/.env.local + NEXT_PUBLIC_BRAND_NAME="${content.brand.name}"`);
    dryLog(`would sync Vercel Firewall rules (global 200/60s per-IP → challenge; AI/search-bot 100/60s per-IP → deny)`);
    log(9, `Preview deploy → would create a preview deployment (dry run)`);
    return { dryRun: true };
  }
  if (!process.env.VERCEL_TOKEN) {
    console.warn(`  ⚠ VERCEL_TOKEN not set — skipping Vercel sync. Run \`npm run sync-env -- --slug ${siteSlug}\` later.`);
    return { skippedAll: true };
  }
  try {
    const result = await syncEnvToVercel({
      slug: siteSlug,
      clientDir,
      extraEnv: {
        NEXT_PUBLIC_BRAND_NAME: content.brand.name,
        // LEAD_DELIVERY_MODE is deliberately NOT overridden here. It used to be forced to
        // 'email' or 'callback' by plan, which `extraEnv` pushed to Vercel in preference to
        // the `.env.local` value — so the file said `portal` while the deployment said
        // something else, and the console's env-drift check would report that key as dirty
        // forever. It is always `portal` now, written once by writeClientEnvLocal and synced
        // from there like every other key. The tier difference lives in LEAD_CALLBACK.
      },
    });

    // On a re-run, step 8's push already started a production build — before the env above was
    // written, so it serves the old env. Rebuild it; see productionPredatesEnv for the incident.
    const envWrittenAt = Date.now();
    const prod = await redeployProductionIfStale({ slug: siteSlug, envWrittenAt });
    if (prod.redeployed) {
      console.log(`  ✓ Production rebuilt with the new env (${prod.reason})`);
    } else if (/failed|could not/.test(prod.reason)) {
      console.warn(`  ⚠ Production not rebuilt: ${prod.reason}. Redeploy from the console's Deployments section.`);
    }

    // Apply the standard anti-scraping WAF rate limits. Best-effort: a firewall failure
    // (plan, permission, transient) must never fail onboarding — the per-repo robots.ts +
    // middleware.ts already protect the site regardless.
    const fw = await syncVercelFirewall(siteSlug);
    if (fw.ok) {
      console.log(`  ✓ Firewall rules synced: ${fw.applied.join('; ')}`);
    } else {
      console.warn(`  ⚠ Firewall rules not applied: ${fw.reason}. Retry later with the console or re-run onboard.`);
    }

    // Preview-first: create a preview deployment and report its URL so the operator can review it
    // before promoting to production in the Vercel dashboard (we never auto-promote). Best-effort:
    // the repo is already pushed and env synced, so a deploy-trigger failure must not fail the run.
    try {
      const dep = await triggerPreviewDeploy({ slug: siteSlug });
      const state = String(dep.readyState || 'building').toLowerCase();
      log(9, `Preview deploy → ${dep.url || '(url pending)'} (${state})`);
    } catch (err) {
      console.warn(
        `  ⚠ Preview deploy not triggered: ${err.message}. If the org GitHub integration auto-deploys on push, the deployment may already exist — check Vercel.`,
      );
    }

    return result;
  } catch (err) {
    console.error(`  ✗ Vercel sync failed: ${err.message}`);
    console.error(`    You can retry with: npm run sync-env -- --slug ${siteSlug}`);
    return { error: err.message };
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Step 10: Provision Clerk portal user
// ───────────────────────────────────────────────────────────────────────────

/**
 * The host Vercel actually serves this project at.
 *
 * Vercel's auto-generated alias is NOT a predictable transform of the project name — it
 * strips underscores, where the obvious guess hyphenates them, so deriving the host gives
 * a 404 for any slug containing `_`. Ask for the domain list instead and take the
 * `.vercel.app` entry; fall back to the derived form only when the lookup fails, so a
 * missing VERCEL_TOKEN degrades to the old behaviour rather than an empty canonical.
 */
async function resolveVercelHost(slug) {
  const derived = `https://${vercelAppHost(slug)}.vercel.app`;
  try {
    const result = await listProjectDomains(slug);
    const alias = result.domains.find((d) => d.name.endsWith('.vercel.app') && !d.redirect);
    return alias ? `https://${alias.name}` : derived;
  } catch {
    return derived;
  }
}

/**
 * Same lookup, but returns null rather than a guess when Vercel can't confirm the host.
 *
 * Used for the portal record's canonical fallback. The lenient version above is fine for the
 * test-login path (a wrong host there is a bad link in a log line), but a fabricated URL
 * written into a client's portal record is worse than an empty one: the Performance tab would
 * report a real-looking failure against a host that never existed.
 */
async function resolveVercelHostStrict(slug) {
  if (!process.env.VERCEL_TOKEN) return null;
  try {
    const result = await listProjectDomains(slug);
    if (!result.ok) return null;
    const alias = result.domains.find((d) => d.name.endsWith('.vercel.app') && !d.redirect);
    return alias ? `https://${alias.name}` : null;
  } catch {
    return null;
  }
}

/**
 * Which portal account this client's sites attach to.
 *
 * Test clients (`_e2e*` slugs, or `--test-portal`) use PORTAL_TEST_EMAIL so you can sign in
 * without owning the placeholder brand.email inbox. REAL clients are deliberately never
 * pre-created in Clerk — they self-serve at /portal/sign-up, and a pre-existing account for
 * their address would block that signup. Their access comes from the account record alone.
 */
function resolvePortalIdentity(intake, baseSlug, emailOverride = null) {
  const isTestClient = baseSlug.startsWith('_e2e') || FORCE_TEST_PORTAL;
  const testEmail = process.env.PORTAL_TEST_EMAIL || null;
  const testPassword = process.env.PORTAL_TEST_PASSWORD || null;
  const useTestLogin = isTestClient && !!testEmail && !!testPassword;
  if (isTestClient && !useTestLogin) {
    console.warn(`  ⚠ Test client but PORTAL_TEST_EMAIL / PORTAL_TEST_PASSWORD not set in .env — falling back to brand.email with no password.`);
  }

  const override = emailOverride && emailOverride.trim() ? emailOverride.trim() : null;
  const email = override ?? (useTestLogin ? testEmail : intake.sites[0]?.brand?.email) ?? null;

  // Enterprise sites all land on the primary site's email — one paying client, one account.
  // Say so out loud when the intake disagrees with itself, rather than silently picking one.
  const emails = new Set(
    intake.sites.map((s) => s?.brand?.email).filter(Boolean).map((e) => e.trim().toLowerCase()),
  );
  if (!override && emails.size > 1) {
    console.warn(`  ⚠ Sites disagree on brand.email (${[...emails].join(', ')}) — all sites attach to ${email}. Use --link-portal --email to change it.`);
  }

  return { email, useTestLogin, testPassword };
}

/**
 * Attach ONE provisioned site to the portal account.
 *
 * Called inside the provisioning loop rather than once at the end: a `fail()` on site 3 of an
 * enterprise client used to exit before step 10 ran at all, leaving sites 1–2 fully
 * provisioned — numbers bought, agents created — with no portal record and no obvious way to
 * tell. Attaching as we go means a partial run leaves a partially-correct portal, not an empty one.
 */
async function attachSiteToPortal({ email, plan, receptionistMode, webOnly = false, status, siteSlug, content, sharedBaseId, clientDir, preferResolvedHost = false }) {
  log(10, `Link portal account`);
  if (!email) {
    console.warn(`  ⚠ No email available (brand.email empty and no --email given) — skipping portal link for ${siteSlug}.`);
    return;
  }

  if (DRY_RUN) {
    dryLog(`would upsert site "${siteSlug}" (plan ${plan}, status ${status}) into account ${email}`);
    dryLog(`any other sites already on that account would be preserved`);
    // Disclosed here rather than from ensureClientRecordForSite, which this early return
    // never reaches. A side effect a dry run doesn't mention is one that surprises you on
    // the real run — which is the entire job of this branch.
    const baseSlug = /-\d+$/.test(siteSlug) ? siteSlug.replace(/-\d+$/, '') : siteSlug;
    dryLog(`would ensure the console client record for "${baseSlug}" → ${email}`);
    return;
  }

  if (!accountStoreConfigured()) {
    console.warn(`  ⚠ KV not configured — skipping portal link. Set KV_REST_API_URL / KV_REST_API_TOKEN in jdd-ops/.env (same Upstash instance the agency site uses).`);
    return;
  }

  // Test clients carry a placeholder domain in seo.canonical, so the live Vercel host has to
  // WIN there — that is the whole point of the test-portal path. Real clients keep their own
  // canonical and only fall back to the Vercel host when they have none yet (pre-domain).
  const resolvedHost = preferResolvedHost
    ? await resolveVercelHost(siteSlug)
    : await resolveVercelHostStrict(siteSlug);
  const ownCanonical = preferResolvedHost ? null : (content?.seo?.canonical ?? null);

  const [entry] = buildPortalSiteEntries({
    plan,
    status,
    sharedAirtableBaseId: sharedBaseId || readEnvLocal(clientDir).AIRTABLE_BASE_ID || null,
    sites: [{
      slug: siteSlug,
      name: content?.brand?.name ?? '',
      canonical: ownCanonical,
      fallbackCanonical: resolvedHost,
      vercelProjectId: await getVercelProjectId(siteSlug),
      retellAgentId: readEnvLocal(clientDir).RETELL_AGENT_ID || null,
      // Required by buildPortalSiteEntries (v1.24.0): a web-only site gets its Airtable base
      // and agent asserted null; everyone else keeps theirs. Stating it, never inferring from
      // the plan, is the whole point of the field.
      receptionistDeclined: webOnly,
    }],
  });

  // Belt-and-braces over buildPortalSiteEntries, kept because `upsertSite` merges defined
  // fields rather than picking known ones, so it is harmless, and it documents intent at the
  // write site. **Keyed on web-only, not on plan.** The old `plan === 'starter'` rule nulled
  // the agent for EVERY Starter site — now that Starter has a receptionist, that would wipe a
  // paying client's agent on every run. Only a declined receptionist has none to record.
  const agentId = readEnvLocal(clientDir).RETELL_AGENT_ID || null;
  if (webOnly) entry.retellAgentId = null;
  else if (agentId) entry.retellAgentId = agentId;

  // Stamp the activation choice on the site record. The portal reads it to decide whether to
  // show a call-log tab, metering reads it to decide whether to bill minutes, and `isWebOnly`
  // needs it present (not just absent) to stay true for a declined site on the next read.
  if (receptionistMode) entry.receptionistMode = receptionistMode;

  /**
   * Values the AGENCY SITE needs and cannot get any other way.
   *
   * The portal cannot read `clients/{slug}/.env.local` — it is a different deployment on a
   * different host. So anything the portal must know has to live on the account record. That is
   * the same reasoning `retellAgentId` already carries above.
   *
   *  - `twilioNumber` — the Customer-lane sender. Without it the review-request and lead-reply
   *    flows fall back to a pool-picked number, i.e. not the client's own business line.
   *  - `messagingServiceSid` — the client's OWN Messaging Service, carrying their CUSTOMER_CARE
   *    campaign. Absent until their A2P registration verifies, which is expected, not an error.
   *  - `a2pStatus` — what gates `siteFeature(site, 'messaging')`. `not-applicable` is TERMINAL
   *    for tiers that never register: Starter and web-only send no customer-facing messages, so
   *    without a distinct state they would sit in `none` forever and every "is registration
   *    done?" check would read them as perpetually pending. State it, never infer it.
   */
  const clientEnv = readEnvLocal(clientDir);
  entry.twilioNumber = webOnly ? null : clientEnv.TWILIO_NUMBER || null;
  entry.messagingServiceSid = webOnly ? null : clientEnv.CLIENT_MESSAGING_SERVICE_SID || null;

  // `entry` is rebuilt from scratch every run, so an unconditional write here would reset a
  // client whose campaign has since VERIFIED back to 'none' — re-locking a working feature with
  // no error anywhere. Carry the existing value forward; only seed it when there isn't one.
  const priorA2p = (await getAccountRecord(email))?.sites?.find((s) => s.slug === siteSlug)?.a2pStatus;
  if (priorA2p) {
    entry.a2pStatus = priorA2p;
  } else {
    // Starter and web-only never send customer-facing messages, so they never register.
    entry.a2pStatus = !webOnly && plan !== 'starter' ? 'none' : 'not-applicable';
  }

  const account = await attachSiteToAccount(email, entry);
  const n = account.sites.length;
  console.log(`  Linked "${siteSlug}" → ${email} (status ${status}, ${n} site${n === 1 ? '' : 's'} on account)`);

  // Record which account owns this site so a later --email re-link can clean up the old one.
  patchEnvLocal(clientDir, 'PORTAL_ACCOUNT_EMAIL', email);

  /**
   * Register the lead-ingest token NOW, in the same step that establishes which account owns
   * this site — because that is exactly what the token record encodes.
   *
   * It has to happen here rather than at env-write time: the token is minted in step 4, but the
   * owning account email is not known until this step, and the record maps token → {account,
   * slug}. Until this runs the deployed `/api/contact` holds a token the ingest endpoint has
   * never heard of, and every lead 401s.
   *
   * Idempotent — `set` overwrites, and the token is carried across re-runs rather than rotated,
   * so a re-run re-points the same token at the same place. A `--link-portal --email` move to a
   * different account re-runs this and the leads follow the site, which is the intent.
   */
  const ingestToken = clientEnv.LEAD_INGEST_TOKEN || readEnvLocal(clientDir).LEAD_INGEST_TOKEN;
  if (ingestToken) {
    await registerLeadIngestToken({ token: ingestToken, email, slug: siteSlug });
    console.log(`  Registered lead-ingest token for "${siteSlug}" → ${email}`);
  } else {
    console.warn(
      `  ⚠ No LEAD_INGEST_TOKEN in ${siteSlug}/.env.local — web-form leads will 401 at the ingest endpoint until this client is re-run.`,
    );
  }

  await ensureClientRecordForSite({ email, siteSlug, account });
}

/**
 * Create or extend the console's client record for the site just attached.
 *
 * Runs inside the per-site loop for the same reason the portal attach does: a failure on
 * site 3 of an enterprise client must not leave sites 1–2 provisioned with no record.
 * `ensureClientRecord` is idempotent, so re-running an onboard extends the existing record
 * rather than making a second one.
 *
 * The site list is derived from the account record we just wrote, filtered to THIS client's
 * base slug — an account can legitimately own several unrelated businesses, and folding all
 * of its sites into one record would merge them into a single relationship.
 *
 * Deliberately non-fatal: the record is a console convenience, and failing a provisioning
 * run that has already bought a phone number over it would be the wrong trade.
 */
async function ensureClientRecordForSite({ email, siteSlug, account }) {
  if (!clientRecordsConfigured()) return;

  const base = /-\d+$/.test(siteSlug) ? siteSlug.replace(/-\d+$/, '') : siteSlug;
  const siteSlugs = (account.sites ?? [])
    .map((s) => s.slug)
    .filter((s) => s === base || (s.startsWith(`${base}-`) && /^\d+$/.test(s.slice(base.length + 1))));

  if (DRY_RUN) {
    dryLog(`would ensure client record for ${base} (${siteSlugs.length} site(s)) → ${email}`);
    return;
  }

  try {
    const rec = await ensureClientRecord({ email, slug: base, siteSlugs });
    console.log(`  Client record ${rec.id} (${siteSlugs.length} site${siteSlugs.length === 1 ? '' : 's'})`);
  } catch (err) {
    console.warn(`  ⚠ Could not write the client record for ${base}: ${err.message}`);
  }
}

/**
 * Test clients only: ensure a Clerk login exists with a known password.
 * Runs once per client, after every site has been attached.
 */
async function provisionPortalTestLogin({ email, useTestLogin, testPassword, primaryClientDir, baseSlug }) {
  if (!useTestLogin || !email) return;

  if (DRY_RUN) {
    dryLog(`would create/update Clerk test login ${email} (+ password)`);
    return;
  }

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    console.warn(`  ⚠ CLERK_SECRET_KEY not set — portal account linked, but no test login created.`);
    return;
  }

  const clerk = createClerkClient({ secretKey });
  const existingUserId = readEnvLocal(primaryClientDir).CLERK_USER_ID;

  if (existingUserId) {
    try {
      await clerk.users.updateUser(existingUserId, { password: testPassword, skipPasswordChecks: true });
      console.log(`  Portal test login → ${email} (password: PORTAL_TEST_PASSWORD in jdd-ops/.env)`);
      return existingUserId;
    } catch (err) {
      console.warn(`  ⚠ Saved CLERK_USER_ID ${existingUserId} did not update (${err?.message ?? err}); resolving by email…`);
    }
  }

  let user;
  try {
    user = await clerk.users.createUser({
      emailAddress: [email],
      password: testPassword,
      skipPasswordChecks: true,
    });
  } catch (err) {
    if (err?.errors?.[0]?.code === 'form_identifier_exists') {
      const list = await clerk.users.getUserList({ emailAddress: [email] });
      user = list.data?.[0];
      if (user) {
        await clerk.users.updateUser(user.id, { password: testPassword, skipPasswordChecks: true });
      } else {
        console.warn(`  ⚠ Could not create or find Clerk test user for ${email}`);
        return;
      }
    } else {
      console.warn(`  ⚠ Clerk test user creation failed: ${err?.message ?? err}`);
      return;
    }
  }

  console.log(`  Portal test login → ${email} (password: PORTAL_TEST_PASSWORD in jdd-ops/.env; user ${user.id})`);
  patchEnvLocal(primaryClientDir, 'CLERK_USER_ID', user.id);
  return user.id;
}

/**
 * Detach this client's sites from an account they were previously linked to.
 *
 * Re-linking with --email used to attach to the new address and simply walk away from the old
 * record, which kept every site on it — so whoever still controls the old address kept portal
 * access to the client's call log. Move the sites rather than copying them.
 */
async function detachFromPreviousAccount(previousEmail, newEmail, siteSlugs) {
  if (!previousEmail || previousEmail.trim().toLowerCase() === newEmail.trim().toLowerCase()) return;
  if (DRY_RUN) {
    dryLog(`would remove ${siteSlugs.join(', ')} from the previous account ${previousEmail}`);
    return;
  }
  if (!accountStoreConfigured()) return;
  for (const slug of siteSlugs) {
    try {
      await detachSiteFromAccount(previousEmail, slug);
    } catch (err) {
      console.warn(`  ⚠ Could not detach "${slug}" from ${previousEmail}: ${err?.message ?? err}`);
    }
  }
  console.log(`  Removed ${siteSlugs.length} site${siteSlugs.length === 1 ? '' : 's'} from the previous account ${previousEmail}`);
}

// Links (or repairs) an existing client's portal account without re-running full
// provisioning. An optional emailOverride targets the account the client actually signed up
// with when it differs from brand.email; the sites are MOVED off the previous account.
// Usage: node onboard.js --slug {slug} --link-portal [--email addr] [--test-portal]
async function linkPortal(slug, opts = {}) {
  const emailOverride = opts.email ?? null;
  console.log(`\n[link-portal] Linking client "${slug}" to the portal${emailOverride ? ` (email: ${emailOverride})` : ''}`);

  const singleSchema = resolve('clients', slug, 'site.ts');
  const schemaPath = existsSync(singleSchema)
    ? singleSchema
    : resolve('clients', slug, 'site-1', 'site.ts');
  if (!existsSync(schemaPath)) {
    fail(0, `No site.ts found for slug "${slug}" (looked in clients/${slug} and clients/${slug}/site-1).`);
  }

  const intake = await loadIntake(schemaPath);
  // Same operator override, and for the same reason, as the main path: an intake predating the
  // activation step carries no receptionistMode, and validateIntake refuses to guess one. Without
  // this, --link-portal was unusable for exactly those clients — the legacy-shape ones most
  // likely to need relinking — and failed on a flag the caller had in fact passed.
  if (opts.receptionist) intake.receptionistMode = opts.receptionist;
  validateIntake(intake);

  // sharedBaseId comes from the primary site's .env.local (written at provision time).
  const primaryClientDir = primaryClientDirFor(slug, intake);
  const sharedBaseId = readEnvLocal(primaryClientDir).AIRTABLE_BASE_ID || null;

  const { email, useTestLogin, testPassword } = resolvePortalIdentity(intake, slug, emailOverride);
  if (!email) {
    fail(0, `No email available for "${slug}" — pass --email addr.`);
  }

  const siteSlugs = intake.sites.map((_, i) => siteSlugFor(slug, intake, i));

  // A repair run can't know whether the site deployed since; leave status alone by reading
  // back what the account already says, defaulting to 'live' for an already-provisioned client.
  const previousEmail = readEnvLocal(primaryClientDir).PORTAL_ACCOUNT_EMAIL || null;
  await detachFromPreviousAccount(previousEmail, email, siteSlugs);

  for (let i = 0; i < intake.sites.length; i++) {
    await attachSiteToPortal({
      email,
      plan: intake.plan,
      status: 'live',
      siteSlug: siteSlugs[i],
      content: intake.sites[i],
      sharedBaseId,
      clientDir: siteDirFor(slug, intake, i),
      preferResolvedHost: useTestLogin,
    });
  }

  await provisionPortalTestLogin({ email, useTestLogin, testPassword, primaryClientDir, baseSlug: slug });
}

// ───────────────────────────────────────────────────────────────────────────
// Final handoff summary
// ───────────────────────────────────────────────────────────────────────────

/**
 * Check Web Analytics per provisioned site so the handoff can state what is actually true.
 *
 * This used to be an unconditional "remember to enable Web Analytics" line, which is the
 * kind of instruction that gets skimmed. When it is skipped the only symptom is an empty
 * portal Traffic tab, months later, with nothing pointing at the cause.
 *
 * Enabling it is dashboard-only — the Vercel API exposes the state but no setter — so
 * verifying is the most automation available here.
 */
async function checkAnalytics(provisioned) {
  // A dry run promises "no external API calls" in its own banner, and this was the one place
  // that broke the promise — getProjectAnalytics was called unconditionally, so every dry run
  // hit Vercel. `analyticsEnabled: null` is the established tristate for "didn't look", which
  // analyticsLines already renders as "couldn't check" rather than claiming it's fine.
  if (DRY_RUN) {
    return provisioned.map((p) => ({
      siteSlug: p.siteSlug,
      projectId: null,
      analyticsEnabled: null,
      reason: 'dry run — not checked',
    }));
  }
  return Promise.all(
    provisioned.map(async (p) => ({
      siteSlug: p.siteSlug,
      ...(await getProjectAnalytics(p.siteSlug)),
    })),
  );
}

/** Render the analytics result as either a confirmation or a specific action item. */
function analyticsLines(results, startNumber) {
  const off = results.filter((r) => r.analyticsEnabled === false);
  const unknown = results.filter((r) => r.analyticsEnabled === null);
  const on = results.filter((r) => r.analyticsEnabled === true);
  const out = [];

  if (off.length) {
    out.push(`    ${startNumber}. ⚠ Enable Web Analytics — the portal Traffic tab is empty without it:`);
    off.forEach((r) => out.push(`         Vercel → ${sanitizeProjectName(r.siteSlug)} → Analytics → Enable`));
  }
  if (unknown.length) {
    // Never claim it's fine when we couldn't look.
    out.push(`    ${off.length ? startNumber + 1 : startNumber}. ? Couldn't check Web Analytics — verify manually:`);
    unknown.forEach((r) =>
      out.push(`         ${sanitizeProjectName(r.siteSlug)} (${r.reason ?? 'unknown reason'})`),
    );
  }
  if (on.length && !off.length && !unknown.length) {
    out.push(`    ✓ Web Analytics on for ${on.length === 1 ? 'the project' : `all ${on.length} projects`} — portal Traffic will populate.`);
  } else if (on.length) {
    out.push(`    ✓ Web Analytics already on: ${on.map((r) => sanitizeProjectName(r.siteSlug)).join(', ')}`);
  }
  return out;
}

async function printHandoff({ intake, provisioned, sharedBaseId, baseSlug, portalEmail }) {
  const line = '─'.repeat(64);
  console.log(`\n${line}`);
  console.log(`  ONBOARDED: ${intake.sites[0].brand.name}${isMultiSite(intake) ? ` (Enterprise — ${intake.sites.length} sites)` : ''}`);
  console.log(`  Plan: ${intake.plan}`);
  console.log(line);
  provisioned.forEach((p, i) => {
    console.log(`\n  Site ${i + 1}/${intake.sites.length}: ${p.brandName}`);
    console.log(`    Repo          ${p.repoUrl}`);
    console.log(`    Portal slug   ${p.siteSlug}${p.portalStatus ? ` (${p.portalStatus})` : ''}`);
    if (p.agentId)      console.log(`    Retell agent  ${p.agentId}`);
    if (p.twilioNumber) console.log(`    Twilio number ${p.twilioNumber}`);
    console.log(`    Accent        ${p.palette.accent}`);
    if (p.missingFields.length) {
      console.log(`    ⚠ Missing: ${p.missingFields.join(', ')}`);
    }
  });
  if (sharedBaseId) {
    console.log(`\n  Airtable base (shared): ${sharedBaseId}`);
    if (isMultiSite(intake)) {
      console.log(`    Call Log rows are separated by the "Site" column (values = portal slugs above).`);
    }
  }
  console.log(`\n  Portal: https://juneaudigitaldesigns.com/portal`);
  console.log(`  Portal account: ${portalEmail ?? '⚠ not linked'}`);
  const analytics = await checkAnalytics(provisioned);

  console.log(`\n${line}`);
  console.log(`  Next:`);
  if (intakeIsWebOnly(intake)) {
    // Website-only: no number, no agent, leads by email. The old Starter checklist.
    console.log(`    1. Verify lead email at ${intake.sites[0].brand.email} after a test form submission.`);
    console.log(`    2. Verify the deployed Vercel URL renders correctly.`);
    analyticsLines(analytics, 3).forEach((l) => console.log(l));
  } else {
    // Everyone with a receptionist (Starter included) gets the test-call and prompt-tuning
    // checkpoints. The one tier difference is lead delivery: Starter reports web-form leads by
    // email, Growth and Enterprise call them back, so the lead checkpoint is worded per plan.
    console.log(`    1. Checkpoint 1 — review the Vercel preview URL(s).`);
    console.log(`    2. Checkpoint 2 — test-call each Twilio number; confirm it rings the owner's`);
    console.log(`       real phone FIRST and only reaches the agent on no-answer; tune each agent-prompt.txt.`);
    provisioned.forEach((p) => {
      if (p.agentId) {
        const slugForCmd = isMultiSite(intake) ? `${baseSlug}/site-${p.index + 1}` : baseSlug;
        console.log(`         npm run update-prompt -- ${p.agentId} --slug ${slugForCmd}`);
      }
    });
    console.log(`    3. Checkpoint 3 — make a test call; confirm the post-call text brief arrives and`);
    console.log(`       the call logs an Airtable row.`);
    if (intake.plan === 'starter') {
      console.log(`    4. Verify a web-form submission still emails the lead to ${intake.sites[0].brand.email}`);
      console.log(`       (Starter delivers form leads by email; the callback is a Growth feature).`);
    } else {
      console.log(`    4. Submit a test lead per site; confirm the Retell callback fires`);
      console.log(`       (/api/contact → create-phone-call).`);
    }
    analyticsLines(analytics, 5).forEach((l) => console.log(l));
  }
  console.log('');
}

// ───────────────────────────────────────────────────────────────────────────
// Pre-flight: validate credentials & ID formats BEFORE any provisioning
// (esp. before the paid Twilio purchase) so a bad .env fails fast and free.
// ───────────────────────────────────────────────────────────────────────────

/**
 * Credential presence + ID-format validation.
 *
 * Runs in dry mode too. Nothing in here is a network call — it is pure `process.env`
 * inspection — so the old blanket `if (DRY_RUN) return` was skipping checks that cost
 * nothing, and skipping exactly the ones a dry run exists to surface. A dry run that cannot
 * tell you `AIRTABLE_WORKSPACE_ID` holds a base id instead of a workspace id has not told you
 * whether the real run will work.
 *
 * In dry mode the findings are reported but never fatal: a dry run's job is to list what is
 * wrong, not to stop at the first problem. The live run still hard-fails.
 */
function preflight(intake) {
  console.log('\n[pre-flight] Validating credentials & ID formats…');
  const errors = [];
  const warnings = [];
  const need = (name) => { if (!process.env[name]) errors.push(`missing env ${name}`); };
  const fmt = (name, prefix) => {
    const v = process.env[name];
    if (v && !v.startsWith(prefix)) {
      errors.push(`${name} should start with "${prefix}" but starts with "${v.slice(0, prefix.length)}" — wrong ID type? (e.g. an Airtable base id "app…" is not a workspace id "wsp…")`);
    }
  };

  // Repo + deploy are needed for every plan.
  need('GITHUB_TOKEN');
  need('GITHUB_ORG');
  if (!process.env.VERCEL_TOKEN) warnings.push('VERCEL_TOKEN not set — step 9 (Vercel sync) will be skipped, and sites will be linked as "building" rather than "live"');
  if (!process.env.CLERK_SECRET_KEY) warnings.push('CLERK_SECRET_KEY not set — the portal test login will be skipped. Run Clerk setup first (see RUNBOOK.md).');
  // Step 10 writes the account record to KV, not Clerk. Warn here rather than at the very end
  // of a run that has already bought numbers.
  if (!accountStoreConfigured()) {
    warnings.push('KV not configured (KV_REST_API_URL / KV_REST_API_TOKEN) — step 10 will NOT link the portal; the client will have no portal access until you re-run --link-portal');
  }

  const webOnly = intakeIsWebOnly(intake);

  // Lead capture is tier-independent now: every client's web form records into the portal, so
  // this is checked for all of them rather than only Starter. Resend is gone — it used to be
  // Starter's entire delivery mechanism and failed open, which is the whole reason this moved.
  //
  // A warning rather than a hard failure on purpose: the KV write that makes the token usable
  // happens in step 10 (link portal), so a run with KV unconfigured still produces a working
  // site — it just cannot receive leads until the token is registered.
  if (!accountStoreConfigured()) {
    warnings.push(
      'KV not configured — the lead-ingest token cannot be registered, so web-form leads will 401 at the ingest endpoint until this client is re-run with KV_REST_API_URL/TOKEN set',
    );
  }

  // The voice + CRM stack. Needed by every client EXCEPT a web-only one. This is the gate that
  // matters most: it runs before the paid Twilio purchase, so a Starter-with-receptionist whose
  // .env is missing a Retell/Twilio credential now fails here for free instead of halfway
  // through, after a number has been bought. The old code only reached this block for
  // growth/enterprise, so a misconfigured Starter would have sailed past it.
  if (!webOnly) {
    if (!process.env.MAKE_API_KEY || !process.env.MAKE_POST_CALL_MASTER_SCENARIO_ID) {
      warnings.push('MAKE_API_KEY / MAKE_POST_CALL_MASTER_SCENARIO_ID not set — step 8c will skip the post-call clone, so calls will not reach Airtable or SMS the owner');
    }
    need('ANTHROPIC_API_KEY');
    need('RETELL_API_KEY');
    need('RETELL_LLM_ID');
    need('RETELL_DEFAULT_VOICE_ID');
    need('TWILIO_ACCOUNT_SID');
    need('TWILIO_AUTH_TOKEN');
    need('AIRTABLE_API_KEY');
    need('AIRTABLE_WORKSPACE_ID');
    fmt('ANTHROPIC_API_KEY', 'sk-ant-');
    fmt('TWILIO_ACCOUNT_SID', 'AC');
    fmt('AIRTABLE_API_KEY', 'pat');
    fmt('AIRTABLE_WORKSPACE_ID', 'wsp');

    // SMS to the owner requires an A2P 10DLC Messaging Service. Without the SID the client
    // number can't join the campaign and every post-call text fails with 30034 — so if this
    // client has SMS consent on file, a missing SID is a hard error, not a warning. A client
    // with no SMS consent doesn't text, so the SID stays optional for them.
    const smsWanted = intake.smsAlerts?.consented === true && Boolean(intake.smsAlerts?.phone);
    if (smsWanted) {
      if (!process.env.TWILIO_MESSAGING_SERVICE_SID) {
        errors.push(
          'SMS alerts are consented but TWILIO_MESSAGING_SERVICE_SID is not set — the client number ' +
          'cannot join the A2P 10DLC campaign and every post-call text fails with error 30034. ' +
          "Twilio Console → Messaging → Services → your campaign's service → copy the MG… SID into .env.",
        );
      } else {
        fmt('TWILIO_MESSAGING_SERVICE_SID', 'MG');
      }

      // No TWILIO_NOTIFICATION_NUMBER check any more. It existed because the cloned Twilio
      // module needed a `from`; the clone has no Twilio module now. The owner brief is sent by
      // the agency (/api/ingest/call), which holds that number in its own env and refuses to
      // send without it — see `sendSms` there.
    }
  }

  for (const w of warnings) console.warn(`  ⚠ ${w}`);
  if (errors.length) {
    for (const e of errors) console.error(`  ✗ ${e}`);
    const summary = `Pre-flight failed (${errors.length} issue${errors.length === 1 ? '' : 's'}) — fix .env and re-run. No resources were created.`;
    // Report-don't-stop in dry mode, so one missing credential doesn't hide the rest of the
    // run from you. `✓ Pre-flight passed` is deliberately NOT printed here: onboard-parse.ts
    // closes the pre-flight phase on that line, and claiming it passed would be a lie.
    if (DRY_RUN) {
      console.warn(`  [dry-run] ${summary.replace(' No resources were created.', '')}`);
      return { errors, warnings };
    }
    fail(0, summary);
  }
  console.log('  ✓ Pre-flight passed');
  return { errors, warnings };
}

/**
 * Refuse to provision a client that is wired into a MASTER resource.
 *
 * Runs at pre-flight — before the Twilio purchase, the Retell agent, the Airtable base and the
 * Make clone — because this is a configuration mistake, and a configuration mistake should
 * cost nothing to discover.
 *
 * The case that prompted it: `_e2e_test_growth` had `AIRTABLE_BASE_ID` set to the master base,
 * and its Retell agent's `webhook_url` was the master scenario's own hook. So the one client
 * that existed to prove the pipeline ran entirely through the master and never once exercised
 * `cloneAndWirePostCall` — which is why five bugs in that function shipped unnoticed. Sharing
 * a master resource does not look broken; it looks like a working client whose calls land in
 * the wrong place.
 *
 * Read-only: three GETs at most (master scenario → hookId → hook url, master blueprint →
 * airtable base) plus one per site to read the live agent. Nothing is created or modified; in
 * particular the master scenario is never touched.
 */
async function verifyNoMasterResources(intake, baseSlug) {
  console.log('\n[pre-flight] Checking no client is wired to a master resource…');

  const master = await resolveMasterResources();
  if (!master) {
    console.warn(`  ⚠ Could not resolve the master scenario (${MASTER_RESOURCES_REASON ?? 'reason unknown'}) — not checked. This is not a pass.`);
    return;
  }
  const { masterBaseId, masterHookUrl } = master;
  if (!masterBaseId && !masterHookUrl) {
    console.warn('  ⚠ Master scenario carries neither an Airtable base nor a hook — not checked. This is not a pass.');
    return;
  }

  const problems = [];
  for (let i = 0; i < intake.sites.length; i++) {
    const label = isMultiSite(intake) ? `site ${i + 1}/${intake.sites.length}` : 'client';
    const env = readEnvLocal(siteDirFor(baseSlug, intake, i));

    // What the live agent will actually POST to. The env file can be silent while the agent is
    // wired — exactly how the e2e fixture hid.
    let agentWebhookUrl = null;
    if (env.RETELL_AGENT_ID && process.env.RETELL_API_KEY) {
      try {
        const res = await fetch(`https://api.retellai.com/get-agent/${env.RETELL_AGENT_ID}`, {
          headers: { Authorization: `Bearer ${process.env.RETELL_API_KEY}` },
        });
        if (res.ok) agentWebhookUrl = (await res.json())?.webhook_url ?? null;
      } catch {
        // Unreachable Retell is reported by the checks step; don't block pre-flight on it.
      }
    }

    // A master base id in .env.local is fatal: createAirtableBase short-circuits on it, so the
    // run would reuse the master base rather than replace it.
    const baseCheck = checkNotMasterBase({ clientBaseId: env.AIRTABLE_BASE_ID, masterBaseId });
    if (baseCheck.ok === false) problems.push(`${label}: ${baseCheck.detail}`);

    // Same for a recorded webhook: cloneAndWirePostCall short-circuits when
    // RETELL_POST_CALL_WEBHOOK_URL is already set, so a master hook here is never corrected.
    const envHookCheck = checkNotMasterHook({
      clientWebhookUrl: env.RETELL_POST_CALL_WEBHOOK_URL,
      agentWebhookUrl: null,
      masterHookUrl,
    });
    if (envHookCheck.ok === false) problems.push(`${label}: ${envHookCheck.detail}`);

    // The live AGENT pointing at the master is different in kind: when no webhook is recorded
    // yet, this run will clone the master and re-point the agent at that clone, so the
    // condition is about to be fixed by the very run a hard failure would block. Warn instead —
    // refusing here would make the one client that needs decoupling impossible to decouple.
    const agentHookCheck = checkNotMasterHook({
      clientWebhookUrl: null,
      agentWebhookUrl,
      masterHookUrl,
    });
    if (agentHookCheck.ok === false) {
      if (env.RETELL_POST_CALL_WEBHOOK_URL) {
        problems.push(`${label}: ${agentHookCheck.detail}`);
      } else {
        console.warn(`  ⚠ ${label}: the Retell agent currently posts to the MASTER scenario's hook.`);
        console.warn('    This run will clone the master and re-point the agent at its own clone, which fixes it.');
      }
    }
  }

  if (problems.length) {
    for (const p of problems) console.error(`  ✗ ${p}`);
    const summary =
      `This client is wired to a master resource (${problems.length} issue${problems.length === 1 ? '' : 's'}). ` +
      'Clear AIRTABLE_BASE_ID / RETELL_POST_CALL_WEBHOOK_URL from the client .env.local so the run creates its own, ' +
      'and re-point the Retell agent off the master hook.';
    // Report-don't-stop in dry mode, matching preflight: a dry run's job is to show you
    // everything that is wrong, not to stop at the first thing. A real run refuses.
    if (DRY_RUN) {
      console.warn(`  [dry-run] ${summary}`);
      return;
    }
    fail(0, `${summary} No resources were created.`);
  }
  console.log('  ✓ No master resources in use');
}

/**
 * Is the master Twilio account actually usable?
 *
 * Pre-flight already checked that `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` are present and
 * that the SID looks like a SID. That is not the same as the account being able to do anything:
 * a suspended or closed account returns 401 / code 20003 ("account … with status 4 is not
 * active") on every request, including a plain account fetch, with credentials that are
 * perfectly well-formed.
 *
 * This was found the expensive way. A run reached step 9 — GitHub repo created, site content
 * written, build run, agent prompt generated, a per-client Retell LLM and agent created — and
 * only then discovered the account was inactive, surfacing as a raw RestException reported as
 * "unhandled error in onboard.js". One read-only GET here turns that into a free, legible stop
 * before anything exists.
 *
 * Gated on web-only, which buys no number and needs no Twilio at all.
 */
async function verifyTwilioAccountActive(intake) {
  if (intakeIsWebOnly(intake)) return;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  // preflight already hard-failed on absence; guard defensively so this never throws first.
  if (!sid || !token) return;

  console.log('\n[pre-flight] Checking the Twilio account is active…');

  // Deliberately runs in dry mode too. It is a single read-only GET, and a dry run that cannot
  // tell you the account is suspended has not told you whether the real run will work — which
  // is the whole point of the dry run. Reported rather than fatal there, matching preflight.
  const stop = (msg) => {
    if (DRY_RUN) {
      console.warn(`  [dry-run] ${msg}`);
      return;
    }
    fail(0, `${msg} Nothing was created.`);
  };

  let account = null;
  try {
    account = await twilio(sid, token).api.v2010.accounts(sid).fetch();
  } catch (err) {
    // 20003 is Twilio's authentication failure, which covers BOTH a bad token and a live-but-
    // unusable account. The message says which, so pass it through rather than guessing.
    return stop(
      `Twilio rejected the master credentials: ${err?.message ?? String(err)}\n` +
      '    If that says the account is "not active", the account is suspended or closed and no ' +
      `credential change will fix it — settle any unpaid balance or clear the verification hold ` +
      `for ${sid.slice(0, 10)}… in the Twilio Console.\n` +
      '    If it says the token is wrong, update TWILIO_AUTH_TOKEN in .env.',
    );
  }

  if (account?.status !== 'active') {
    return stop(
      `Twilio account ${sid.slice(0, 10)}… has status "${account?.status}", not "active" — it ` +
      'cannot search for or buy a number. Resolve it in the Twilio Console (billing, or a ' +
      'verification hold) and re-run.',
    );
  }
  console.log(`  ✓ Twilio account active (${account.friendlyName ?? sid.slice(0, 10)}…)`);
}

/**
 * Live A2P readiness check — only when this client actually texts (any tier with a receptionist
 * and SMS consent on file). The sync preflight already hard-fails if the SID is missing; this
 * goes one step further and asks Twilio whether the Messaging Service has an APPROVED
 * campaign. Adding a number to a service whose campaign is still pending buys a number that
 * silently 30034s on every send, and campaign approval takes days — far better to stop here
 * with a checklist than to provision a client who can't text and not find out for a week.
 *
 * Gated on web-only, not on plan: a Starter-with-receptionist sends post-call texts and must be
 * checked, where the old `plan === 'starter'` skip would have let a textless Starter through.
 */
async function verifyA2pRegistered(intake) {
  if (DRY_RUN || intakeIsWebOnly(intake)) return;
  const smsWanted = intake.smsAlerts?.consented === true && Boolean(intake.smsAlerts?.phone);
  if (!smsWanted) return;
  const sid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  if (!sid) return; // preflight already hard-failed; guard defensively.

  const client = twilio(requireEnv('TWILIO_ACCOUNT_SID'), requireEnv('TWILIO_AUTH_TOKEN'));
  let service;
  try {
    service = await client.messaging.v1.services(sid).fetch();
  } catch (err) {
    fail(0, `Could not read Messaging Service ${sid} (${err.message}). Check TWILIO_MESSAGING_SERVICE_SID in .env. No resources were created.`);
  }
  if (service.usAppToPersonRegistered !== true) {
    fail(0,
      `Messaging Service ${sid} has no approved A2P 10DLC campaign (usAppToPersonRegistered=${service.usAppToPersonRegistered}). ` +
      'Register the campaign and wait for carrier approval (Twilio Console → Messaging → Regulatory Compliance → A2P 10DLC) ' +
      'before onboarding a client that texts. No resources were created.');
  }
  console.log(`  ✓ A2P campaign approved on Messaging Service ${sid}`);
}

// ───────────────────────────────────────────────────────────────────────────
// Main orchestration
// ───────────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv);
  DRY_RUN = args.dryRun;
  FORCE_TEST_PORTAL = args.testPortal;

  // Short-circuit: --link-portal links an existing client to the Clerk portal only
  if (args.linkPortal) {
    if (!args.slug) fail(0, '--link-portal requires --slug {slug}');
    await linkPortal(args.slug, { email: args.email, receptionist: args.receptionist });
    return;
  }

  if (DRY_RUN) {
    // Wording matters. This used to claim "no external API calls", which was already untrue
    // (checkAnalytics called Vercel) and is now untrue on purpose: the correctness checks GET
    // the live Make master blueprint and the Airtable schemas, because the only way to know
    // the field mapping will resolve is to ask the services that own those ids. What a dry run
    // guarantees is that it CREATES and WRITES nothing — which is the promise that matters.
    console.log('\n=== DRY RUN MODE — read-only: nothing is created, written, or purchased ===\n');
  }

  const baseSlug = deriveBaseSlug(args.schema || '');
  if (!baseSlug || baseSlug === '.' || baseSlug === '..') {
    fail(0, `Could not derive a slug from --schema "${args.schema}". Expected: clients/{slug}/site.ts`);
  }

  const intake = await loadIntake(args.schema);
  // Operator override wins over whatever the intake carried (or didn't). Applied before
  // validation so a --receptionist value is checked against the three allowed modes exactly
  // like an intake-supplied one; a bad flag value fails validation rather than slipping through.
  if (args.receptionist) intake.receptionistMode = args.receptionist;
  validateIntake(intake);
  preflight(intake);
  // Before any paid resource exists: refuse a client pointed at the master base or master hook.
  await verifyNoMasterResources(intake, baseSlug);
  // …and confirm Twilio can actually be used. A suspended account authenticates as a 401 on
  // every call, so without this the run dies at step 9 having already created a GitHub repo
  // and a billable Retell agent.
  await verifyTwilioAccountActive(intake);
  await verifyA2pRegistered(intake);

  // Computed once, from the stated mode. Every per-site decision below keys off this rather
  // than off the plan, because every tier now has a receptionist and only a declined Starter
  // does not. `intakeIsWebOnly` reuses the canonical predicate from @jdd/schema.
  const webOnly = intakeIsWebOnly(intake);
  console.log(
    `  Receptionist: ${intake.receptionistMode}${webOnly ? ' (WEBSITE ONLY — no number, no agent)' : ''}`,
  );

  const provisioned = [];
  let sharedBaseId = null;

  // Resolved once, up front: every site of a client attaches to the same portal account, and
  // knowing the address before the loop lets each site link as soon as it is done.
  const { email: portalEmail, useTestLogin, testPassword } = resolvePortalIdentity(intake, baseSlug);

  for (let i = 0; i < intake.sites.length; i++) {
    const site = intake.sites[i];
    const siteSlug = siteSlugFor(baseSlug, intake, i);
    const clientDir = siteDirFor(baseSlug, intake, i);
    CURRENT_SITE_LABEL = isMultiSite(intake) ? `site ${i + 1}/${intake.sites.length}` : '';

    const { repoDir, repoUrl } = await createRepoFromLocal(siteSlug, site, clientDir);
    installClientSchema(repoDir, site);
    writeApiRoutes(repoDir);
    writeSelfHostedFonts(repoDir);
    // The env lines are returned (and computed even in dry mode) so the correctness checks can
    // assert the tier matrix and the forward target without re-reading the file.
    const { lines: envLines } = writeClientEnvLocal(clientDir, siteSlug, intake.plan, site, webOnly);
    buildClientRepo(repoDir);

    let agentId = null;
    let twilioNumber = null;
    let siteTag = null;
    // The computed published/forward numbers, handed to the correctness checks below. Null for
    // a web-only client, which has no number to publish.
    let phoneSwap = null;

    // Keyed on web-only, not on plan: Starter now provisions the full voice stack like Growth
    // (the only runtime difference is LEAD_DELIVERY_MODE=email, set in syncVercelEnv). The only
    // client that skips this is one who declined the receptionist.
    if (webOnly) {
      console.log(`\n  Skipping voice provisioning (website-only client, receptionist declined).`);
    } else {
      // Outbound rules only for an agent that places callbacks — the same rule as LEAD_CALLBACK.
      const agentPrompt = await generateRetellPrompt(site, clientDir, siteSlug, { callbacks: placesCallbacks(intake.plan) });
      agentId = await createRetellAgent(site, agentPrompt, clientDir);
      twilioNumber = await provisionTwilioNumber(site, siteSlug, clientDir);

      // The value written into the Call Log's `Site` column — the provisioning slug, and set
      // for EVERY enterprise site including the first. Tagging only sites 2+ left site 1's
      // rows untagged, and the portal shows untagged rows under every site.
      siteTag = siteTagFor(baseSlug, intake, i);

      if (i === 0) {
        sharedBaseId = await createAirtableBase(intake, site, clientDir, baseSlug);
      } else {
        patchEnvLocal(clientDir, 'AIRTABLE_BASE_ID', sharedBaseId);
        console.log(`  Reusing shared Airtable base ${sharedBaseId}`);
      }
      if (siteTag) {
        patchEnvLocal(clientDir, 'AIRTABLE_SITE_TAG', siteTag);
        console.log(`  Site tag: ${siteTag}`);
      }
      await cloneAndWirePostCall(
        agentId, site, clientDir,
        sharedBaseId || readEnvLocal(clientDir).AIRTABLE_BASE_ID,
        siteTag,
      );

      // Last thing before the commit: swap the number the site advertises. Deliberately
      // after writeClientEnvLocal (which captured the owner's real line as the forward
      // target) and after the purchase (which has no number to publish until it succeeds).
      if (twilioNumber) {
        phoneSwap = applyTwilioNumberToSite(repoDir, site, twilioNumber);
        if (phoneSwap.written) {
          // The early build at step 5 is the fail-cheap gate — it runs before we spend money
          // on a number, an agent or a base. This second one is narrower: it type-checks the
          // tree we are actually about to push, since site.ts changed after that gate.
          buildClientRepo(repoDir);
        }
      }
    }

    // Last gate before the push. Everything the checks need is settled by now: the env lines,
    // the published number, the Airtable base and the Site tag. On a real run a failure here
    // stops before commitAndPush, so a client we already know is misconfigured never ships.
    await runCorrectnessChecks({
      envLines,
      plan: intake.plan,
      webOnly,
      twilioNumber,
      phoneSwap,
      baseId: sharedBaseId || readEnvLocal(clientDir).AIRTABLE_BASE_ID || null,
      siteTag,
      clientDir,
    });

    commitAndPush(repoDir, site.brand.name);
    const sync = await syncVercelEnv(siteSlug, site, clientDir, intake.plan);

    // "live" means the env actually reached Vercel. A skipped or failed sync leaves the site
    // "building" so the portal says so, instead of showing a dashboard for a site that can't
    // serve leads yet.
    const syncOk = Boolean(sync) && !sync.skippedAll && !sync.error;
    const portalStatus = syncOk || sync?.dryRun ? 'live' : 'building';

    // Link this site now rather than after the whole loop: an enterprise run that dies on
    // site 3 should still leave sites 1 and 2 visible in the client's portal.
    await attachSiteToPortal({
      email: portalEmail,
      plan: intake.plan,
      receptionistMode: intake.receptionistMode,
      webOnly,
      status: portalStatus,
      siteSlug,
      content: site,
      sharedBaseId,
      clientDir,
      preferResolvedHost: useTestLogin,
    });

    const missingFields = site?._meta?.missing_fields ?? site?._meta?.missingFields ?? [];
    provisioned.push({
      index: i,
      siteSlug,
      brandName: site.brand.name,
      repoUrl,
      agentId,
      twilioNumber,
      palette: site.brand.palette,
      missingFields,
      portalStatus,
    });
  }

  CURRENT_SITE_LABEL = '';

  // Step 10 (tail): the Clerk test login, once per client, after every site is attached.
  log(10, `Portal test login`);
  await provisionPortalTestLogin({
    email: portalEmail,
    useTestLogin,
    testPassword,
    primaryClientDir: primaryClientDirFor(baseSlug, intake),
    baseSlug,
  });

  await printHandoff({ intake, provisioned, sharedBaseId, baseSlug, portalEmail });

  if (DRY_RUN) {
    console.log('=== DRY RUN COMPLETE — no resources were created ===\n');
  }
}

// Only provision when invoked as the CLI. The guard exists so verification scripts can
// import the pure blueprint/format helpers below and exercise them against the real master
// scenario without the import itself kicking off a live run.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    reportFatal(err);
    process.exit(1);
  });
}

// Exported for scripts/verify-*.js and test/*.test.mjs. Copying any of these into a verifier
// or a test instead would recreate the drift this repo has already been bitten by — a checker
// that validates its own private copy of the logic proves nothing about what onboard.js will
// do. Everything here is pure or returns its computed result, which is what makes a dry run
// able to assert on the same values the real run writes.
export {
  OnboardError,
  // Make / Airtable wiring
  patchPostCallBlueprint,
  airtableFieldMap,
  CALL_LOG_FIELDS,
  // Phone publishing
  formatPhoneForDisplay,
  resolvePublishedPhone,
  applyTwilioNumberToSite,
  // Env + schema shaping
  buildClientEnvLines,
  readEnvLocal,
  stripInterfaceBlocks,
  // Repo schema ownership — see lib/provisioned-fields.js for the console/onboard contract
  installClientSchema,
  updateRepoSchemaFields,
  // Slug / directory / tag derivation
  deriveBaseSlug,
  isMultiSite,
  siteSlugFor,
  siteDirFor,
  siteTagFor,
  intakeIsWebOnly,
  // Prompt regeneration for existing clients (scripts/regenerate-prompt.js)
  loadIntake,
  generateRetellPrompt,
  // Validation
  validateSite,
  validateIntake,
  preflight,
  // Reporting
  analyticsLines,
};
