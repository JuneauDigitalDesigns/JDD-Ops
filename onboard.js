#!/usr/bin/env node
/**
 * jdd-ops/onboard.js — provisioning orchestrator.
 *
 * Usage:
 *   npm run onboard -- --schema clients/{slug}/site.ts [--dry-run] [--receptionist forwarded|published|declined] [--reexport-on-plan-mismatch]
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
import { generateStarterPrompt, generateGrowthPrompt } from './lib/agent-prompt.js';
import { Octokit } from '@octokit/rest';
import twilio from 'twilio';
import {
  syncEnvToVercel,
  syncVercelFirewall,
  sanitizeProjectName,
  vercelAppHost,
  getVercelProjectId,
  getProjectAnalytics,
  listProjectDomains,
} from './lib/vercel-sync.js';
import { createClerkClient } from '@clerk/backend';
// toE164 comes from the package for the same reason vercelAppHost does: five copies had
// already diverged on the E.164 regex, and nothing compared them. lib/site-routes/*.ts keep
// their own inline copy deliberately — those files are written verbatim into client repos,
// which have no @jdd/schema dependency.
import { buildPortalSiteEntries, isWebOnly, leadModeFor, toE164 } from '@jdd/schema';
import {
  attachSiteToAccount,
  detachSiteFromAccount,
  accountStoreConfigured,
} from './lib/account-store.js';
import {
  ensureClientRecord,
  clientRecordsConfigured,
} from './lib/client-record-store.js';

const TOTAL_STEPS = 10;

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

function log(step, msg) {
  const tag = CURRENT_SITE_LABEL ? ` ${CURRENT_SITE_LABEL}` : '';
  console.log(`\n[step ${step}/${TOTAL_STEPS}${tag}] ${msg}`);
}

function fail(step, msg, err) {
  console.error(`\n[step ${step}/${TOTAL_STEPS}] FAIL: ${msg}`);
  if (err) console.error(err);
  process.exit(1);
}

function dryLog(msg) {
  console.log(`  [dry-run] ${msg}`);
}

function run(cmd, opts = {}) {
  if (DRY_RUN) {
    dryLog(`would run: ${cmd}`);
    return;
  }
  console.log(`  $ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', ...opts });
}

function parseArgs(argv) {
  const args = {
    schema: null,
    dryRun: false,
    slug: null,
    linkPortal: false,
    testPortal: false,
    email: null,
    receptionist: null,
    reexportOnPlanMismatch: false,
  };
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
    } else if (argv[i] === '--reexport-on-plan-mismatch') {
      // §2.2 escape hatch for an INTAKE envelope whose plan disagrees with a site's
      // _meta.selectedPlan (see validateIntake). Absent, that mismatch hard-fails; present,
      // onboard re-stamps the mismatched site(s) to the envelope plan and continues. The
      // "re-export and continue" option must be stated, never the default — matching the
      // receptionist precedent, a money-spending correction is never assumed.
      args.reexportOnPlanMismatch = true;
    } else if (argv[i] === '--help' || argv[i] === '-h') {
      console.log('Usage:');
      console.log('  npm run onboard -- --schema clients/{slug}/site.ts [--dry-run] [--receptionist forwarded|published|declined] [--reexport-on-plan-mismatch]');
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

/**
 * §2.2 escape hatch: re-stamp `_meta.selectedPlan` to `intake.plan` on each mismatched site,
 * in place in the schema file on disk, without round-tripping the file through a serializer
 * (console/src/lib/export.ts's writeSiteContent/writeClientIntake are server-only and would
 * also rewrite fields this guard has no business touching). Both schema shapes serialize each
 * site's _meta.selectedPlan as a JSON-quoted `"selectedPlan": "<plan>"` line, in `sites[]`
 * order (console/src/lib/export.ts:745 JSON.stringifies the whole INTAKE envelope; the legacy
 * CONTENT shape is single-site and can never reach here mismatched — see §0), so the Nth match
 * in the file is site[N]. If that count disagrees with intake.sites.length, the file isn't in
 * the shape this rewrite understands — refuse rather than guess which occurrence is which.
 *
 * Returns the set of site indices it actually rewrote; the caller hard-fails any mismatch not
 * in that set, so a partial match-count failure still aborts instead of silently no-op'ing.
 */
function reexportMismatchedSites(schemaPath, intake, mismatches) {
  const rewritten = new Set();
  if (DRY_RUN) {
    for (const m of mismatches) {
      dryLog(`would rewrite site[${m.index}] _meta.selectedPlan "${m.sitePlan}" -> "${intake.plan}" in ${schemaPath}`);
      rewritten.add(m.index);
    }
    return rewritten;
  }
  let src;
  try {
    src = readFileSync(schemaPath, 'utf8');
  } catch {
    return rewritten;
  }
  const re = /"selectedPlan"\s*:\s*"([^"]*)"/g;
  const matches = [...src.matchAll(re)];
  if (matches.length !== intake.sites.length) return rewritten;

  const toFix = new Map(mismatches.map((m) => [m.index, m]));
  let out = '';
  let last = 0;
  matches.forEach((m, i) => {
    out += src.slice(last, m.index);
    const fix = toFix.get(i);
    if (fix) {
      out += m[0].replace(`"${m[1]}"`, `"${intake.plan}"`);
      rewritten.add(i);
    } else {
      out += m[0];
    }
    last = m.index + m[0].length;
  });
  out += src.slice(last);
  writeFileSync(schemaPath, out, 'utf8');
  return rewritten;
}

function validateIntake(intake, opts = {}) {
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
  // Form field-set vs lead-delivery coupling (PLAN-tier-form-wiring §0).
  // Each site's form reads _meta.selectedPlan to choose email- vs phone-capture; onboard sets
  // LEAD_DELIVERY_MODE from intake.plan. For a CONTENT schema these are the same field and cannot
  // disagree (loadIntake derives intake.plan from it directly). For an INTAKE envelope they are
  // separate, so assert them equal here: a mismatch means the already-built site collects the
  // wrong field for the route we are about to provision, and every lead is lost silently.
  if (Array.isArray(intake.sites)) {
    const mismatches = [];
    intake.sites.forEach((site, i) => {
      const sitePlan = site?._meta?.selectedPlan;
      if (sitePlan && sitePlan !== intake.plan) mismatches.push({ index: i, sitePlan });
    });
    if (mismatches.length) {
      const rewritten = opts.reexportOnPlanMismatch
        ? reexportMismatchedSites(opts.schemaPath, intake, mismatches)
        : new Set();
      for (const m of mismatches) {
        if (rewritten.has(m.index)) {
          console.warn(
            `  ! site[${m.index}] re-exported: _meta.selectedPlan "${m.sitePlan}" -> "${intake.plan}" ` +
            `(--reexport-on-plan-mismatch)`,
          );
          intake.sites[m.index]._meta.selectedPlan = intake.plan;
        } else {
          const action = opts.reexportOnPlanMismatch
            ? 'Automatic re-export failed for this site (schema file did not match the expected shape) — re-export it manually'
            : 'Re-export the site for the correct plan';
          errors.push(
            `site[${m.index}] was built for plan "${m.sitePlan}" but this run provisions "${intake.plan}" ` +
            `(lead form would be ${leadModeFor(m.sitePlan)}-capture while /api/contact runs ` +
            `${intake.plan === 'starter' ? 'email' : 'callback'}). ${action} ` +
            `in the console Build studio, or correct the plan, before provisioning.`,
          );
        }
      }
    }
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
  if (DRY_RUN) {
    dryLog(`would write ${clientDir}/.env.local (preserving any already-provisioned IDs)`);
    return;
  }
  const envPath = resolve(clientDir, '.env.local');
  // Preserve already-provisioned values so re-runs are idempotent and don't
  // wipe RETELL_AGENT_ID / TWILIO_NUMBER / AIRTABLE_BASE_ID.
  const prev = readEnvLocal(clientDir);
  const keep = (k) => (prev[k] ? prev[k] : '');

  /**
   * Assembled from two parts rather than copy-pasted templates, because the shapes overlap now.
   *
   *  - Lead delivery: Starter (receptionist or web-only) hands web-form leads to the owner by
   *    email; Growth and Enterprise call them back. This matches syncVercelEnv's
   *    `LEAD_DELIVERY_MODE` exactly, which is the only intended runtime difference between a
   *    Starter-with-receptionist and a Growth site.
   *  - Voice: everything except a web-only client gets the number, agent, forwarding and call
   *    log. Starter joined this in the 2026-10-12 reprice; only a declined receptionist opts out.
   */
  const wantsEmailLeads = plan === 'starter';
  const wantsVoice = !webOnly;
  const lines = ['# Auto-generated by onboard.js — edit via the console /manage tab, which also syncs to Vercel. Values here are preserved on re-run.'];
  lines.push(`LEAD_DELIVERY_MODE=${wantsEmailLeads ? 'email' : 'callback'}`);
  if (wantsEmailLeads) {
    lines.push(`LEAD_TO_EMAIL=${content.brand.email}`);
    lines.push(`LEAD_BRAND_NAME=${content.brand.name}`);
    lines.push(`RESEND_API_KEY=${keep('RESEND_API_KEY')}`);
    lines.push('RESEND_FROM_EMAIL=leads@juneaudigitaldesigns.com');
  }
  if (wantsVoice) {
    lines.push(`RETELL_AGENT_ID=${keep('RETELL_AGENT_ID')}`);
    lines.push(`RETELL_LLM_ID=${keep('RETELL_LLM_ID')}`);
    lines.push(`RETELL_API_KEY=${process.env.RETELL_API_KEY || ''}`);
    lines.push(`RETELL_SIP_DOMAIN=${process.env.RETELL_SIP_DOMAIN || 'sip.retellai.com'}`);
    lines.push(`TWILIO_NUMBER=${keep('TWILIO_NUMBER')}`);
    // Human-first routing: the caller's own line rings first, the agent only picks up on
    // no-answer. Keep the window under ~20s or the owner's carrier voicemail answers first,
    // Twilio scores the call answered, and the agent never gets it.
    lines.push(`CLIENT_FORWARD_PHONE=${content.brand.phone}`);
    lines.push(`CLIENT_FORWARD_RING_SECONDS=${keep('CLIENT_FORWARD_RING_SECONDS') || '15'}`);
    lines.push(`AIRTABLE_BASE_ID=${keep('AIRTABLE_BASE_ID')}`);
    lines.push(`RETELL_POST_CALL_WEBHOOK_URL=${keep('RETELL_POST_CALL_WEBHOOK_URL')}`);
  }
  lines.push(`VERCEL_PROJECT_NAME=${siteSlug}`);
  let body = lines.join('\n') + '\n';
  // Keys onboard.js writes LATER in the run (steps 8–10) and that are absent from the
  // templates above. Without this they are silently dropped on every re-run — and
  // PORTAL_ACCOUNT_EMAIL in particular is what a later `--link-portal --email` reads to know
  // which account to move the sites off.
  const CARRIED_KEYS = ['AIRTABLE_SITE_TAG', 'CLERK_USER_ID', 'PORTAL_ACCOUNT_EMAIL'];
  const carried = CARRIED_KEYS.filter((k) => prev[k]);
  for (const k of carried) body += `${k}=${prev[k]}\n`;

  writeFileSync(envPath, body, 'utf8');
  const preserved = [
    ...['RETELL_AGENT_ID', 'TWILIO_NUMBER', 'CLIENT_FORWARD_PHONE', 'AIRTABLE_BASE_ID'].filter((k) => prev[k]),
    ...carried,
  ];
  console.log(`  Wrote ${envPath}${preserved.length ? ` (preserved: ${preserved.join(', ')})` : ''}`);
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
// Step 7: Create Retell agent
// ───────────────────────────────────────────────────────────────────────────

async function createRetellAgent(content, agentPrompt, clientDir, plan) {
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
    dryLog(`would POST https://api.retellai.com/create-agent for "${content.brand.name}"`);
    dryLog(`would patch RETELL_AGENT_ID into ${clientDir}/.env.local`);
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
  // agent to it. The greeting is baked into agentPrompt, so no begin_message.
  const tplRes = await fetch(`https://api.retellai.com/get-retell-llm/${templateLlmId}`, { headers: authHeaders });
  if (!tplRes.ok) fail(7, `Retell get-retell-llm (template ${templateLlmId}) returned ${tplRes.status}: ${await tplRes.text()}`);
  const tpl = await tplRes.json();

  const llmRes = await fetch('https://api.retellai.com/create-retell-llm', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      model: tpl.model ?? 'gpt-4.1-mini',
      ...(tpl.model_high_priority !== undefined ? { model_high_priority: tpl.model_high_priority } : {}),
      ...(tpl.tool_call_strict_mode !== undefined ? { tool_call_strict_mode: tpl.tool_call_strict_mode } : {}),
      ...(Array.isArray(tpl.general_tools) ? { general_tools: tpl.general_tools } : {}),
      general_prompt: agentPrompt,
    }),
  });
  if (!llmRes.ok) fail(7, `Retell create-retell-llm returned ${llmRes.status}: ${await llmRes.text()}`);
  const llmData = await llmRes.json();
  const clientLlmId = llmData.llm_id;
  if (!clientLlmId) fail(7, `Retell create-retell-llm response missing llm_id: ${JSON.stringify(llmData)}`);
  console.log(`  Per-client LLM: ${clientLlmId}`);
  patchEnvLocal(clientDir, 'RETELL_LLM_ID', clientLlmId);

  // Structured fields Retell extracts after each call and includes in the
  // call_ended webhook (under call_analysis.custom_analysis_data). The shared
  // Make post-call scenario uses these to text the owner a brief. The generated
  // prompt is what makes the agent actually collect name/callback/urgency.
  const postCallAnalysisData = [
    {
      type: 'string',
      name: 'caller_name',
      description: "The caller's full name as they gave it. Empty string if never provided.",
    },
    {
      type: 'string',
      name: 'callback_number',
      description:
        'The best callback number the caller asked to be reached at, as spoken during the call (digits only). If none was spoken, use the number they called from.',
    },
    {
      type: 'enum',
      name: 'urgency',
      choices: ['Immediate service', 'Callback requested', 'General inquiry'],
      description:
        'How urgent the call is. "Immediate service" for emergencies or safety/comfort-critical issues; "Callback requested" when they want the team to call back about real work; "General inquiry" for questions or non-urgent interest.',
    },
  ];

  // Growth and Enterprise agents handle both inbound and outbound calls. This field
  // lets the post-call Make scenario populate the Airtable "Call type" column.
  // Starter agents only handle inbound, so the field is unnecessary and omitted.
  if (plan !== 'starter') {
    postCallAnalysisData.push({
      type: 'enum',
      name: 'call_source',
      choices: ['inbound', 'web_form'],
      description:
        'How this call originated. Use "inbound" when the customer called in; use "web_form" when this was an outbound callback triggered by a website form submission. Determine from call direction and context.',
    });
  }

  const res = await fetch('https://api.retellai.com/create-agent', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      agent_name: content.brand.name,
      response_engine: { type: 'retell-llm', llm_id: clientLlmId },
      voice_id: voiceId,
      max_call_duration_ms: MAX_CALL_DURATION_MS,
      post_call_analysis_data: postCallAnalysisData,
    }),
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
    const results = await client.availablePhoneNumbers('US').local.list({ ...query, limit: 1 });
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

  const fields = [
    { name: 'Date', type: 'dateTime', options: { dateFormat: { name: 'us' }, timeFormat: { name: '12hour' }, timeZone: 'client' } },
    { name: 'Caller name', type: 'singleLineText' },
    { name: 'Caller number', type: 'phoneNumber' },
    { name: 'Summary', type: 'multilineText' },
    { name: 'Duration (seconds)', type: 'number', options: { precision: 0 } },
    {
      name: 'Call type',
      type: 'singleSelect',
      options: { choices: [{ name: 'Inbound' }, { name: 'Outbound callback' }] },
    },
    {
      name: 'Outcome',
      type: 'singleSelect',
      options: {
        choices: [
          { name: 'Qualified' },
          { name: 'Not qualified' },
          { name: 'Follow-up needed' },
          { name: 'No answer' },
          { name: 'Voicemail' },
        ],
      },
    },
  ];

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

async function cloneAndWirePostCall(agentId, content, clientDir, baseId, siteTag, smsAlerts) {
  log(8, `Clone post-call Make scenario + wire Retell webhook`);

  const existing = readEnvLocal(clientDir).RETELL_POST_CALL_WEBHOOK_URL;
  if (existing) {
    console.log(`  Reusing existing post-call webhook ${existing} (skipping clone)`);
    return existing;
  }

  const apiKey   = process.env.MAKE_API_KEY;
  const masterId = process.env.MAKE_POST_CALL_MASTER_SCENARIO_ID;
  const fromNum  = readEnvLocal(clientDir).TWILIO_NUMBER;      // this client's provisioned number

  // The SMS destination now comes from the owner's recorded consent, not from
  // content.brand.phone. brand.phone is the number printed on the client's website — a
  // front desk, a shared line, sometimes a landline — and nobody ever agreed to receive
  // texts there. smsAlerts.phone is the number the owner typed beside a checkbox they
  // ticked, which is the only number we have permission to text.
  const smsEnabled = smsAlerts?.consented === true && Boolean(smsAlerts?.phone);
  const toNum      = smsEnabled ? (toE164(smsAlerts.phone) ?? '') : '';

  if (smsEnabled) {
    console.log(`  SMS alerts: ON → ${toNum} (consented ${smsAlerts.consentedAt ?? 'unknown'})`);
  } else {
    console.log(`  SMS alerts: OFF (no consent on file) — Twilio module will be removed from the clone`);
  }

  if (!apiKey || !masterId) {
    console.warn(`  ⚠ MAKE_API_KEY or MAKE_POST_CALL_MASTER_SCENARIO_ID not set — skipping post-call clone.`);
    console.warn(`    Clone by hand: base=${baseId}, from=${fromNum}, to=${toNum || '(no SMS — remove the Twilio module)'}, agent=${agentId}`);
    return null;
  }
  if (DRY_RUN) {
    dryLog(`would clone scenario ${masterId} → "Post-call: ${content.brand.name}"`);
    dryLog(`would patch Airtable base=${baseId}${siteTag ? `, Site=${siteTag}` : ''}`);
    dryLog(smsEnabled
      ? `would patch Twilio from=${fromNum}, to=${toNum}`
      : `would REMOVE the Twilio module (no SMS consent on file)`);
    dryLog(`would activate clone, read webhook URL, set Retell agent ${agentId} webhook_url`);
    return null;
  }

  const headers = { Authorization: `Token ${apiKey}`, 'Content-Type': 'application/json' };

  // 1) Clone the master scenario.
  let res = await fetch(`${MAKE_ZONE}/scenarios/${masterId}/clone`, {
    method: 'POST', headers,
    body: JSON.stringify({ name: `Post-call: ${content.brand.name}` }),
  });
  if (!res.ok) fail(8, `Make clone returned ${res.status}: ${await res.text()}`);
  const cloneId = (await res.json())?.scenario?.id;
  if (!cloneId) fail(8, `Make clone response missing scenario id`);
  console.log(`  Cloned scenario ${cloneId}`);

  // 2) GET the clone's blueprint, patch per-client values, PATCH it back.
  res = await fetch(`${MAKE_ZONE}/scenarios/${cloneId}/blueprint`, { headers });
  if (!res.ok) fail(8, `Make get-blueprint returned ${res.status}: ${await res.text()}`);
  const blueprint = (await res.json())?.response?.blueprint;
  patchPostCallBlueprint(blueprint, { baseId, siteTag, fromNum, toNum, smsEnabled }); // mutates in place

  res = await fetch(`${MAKE_ZONE}/scenarios/${cloneId}`, {
    method: 'PATCH', headers,
    body: JSON.stringify({ blueprint: JSON.stringify(blueprint) }),
  });
  if (!res.ok) fail(8, `Make patch-blueprint returned ${res.status}: ${await res.text()}`);

  // 3) Resolve the clone's webhook URL (module 1 = custom webhook trigger).
  //    NOTE: verify this response shape against your Make zone (see report §8).
  res = await fetch(`${MAKE_ZONE}/scenarios/${cloneId}/hooks`, { headers });
  const webhookUrl = (await res.json())?.hooks?.[0]?.url;
  if (!webhookUrl) fail(8, `Could not resolve clone webhook URL`);

  // 4) Activate the clone.
  await fetch(`${MAKE_ZONE}/scenarios/${cloneId}/start`, { method: 'POST', headers });
  console.log(`  Activated clone; webhook ${webhookUrl}`);

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

// Rewrites the cloned blueprint's Airtable + Twilio modules for this client.
// Modules are matched by app name so it survives module-id changes on clone.
// NOTE: mapper field keys ('base' / 'from' / 'to' / 'Site') depend on how the
// master's modules are configured — confirm against a GET of the master
// blueprint before the first live run (see report §8).
function patchPostCallBlueprint(blueprint, { baseId, siteTag, fromNum, toNum, smsEnabled }) {
  const flows = blueprint?.flow ?? [];
  for (const mod of flows) {
    const app = mod.module ?? '';
    if (app.startsWith('airtable')) {
      mod.mapper = mod.mapper ?? {};
      mod.mapper.base = baseId;
      if (siteTag) mod.mapper.Site = siteTag; // enterprise per-site tag
    }
    if (app.startsWith('twilio') && smsEnabled) {
      mod.mapper = mod.mapper ?? {};
      mod.mapper.from = fromNum;
      mod.mapper.to = toNum;
    }
  }

  // No consent means the module comes out of the flow entirely, rather than being left
  // with an empty `to`. An unconfigured module errors on every run, and enough errors get
  // a Make scenario auto-disabled — which would take the Airtable call log down with it.
  // Removing it leaves a scenario that logs calls correctly and simply never texts.
  if (!smsEnabled && Array.isArray(blueprint?.flow)) {
    const before = blueprint.flow.length;
    blueprint.flow = blueprint.flow.filter((m) => !(m.module ?? '').startsWith('twilio'));
    const removed = before - blueprint.flow.length;
    if (removed > 0) console.log(`  Removed ${removed} Twilio module(s) from the clone (no SMS consent)`);
  }
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
  try {
    execSync(`git diff --cached --quiet`, { cwd: repoDir });
    console.log(`  Nothing to commit — skipping push.`);
    return;
  } catch {
    // diff has staged changes — proceed
  }
  const safeMsg = brandName.replace(/['`$\\]/g, '');
  run(`git commit -m "feat: initial provisioning for ${safeMsg}"`, { cwd: repoDir });
  const token = process.env.GITHUB_TOKEN;
  const remoteUrl = execSync('git remote get-url origin', { cwd: repoDir }).toString().trim();
  const authed = remoteUrl.replace('https://', `https://${token}@`);
  run(`git -c credential.helper= push ${authed} HEAD:main`, { cwd: repoDir });
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
        LEAD_DELIVERY_MODE: plan === 'starter' ? 'email' : 'callback',
      },
    });

    // Apply the standard anti-scraping WAF rate limits. Best-effort: a firewall failure
    // (plan, permission, transient) must never fail onboarding — the per-repo robots.ts +
    // middleware.ts already protect the site regardless.
    const fw = await syncVercelFirewall(siteSlug);
    if (fw.ok) {
      console.log(`  ✓ Firewall rules synced: ${fw.applied.join('; ')}`);
    } else {
      console.warn(`  ⚠ Firewall rules not applied: ${fw.reason}. Retry later with the console or re-run onboard.`);
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

  const account = await attachSiteToAccount(email, entry);
  const n = account.sites.length;
  console.log(`  Linked "${siteSlug}" → ${email} (status ${status}, ${n} site${n === 1 ? '' : 's'} on account)`);

  // Record which account owns this site so a later --email re-link can clean up the old one.
  patchEnvLocal(clientDir, 'PORTAL_ACCOUNT_EMAIL', email);

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
      console.log(`  Portal test login → ${email} / ${testPassword}`);
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

  console.log(`  Portal test login → ${email} / ${testPassword} (user ${user.id})`);
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
  validateIntake(intake, { schemaPath });

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

function preflight(intake) {
  console.log('\n[pre-flight] Validating credentials & ID formats…');
  if (DRY_RUN) {
    console.log('  [dry-run] skipping live credential checks');
    return;
  }
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

  // Email lead delivery. Both Starter variants (receptionist and web-only) hand web-form leads
  // to the owner by email, so Resend is needed on Starter regardless of the receptionist.
  if (intake.plan === 'starter' && !process.env.RESEND_API_KEY) {
    warnings.push('RESEND_API_KEY not set — starter lead emails will not send until configured');
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
    }
  }

  for (const w of warnings) console.warn(`  ⚠ ${w}`);
  if (errors.length) {
    for (const e of errors) console.error(`  ✗ ${e}`);
    fail(0, `Pre-flight failed (${errors.length} issue${errors.length === 1 ? '' : 's'}) — fix .env and re-run. No resources were created.`);
  }
  console.log('  ✓ Pre-flight passed');
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
    await linkPortal(args.slug, { email: args.email });
    return;
  }

  if (DRY_RUN) {
    console.log('\n=== DRY RUN MODE — no external API calls, no file writes outside this print ===\n');
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
  validateIntake(intake, { reexportOnPlanMismatch: args.reexportOnPlanMismatch, schemaPath: args.schema });
  preflight(intake);
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
    writeClientSchema(repoDir, site);
    writeApiRoutes(repoDir);
    writeClientEnvLocal(clientDir, siteSlug, intake.plan, site, webOnly);
    buildClientRepo(repoDir);

    let agentId = null;
    let twilioNumber = null;

    // Keyed on web-only, not on plan: Starter now provisions the full voice stack like Growth
    // (the only runtime difference is LEAD_DELIVERY_MODE=email, set in syncVercelEnv). The only
    // client that skips this is one who declined the receptionist.
    if (webOnly) {
      console.log(`\n  Skipping voice provisioning (website-only client, receptionist declined).`);
    } else {
      // Re-run detection: if an agent already exists AND the plan hasn't changed (same
      // LEAD_DELIVERY_MODE), reuse the existing agent-prompt.txt rather than burning
      // an Anthropic token. If the plan changed (e.g. starter → growth upgrade), the
      // old inbound-only prompt is wrong — regenerate it. First run (no RETELL_AGENT_ID)
      // always generates.
      const existingEnv = readEnvLocal(clientDir);
      const prevMode = existingEnv.LEAD_DELIVERY_MODE;   // 'email'=starter, 'callback'=growth|enterprise
      const currentMode = intake.plan === 'starter' ? 'email' : 'callback';
      const isFirstRun = !existingEnv.RETELL_AGENT_ID;
      const planChanged = !isFirstRun && prevMode && prevMode !== currentMode;
      const promptPath = resolve(clientDir, 'agent-prompt.txt');

      let agentPrompt;
      if (isFirstRun || planChanged) {
        if (planChanged) {
          log(6, `Plan changed (LEAD_DELIVERY_MODE: ${prevMode} → ${currentMode}) — regenerating agent prompt`);
        } else {
          log(6, `Claude → agent prompt`);
        }
        if (DRY_RUN) {
          dryLog(`would generate ${intake.plan === 'starter' ? 'STARTER (inbound-only)' : 'GROWTH (inbound + outbound)'} agent prompt for "${site.brand.name}"`);
          dryLog(`would write ${promptPath}`);
          agentPrompt = '<dry-run prompt>';
        } else {
          requireEnv('ANTHROPIC_API_KEY');
          const anthropic = new Anthropic();
          agentPrompt = intake.plan === 'starter'
            ? await generateStarterPrompt(site, clientDir, site.brand.short || siteSlug, anthropic)
            : await generateGrowthPrompt(site, clientDir, site.brand.short || siteSlug, anthropic);
          console.log(`  Review agent-prompt.txt before Checkpoint 2 — you will tune it on a test call`);
        }
      } else {
        // Same plan, re-run: read prompt from disk.
        if (existsSync(promptPath)) {
          agentPrompt = readFileSync(promptPath, 'utf8');
          log(6, `Reusing existing agent-prompt.txt (same plan, re-run). Edit via /manage Voice agent or: npm run update-prompt -- --regen --slug ${siteSlug}`);
        } else {
          log(6, `agent-prompt.txt missing on re-run — regenerating`);
          if (DRY_RUN) {
            dryLog(`would regenerate prompt for "${site.brand.name}"`);
            agentPrompt = '<dry-run prompt>';
          } else {
            requireEnv('ANTHROPIC_API_KEY');
            const anthropic = new Anthropic();
            agentPrompt = intake.plan === 'starter'
              ? await generateStarterPrompt(site, clientDir, site.brand.short || siteSlug, anthropic)
              : await generateGrowthPrompt(site, clientDir, site.brand.short || siteSlug, anthropic);
          }
        }
      }
      agentId = await createRetellAgent(site, agentPrompt, clientDir, intake.plan);
      twilioNumber = await provisionTwilioNumber(site, siteSlug, clientDir);

      // The value written into the Call Log's `Site` column — the provisioning slug, and set
      // for EVERY enterprise site including the first. Tagging only sites 2+ left site 1's
      // rows untagged, and the portal shows untagged rows under every site.
      const siteTag = siteTagFor(baseSlug, intake, i);

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
        // Envelope-level: one owner, one consented cell, however many sites they run.
        intake.smsAlerts,
      );
    }

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

main().catch((err) => fail(0, 'unhandled error in onboard.js', err));
