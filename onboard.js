#!/usr/bin/env node
/**
 * jdd-ops/onboard.js — provisioning orchestrator.
 *
 * Usage:
 *   npm run onboard -- --schema clients/{slug}/site.ts [--dry-run]
 *
 * Plan-tier behavior:
 *   - starter    → site only (no voice agent, no Airtable)
 *   - growth     → site + 1 Retell agent + 1 JDD-owned Twilio number + 1 Airtable base
 *   - enterprise → N sites (N from intake.sites.length); each with its own
 *                  Retell agent + Twilio number; shared master Retell account
 *                  (= shared minute pool); shared Airtable base with a
 *                  per-site Site column.
 *
 * Intake shape (clients/{slug}/site.ts):
 *   - New: `export const INTAKE: Intake = { plan, siteCount, sites: [...] }`
 *   - Legacy: `export const CONTENT: SiteContent = {...}` (auto-wrapped to a
 *     single-site Intake using CONTENT._meta.selectedPlan as the plan).
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
import { syncEnvToVercel, sanitizeProjectName, getVercelProjectId } from './lib/vercel-sync.js';
import { createClerkClient } from '@clerk/backend';
import { attachSiteToAccount, accountStoreConfigured } from './lib/account-store.js';

const TOTAL_STEPS = 10;

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

// Normalize a US phone number to E.164 (+1XXXXXXXXXX). Returns null if it can't
// be parsed. Mirrors toE164() in the site template's /api/voice route so the
// number we hand to Make/Twilio for SMS matches the format used at call time.
function toE164(raw) {
  const trimmed = String(raw ?? '').trim();
  if (/^\+\d{8,15}$/.test(trimmed)) return trimmed; // already E.164
  const d = trimmed.replace(/\D/g, '');
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith('1')) return `+${d}`;
  return null;
}

function parseArgs(argv) {
  const args = { schema: null, dryRun: false, slug: null, linkPortal: false, testPortal: false, email: null };
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
    } else if (argv[i] === '--help' || argv[i] === '-h') {
      console.log('Usage:');
      console.log('  npm run onboard -- --schema clients/{slug}/site.ts [--dry-run]');
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
    const plan = mod.CONTENT?._meta?.selectedPlan ?? 'growth';
    return { plan, siteCount: 1, sites: [mod.CONTENT] };
  }
  fail(1, 'Schema must export INTAKE or CONTENT');
}

function validateSite(content, label) {
  const errors = [];
  const required = [
    ['brand.name', content?.brand?.name],
    ['brand.short', content?.brand?.short],
    ['brand.phone', content?.brand?.phone],
    ['brand.email', content?.brand?.email],
    ['brand.palette.accent', content?.brand?.palette?.accent],
    ['brand.palette.bg', content?.brand?.palette?.bg],
    ['brand.palette.ink', content?.brand?.palette?.ink],
  ];
  for (const [path, val] of required) {
    if (!val) errors.push(`${label}: missing required field ${path}`);
  }
  return errors;
}

function validateIntake(intake) {
  const errors = [];
  const validPlans = new Set(['starter', 'growth', 'enterprise']);
  if (!validPlans.has(intake.plan)) {
    errors.push(`unknown plan "${intake.plan}" (expected starter|growth|enterprise)`);
  }
  if (!Array.isArray(intake.sites) || intake.sites.length < 1) {
    errors.push('intake.sites must contain at least 1 site');
  }
  if (intake.plan === 'enterprise' && (intake.sites.length < 2 || intake.sites.length > 3)) {
    errors.push(`enterprise plan requires 2 or 3 sites (got ${intake.sites.length})`);
  }
  intake.sites.forEach((site, i) => {
    errors.push(...validateSite(site, `site[${i + 1}/${intake.sites.length}]`));
  });
  if (intake.plan === 'enterprise') {
    const shorts = intake.sites.map((s) => s?.brand?.short);
    const dupes = shorts.filter((s, i, arr) => s && arr.indexOf(s) !== i);
    if (dupes.length) {
      errors.push(`enterprise sites must have unique brand.short values; duplicates: ${[...new Set(dupes)].join(', ')}`);
    }
  }
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

function siteSlugFor(baseSlug, intake, i) {
  if (intake.sites.length === 1) return baseSlug;
  return `${baseSlug}-${i + 1}`;
}

function siteDirFor(baseSlug, intake, i) {
  if (intake.sites.length === 1) return resolve('clients', baseSlug);
  return resolve('clients', baseSlug, `site-${i + 1}`);
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

function writeClientEnvLocal(clientDir, siteSlug, plan, content) {
  log(4, `Write .env.local (plan=${plan})`);
  if (DRY_RUN) {
    dryLog(`would write ${clientDir}/.env.local (preserving any already-provisioned IDs)`);
    return;
  }
  const envPath = resolve(clientDir, '.env.local');
  // Preserve already-provisioned values so re-runs are idempotent and don't
  // wipe RETELL_AGENT_ID / TWILIO_NUMBER / AIRTABLE_BASE_ID.
  const prev = readEnvLocal(clientDir);
  const keep = (k) => (prev[k] ? prev[k] : '');
  let body;
  if (plan === 'starter') {
    body = `# Auto-generated by onboard.js — do not edit by hand
LEAD_DELIVERY_MODE=email
LEAD_TO_EMAIL=${content.brand.email}
LEAD_BRAND_NAME=${content.brand.name}
RESEND_API_KEY=${keep('RESEND_API_KEY')}
RESEND_FROM_EMAIL=leads@juneaudigitaldesigns.com
VERCEL_PROJECT_NAME=${siteSlug}
`;
  } else {
    body = `# Auto-generated by onboard.js — do not edit by hand
LEAD_DELIVERY_MODE=callback
RETELL_AGENT_ID=${keep('RETELL_AGENT_ID')}
RETELL_LLM_ID=${keep('RETELL_LLM_ID')}
RETELL_API_KEY=${process.env.RETELL_API_KEY || ''}
RETELL_SIP_DOMAIN=${process.env.RETELL_SIP_DOMAIN || 'sip.retellai.com'}
TWILIO_NUMBER=${keep('TWILIO_NUMBER')}
CLIENT_FORWARD_PHONE=${content.brand.phone}
CLIENT_FORWARD_RING_SECONDS=${keep('CLIENT_FORWARD_RING_SECONDS') || '25'}
AIRTABLE_BASE_ID=${keep('AIRTABLE_BASE_ID')}
RETELL_POST_CALL_WEBHOOK_URL=${keep('RETELL_POST_CALL_WEBHOOK_URL')}
VERCEL_PROJECT_NAME=${siteSlug}
`;
  }
  writeFileSync(envPath, body, 'utf8');
  const preserved = ['RETELL_AGENT_ID', 'TWILIO_NUMBER', 'CLIENT_FORWARD_PHONE', 'AIRTABLE_BASE_ID'].filter((k) => prev[k]);
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
// Step 6: Generate Retell prompt via Claude
// ───────────────────────────────────────────────────────────────────────────

async function generateRetellPrompt(content, clientDir, siteSlug) {
  log(6, `Claude → Retell agent prompt`);
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

  const system = `You write the complete system prompt for a Retell AI voice agent that works the phones for a single local service business. The agent handles inbound calls and returns outbound callbacks placed within ~60 seconds of a website form submission.

Output ONLY the finished agent prompt as a Markdown document with "##" section headers, in this exact order:
ROLE, CORE SPEAKING RULES, GREETING, IF ASKED WHETHER YOU'RE A REAL PERSON / AN AI, QUALIFICATION, NO SCHEDULING, CONTACT COLLECTION, ANSWERING QUESTIONS, SERVICES, FAQ, WHY CHOOSE, PRICING, CLOSING, EDGE CASES, NEVER.
No preamble, no explanation, no code fences — just the prompt itself, written as direct second-person instructions to the agent ("You are…", "You never…").

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
- Spoken-number formatting: read phone numbers back in natural grouped chunks ("four oh seven… five five five… one two one two"), say times like a person ("tomorrow around two," not "14:00"), and when taking a callback number READ IT BACK GROUPED and confirm it's right.

GREETING: include an inbound variant and an outbound-callback variant (for website inquiries), both using the persona name and the exact business name.

QUALIFICATION: let the caller describe the problem first, then fill gaps ONE question at a time — what they need (map to the provided services), timeline/urgency, and location. Define a short list of URGENT triggers appropriate to THIS business's trade (infer from the services/industry — e.g. for HVAC: no heat/AC in dangerous weather, burning smells, sparking or electrical issues, heavy water leaks, vulnerable people in the home). For urgent calls, tell the agent to stay calm, reassure the caller the team prioritizes emergencies, and collect details quickly — but STILL never promise an arrival time. Have the agent gauge and internally note the urgency as exactly one of: "Immediate service", "Callback requested", or "General inquiry" (this label is used downstream, so use those exact words).

LOCATION / SERVICE AREA: if a serviceArea list is provided, use those town names; otherwise refer to the business's city (from its address) and "the surrounding area." If a caller is outside it, be gracious and say the team will confirm whether they can help.

NO SCHEDULING (its own section): state plainly that the agent collects details and hands off to a human for scheduling; it never offers, holds, or confirms a time. Give one or two example lines of redirecting a caller who wants to book right now.

CONTACT COLLECTION (do before ending every call), one item at a time: full name, best callback number (read back grouped and confirm), and optionally email (never pressure).

ANSWERING QUESTIONS: answer only from provided data; for unknowns, offer to have the team follow up. SERVICES: list from the provided services. FAQ: derive from the provided FAQ data and answer in natural words, not verbatim. WHY CHOOSE: include only verifiable points grounded in the provided data (about/pillars/trust badges) — no invented awards, review counts, or guarantees. PRICING: never quote; defer to the team.

CLOSING: warm, brief summary that the agent has what it needs and a person from the team will reach out to schedule / follow up.

EDGE CASES to cover: silence/no response; leaving a short friendly voicemail on outbound; an angry or frustrated caller; off-topic / non-service requests; and a caller who wants a human right now (reassure and capture details for a fast callback — never pretend to transfer if it can't).

NEVER (consolidated list): sounding robotic or scripted; stacking questions; quoting prices; booking/scheduling/holding appointments or promising arrival times or ETAs; inventing hours, names, license numbers, or any fact; mentioning competitors; pressuring the caller; talking over an interruption.

Keep everything warm, specific to this business, and grounded only in the provided data.`;

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
  console.log(`  Review this before Checkpoint 2 — you will tune it on a test call`);
  return prompt;
}

// ───────────────────────────────────────────────────────────────────────────
// Step 7: Create Retell agent
// ───────────────────────────────────────────────────────────────────────────

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

  const res = await fetch('https://api.retellai.com/create-agent', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      agent_name: content.brand.name,
      response_engine: { type: 'retell-llm', llm_id: clientLlmId },
      voice_id: voiceId,
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
    const dryHost = sanitizeProjectName(siteSlug).replace(/_/g, '-');
    dryLog(`would search Twilio for local number (area code from brand.phone) then toll-free`);
    dryLog(`would purchase number and set voiceUrl → https://${dryHost}.vercel.app/api/voice`);
    dryLog(`would patch TWILIO_NUMBER into ${clientDir}/.env.local`);
    return '<dry-run-number>';
  }

  const accountSid = requireEnv('TWILIO_ACCOUNT_SID');
  const authToken  = requireEnv('TWILIO_AUTH_TOKEN');
  const client     = twilio(accountSid, authToken);
  // Use the Vercel-safe hostname: strip leading punctuation and replace underscores
  // (underscores are not valid in DNS hostnames; Vercel renders them as hyphens).
  const vercelHost = sanitizeProjectName(siteSlug).replace(/_/g, '-');
  const voiceUrl   = `https://${vercelHost}.vercel.app/api/voice`;

  const digits   = (content.brand.phone || '').replace(/\D/g, '');
  const areaCode = digits.length >= 10 ? digits.slice(-10, -7) : null;

  let numberRecord = null;

  if (areaCode) {
    console.log(`  Searching for local number in area code ${areaCode}…`);
    const results = await client.availablePhoneNumbers('US').local.list({ areaCode, limit: 1 });
    if (results.length) {
      numberRecord = await client.incomingPhoneNumbers.create({
        phoneNumber: results[0].phoneNumber,
        voiceUrl,
        voiceMethod: 'POST',
      });
      console.log(`  Purchased local number ${numberRecord.phoneNumber}`);
    } else {
      console.log(`  No local number in ${areaCode} — falling back to toll-free`);
    }
  } else {
    console.log(`  Could not derive an area code from brand.phone="${content.brand.phone}" — using toll-free`);
  }

  if (!numberRecord) {
    const tfResults = await client.availablePhoneNumbers('US').tollFree.list({ limit: 1 });
    if (!tfResults.length) fail(8, `No toll-free numbers available in Twilio account`);
    numberRecord = await client.incomingPhoneNumbers.create({
      phoneNumber: tfResults[0].phoneNumber,
      voiceUrl,
      voiceMethod: 'POST',
    });
    console.log(`  Purchased toll-free number ${numberRecord.phoneNumber}`);
  }

  const number = numberRecord.phoneNumber;
  patchEnvLocal(clientDir, 'TWILIO_NUMBER', number);
  return number;
}

// ───────────────────────────────────────────────────────────────────────────
// Step 8b: Create Airtable base (shared for Enterprise)
// ───────────────────────────────────────────────────────────────────────────

async function createAirtableBase(intake, primaryContent, clientDir) {
  const existingBaseId = readEnvLocal(clientDir).AIRTABLE_BASE_ID;
  if (existingBaseId) {
    log(8, `Reusing existing Airtable base ${existingBaseId} (skipping create)`);
    return existingBaseId;
  }
  const isEnterprise = intake.sites.length > 1;
  const baseLabel = isEnterprise
    ? `${primaryContent.brand.name} — Calls (${intake.sites.length} sites)`
    : `${primaryContent.brand.name} — Calls`;
  log(8, `Create Airtable base "${baseLabel}"`);
  if (DRY_RUN) {
    dryLog(`would create Airtable base "${baseLabel}" with Call Log table`);
    if (isEnterprise) {
      dryLog(`  + Site singleSelect column with choices: ${intake.sites.map((s) => s.brand.short).join(', ')}`);
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
        choices: intake.sites.map((s) => ({ name: s.brand.short })),
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

async function cloneAndWirePostCall(agentId, content, clientDir, baseId, siteTag) {
  log(8, `Clone post-call Make scenario + wire Retell webhook`);

  const existing = readEnvLocal(clientDir).RETELL_POST_CALL_WEBHOOK_URL;
  if (existing) {
    console.log(`  Reusing existing post-call webhook ${existing} (skipping clone)`);
    return existing;
  }

  const apiKey   = process.env.MAKE_API_KEY;
  const masterId = process.env.MAKE_POST_CALL_MASTER_SCENARIO_ID;
  const fromNum  = readEnvLocal(clientDir).TWILIO_NUMBER;      // this client's provisioned number
  const toNum    = toE164(content.brand.phone) ?? '';         // owner's cell (== CLIENT_FORWARD_PHONE)

  if (!apiKey || !masterId) {
    console.warn(`  ⚠ MAKE_API_KEY or MAKE_POST_CALL_MASTER_SCENARIO_ID not set — skipping post-call clone.`);
    console.warn(`    Clone by hand: base=${baseId}, from=${fromNum}, to=${toNum}, agent=${agentId}`);
    return null;
  }
  if (DRY_RUN) {
    dryLog(`would clone scenario ${masterId} → "Post-call: ${content.brand.name}"`);
    dryLog(`would patch Airtable base=${baseId}${siteTag ? `, Site=${siteTag}` : ''}, Twilio from=${fromNum}, to=${toNum}`);
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
  patchPostCallBlueprint(blueprint, { baseId, siteTag, fromNum, toNum }); // mutates in place

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
function patchPostCallBlueprint(blueprint, { baseId, siteTag, fromNum, toNum }) {
  const flows = blueprint?.flow ?? [];
  for (const mod of flows) {
    const app = mod.module ?? '';
    if (app.startsWith('airtable')) {
      mod.mapper = mod.mapper ?? {};
      mod.mapper.base = baseId;
      if (siteTag) mod.mapper.Site = siteTag; // enterprise per-site tag
    }
    if (app.startsWith('twilio')) {
      mod.mapper = mod.mapper ?? {};
      mod.mapper.from = fromNum;
      mod.mapper.to = toNum;
    }
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

async function provisionClerkUser({ intake, provisioned, sharedBaseId, baseSlug, forceRelink = false, emailOverride = null }) {
  log(10, `Link portal account`);

  // For single-site: clients/{slug}/.env.local
  // For enterprise: clients/{slug}/site-1/.env.local (the primary site dir)
  const primaryClientDir = intake.sites.length === 1
    ? resolve('clients', baseSlug)
    : resolve('clients', baseSlug, 'site-1');

  // Test clients (e2e slugs, or --test-portal) additionally get a real Clerk login with
  // a known password, so you can sign in without owning the placeholder brand.email
  // inbox. REAL clients are deliberately never pre-created in Clerk — they self-serve
  // sign up at /portal/sign-up, and an account that already exists for their email
  // would block that signup. Their portal access comes from the account record below.
  const isTestClient = baseSlug.startsWith('_e2e') || FORCE_TEST_PORTAL;
  const testEmail = process.env.PORTAL_TEST_EMAIL || null;
  const testPassword = process.env.PORTAL_TEST_PASSWORD || null;
  const useTestLogin = isTestClient && !!testEmail && !!testPassword;
  if (isTestClient && !useTestLogin) {
    console.warn(`  ⚠ Test client but PORTAL_TEST_EMAIL / PORTAL_TEST_PASSWORD not set in .env — falling back to brand.email with no password.`);
  }

  // An explicit --email selects WHICH account the site attaches to, for when the client
  // signed up with a different address than brand.email.
  // (`forceRelink` is retained for call-site compatibility but no longer gates anything:
  // attaching is an idempotent upsert, so there is nothing to skip or force.)
  void forceRelink;
  const overrideEmail = emailOverride && emailOverride.trim() ? emailOverride.trim() : null;
  const email = overrideEmail ?? (useTestLogin ? testEmail : intake.sites[0]?.brand?.email);
  if (!email) {
    console.warn(`  ⚠ No email available (brand.email empty and no --email given) — skipping portal link.`);
    return;
  }

  // For test clients, point canonical at the live Vercel URL so the portal's
  // Performance tab pings a real host instead of the placeholder domain.
  const testCanonical = `https://${sanitizeProjectName(baseSlug).replace(/_/g, '-')}.vercel.app`;
  const canonical = useTestLogin ? testCanonical : (intake.sites[0]?.seo?.canonical ?? '');

  const airtableBaseId = intake.plan !== 'starter'
    ? (sharedBaseId || readEnvLocal(primaryClientDir).AIRTABLE_BASE_ID || null)
    : null;

  // The site entries to attach. Enterprise attaches one per site (sharing the Airtable
  // base, separated in the portal by the Call Log's `Site` column); everything else
  // attaches the single base slug. Vercel project ids let the portal query Web
  // Analytics — null when VERCEL_TOKEN is unset or the project isn't created yet, and
  // the portal degrades to "analytics not connected yet".
  const sitesToAttach = intake.plan === 'enterprise'
    ? await Promise.all(intake.sites.map(async (s, i) => {
        const siteSlug = provisioned[i]?.siteSlug ?? `${baseSlug}-${i + 1}`;
        return {
          slug: siteSlug,
          name: s?.brand?.name ?? '',
          canonical: s?.seo?.canonical ?? '',
          plan: intake.plan,
          status: 'live',
          airtableBaseId,
          vercelProjectId: await getVercelProjectId(siteSlug),
        };
      }))
    : [{
        slug: baseSlug,
        name: intake.sites[0]?.brand?.name ?? '',
        canonical,
        plan: intake.plan,
        status: 'live',
        airtableBaseId,
        vercelProjectId: await getVercelProjectId(baseSlug),
      }];

  if (DRY_RUN) {
    for (const s of sitesToAttach) {
      dryLog(`would upsert site "${s.slug}" (plan ${s.plan}, status live) into account ${email}`);
    }
    dryLog(`any other sites already on that account would be preserved`);
    if (useTestLogin) dryLog(`would create/update Clerk test login ${email} (+ password)`);
    return;
  }

  if (!accountStoreConfigured()) {
    console.warn(`  ⚠ KV not configured — skipping portal link. Set KV_REST_API_URL / KV_REST_API_TOKEN in jdd-ops/.env (same Upstash instance the agency site uses).`);
    return;
  }

  // Upsert each site. Other sites on the account are preserved, so provisioning a
  // returning client's second site never disturbs their first.
  for (const s of sitesToAttach) {
    const account = await attachSiteToAccount(email, s);
    const n = account.sites.length;
    console.log(`  Linked "${s.slug}" → ${email} (${n} site${n === 1 ? '' : 's'} on account)`);
  }

  // Test clients only: ensure a Clerk login exists with a known password.
  if (!useTestLogin) return;

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

// Links (or repairs) an existing client's Clerk portal user without re-running full
// provisioning. Always force-relinks (re-applies metadata even if CLERK_USER_ID is
// already saved); an optional emailOverride targets the account the client actually
// signed up with when it differs from brand.email.
// Usage: node onboard.js --slug {slug} --link-portal [--email addr] [--test-portal]
async function linkPortal(slug, opts = {}) {
  const emailOverride = opts.email ?? null;
  console.log(`\n[link-portal] Linking client "${slug}" to the Clerk portal${emailOverride ? ` (email: ${emailOverride})` : ''}`);

  const singleSchema = resolve('clients', slug, 'site.ts');
  const schemaPath = existsSync(singleSchema)
    ? singleSchema
    : resolve('clients', slug, 'site-1', 'site.ts');
  if (!existsSync(schemaPath)) {
    fail(0, `No site.ts found for slug "${slug}" (looked in clients/${slug} and clients/${slug}/site-1).`);
  }

  const intake = await loadIntake(schemaPath);
  validateIntake(intake);

  // sharedBaseId comes from the primary site's .env.local (written at provision time).
  const primaryClientDir = intake.sites.length === 1
    ? resolve('clients', slug)
    : resolve('clients', slug, 'site-1');
  const sharedBaseId = readEnvLocal(primaryClientDir).AIRTABLE_BASE_ID || null;

  // provisioned[] is only read for enterprise per-site slugs; reconstruct minimally.
  const provisioned = intake.sites.map((s, i) => ({ siteSlug: siteSlugFor(slug, intake, i) }));

  await provisionClerkUser({ intake, provisioned, sharedBaseId, baseSlug: slug, forceRelink: true, emailOverride });
}

// ───────────────────────────────────────────────────────────────────────────
// Final handoff summary
// ───────────────────────────────────────────────────────────────────────────

function printHandoff({ intake, provisioned, sharedBaseId, baseSlug }) {
  const line = '─'.repeat(64);
  console.log(`\n${line}`);
  console.log(`  ONBOARDED: ${intake.sites[0].brand.name}${intake.sites.length > 1 ? ` (Enterprise — ${intake.sites.length} sites)` : ''}`);
  console.log(`  Plan: ${intake.plan}`);
  console.log(line);
  provisioned.forEach((p, i) => {
    console.log(`\n  Site ${i + 1}/${intake.sites.length}: ${p.brandName}`);
    console.log(`    Repo          ${p.repoUrl}`);
    if (p.agentId)      console.log(`    Retell agent  ${p.agentId}`);
    if (p.twilioNumber) console.log(`    Twilio number ${p.twilioNumber}`);
    console.log(`    Accent        ${p.palette.accent}`);
    if (p.missingFields.length) {
      console.log(`    ⚠ Missing: ${p.missingFields.join(', ')}`);
    }
  });
  if (sharedBaseId) {
    console.log(`\n  Airtable base (shared): ${sharedBaseId}`);
  }
  console.log(`\n  Portal: https://juneaudigitaldesigns.com/portal`);
  console.log(`\n${line}`);
  console.log(`  Next:`);
  if (intake.plan === 'starter') {
    console.log(`    1. Verify lead email at ${intake.sites[0].brand.email} after a test form submission.`);
    console.log(`    2. Verify the deployed Vercel URL renders correctly.`);
    console.log(`    3. Enable Web Analytics on the Vercel project so the portal Traffic tab populates.`);
  } else {
    console.log(`    1. Checkpoint 1 — review Vercel preview URL(s).`);
    console.log(`    2. Checkpoint 2 — test-call each Twilio number; tune each agent-prompt.txt.`);
    provisioned.forEach((p) => {
      if (p.agentId) {
        const slugForCmd = intake.sites.length === 1 ? baseSlug : `${baseSlug}/site-${p.index + 1}`;
        console.log(`         npm run update-prompt -- ${p.agentId} --slug ${slugForCmd}`);
      }
    });
    console.log(`    3. Checkpoint 3 — submit a test lead per site; confirm the Retell callback fires`);
    console.log(`       (/api/contact → create-phone-call) + Airtable row if post-call logging is set up.`);
    console.log(`    4. Portal Traffic: enable Web Analytics on each site's Vercel project.`);
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
  if (!process.env.VERCEL_TOKEN) warnings.push('VERCEL_TOKEN not set — step 9 (Vercel sync) will be skipped');
  if (!process.env.CLERK_SECRET_KEY) warnings.push('CLERK_SECRET_KEY not set — step 10 (Clerk portal user) will be skipped. Run Clerk setup first (see RUNBOOK.md).');

  if (intake.plan === 'starter') {
    if (!process.env.RESEND_API_KEY) warnings.push('RESEND_API_KEY not set — starter lead emails will not send until configured');
  } else {
    // growth / enterprise voice + CRM stack
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
  }

  for (const w of warnings) console.warn(`  ⚠ ${w}`);
  if (errors.length) {
    for (const e of errors) console.error(`  ✗ ${e}`);
    fail(0, `Pre-flight failed (${errors.length} issue${errors.length === 1 ? '' : 's'}) — fix .env and re-run. No resources were created.`);
  }
  console.log('  ✓ Pre-flight passed');
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
  validateIntake(intake);
  preflight(intake);

  const provisioned = [];
  let sharedBaseId = null;

  for (let i = 0; i < intake.sites.length; i++) {
    const site = intake.sites[i];
    const siteSlug = siteSlugFor(baseSlug, intake, i);
    const clientDir = siteDirFor(baseSlug, intake, i);
    CURRENT_SITE_LABEL = intake.sites.length > 1 ? `site ${i + 1}/${intake.sites.length}` : '';

    const { repoDir, repoUrl } = await createRepoFromLocal(siteSlug, site, clientDir);
    writeClientSchema(repoDir, site);
    writeApiRoutes(repoDir);
    writeClientEnvLocal(clientDir, siteSlug, intake.plan, site);
    buildClientRepo(repoDir);

    let agentId = null;
    let twilioNumber = null;

    if (intake.plan === 'starter') {
      console.log(`\n  Skipping voice provisioning (plan=starter).`);
    } else {
      const agentPrompt = await generateRetellPrompt(site, clientDir, siteSlug);
      agentId = await createRetellAgent(site, agentPrompt, clientDir);
      twilioNumber = await provisionTwilioNumber(site, siteSlug, clientDir);

      if (i === 0) {
        sharedBaseId = await createAirtableBase(intake, site, clientDir);
      } else {
        patchEnvLocal(clientDir, 'AIRTABLE_BASE_ID', sharedBaseId);
        patchEnvLocal(clientDir, 'AIRTABLE_SITE_TAG', site.brand.short);
        console.log(`  Reusing shared Airtable base ${sharedBaseId} (site tag: ${site.brand.short})`);
      }
      await cloneAndWirePostCall(
        agentId, site, clientDir,
        sharedBaseId || readEnvLocal(clientDir).AIRTABLE_BASE_ID,
        i === 0 ? null : site.brand.short, // Site tag for enterprise sites 2+
      );
    }

    commitAndPush(repoDir, site.brand.name);
    await syncVercelEnv(siteSlug, site, clientDir, intake.plan);

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
    });
  }

  CURRENT_SITE_LABEL = '';

  // Step 10: Provision Clerk portal user (after Airtable so sharedBaseId is known)
  await provisionClerkUser({ intake, provisioned, sharedBaseId, baseSlug });

  printHandoff({ intake, provisioned, sharedBaseId, baseSlug });

  if (DRY_RUN) {
    console.log('=== DRY RUN COMPLETE — no resources were created ===\n');
  }
}

main().catch((err) => fail(0, 'unhandled error in onboard.js', err));
