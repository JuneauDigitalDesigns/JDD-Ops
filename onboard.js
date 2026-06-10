#!/usr/bin/env node
/**
 * jdd-ops/onboard.js — provisioning orchestrator.
 *
 * Usage:
 *   npm run onboard -- --schema clients/{slug}/site.ts [--dry-run]
 *
 * Plan-tier behavior:
 *   - starter    → site only (no voice agent, no Twilio, no Airtable)
 *   - growth     → site + 1 Retell agent + 1 Twilio number + 1 Airtable base
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
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, basename, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';
import Anthropic from '@anthropic-ai/sdk';
import { Octokit } from '@octokit/rest';
import twilio from 'twilio';
import { syncEnvToVercel, sanitizeProjectName } from './lib/vercel-sync.js';
import { createClerkClient } from '@clerk/backend';

const TOTAL_STEPS = 10;

let DRY_RUN = false;
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
  const args = { schema: null, dryRun: false, setGa4: null, slug: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--schema' && argv[i + 1]) {
      args.schema = argv[i + 1];
      i++;
    } else if (argv[i] === '--dry-run') {
      args.dryRun = true;
    } else if (argv[i] === '--set-ga4' && argv[i + 1]) {
      args.setGa4 = argv[i + 1];
      i++;
    } else if (argv[i] === '--slug' && argv[i + 1]) {
      args.slug = argv[i + 1];
      i++;
    } else if (argv[i] === '--help' || argv[i] === '-h') {
      console.log('Usage:');
      console.log('  npm run onboard -- --schema clients/{slug}/site.ts [--dry-run]');
      console.log('  npm run onboard -- --slug {slug} --set-ga4 properties/{id}');
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
  // wipe RETELL_AGENT_ID / TWILIO_NUMBER / AIRTABLE_BASE_ID / MAKE_WEBHOOK_URL.
  const prev = readEnvLocal(clientDir);
  const keep = (k) => (prev[k] ? prev[k] : '');
  let body;
  if (plan === 'starter') {
    body = `# Auto-generated by onboard.js — do not edit by hand
LEAD_DELIVERY_MODE=email
LEAD_TO_EMAIL=${content.brand.email}
RESEND_API_KEY=${keep('RESEND_API_KEY')}
RESEND_FROM_EMAIL=leads@juneaudigitaldesigns.com
VERCEL_PROJECT_NAME=${siteSlug}
`;
  } else {
    body = `# Auto-generated by onboard.js — do not edit by hand
LEAD_DELIVERY_MODE=webhook
RETELL_AGENT_ID=${keep('RETELL_AGENT_ID')}
TWILIO_NUMBER=${keep('TWILIO_NUMBER')}
AIRTABLE_BASE_ID=${keep('AIRTABLE_BASE_ID')}
MAKE_WEBHOOK_URL=${keep('MAKE_WEBHOOK_URL')}
VERCEL_PROJECT_NAME=${siteSlug}
`;
  }
  writeFileSync(envPath, body, 'utf8');
  const preserved = ['RETELL_AGENT_ID', 'TWILIO_NUMBER', 'AIRTABLE_BASE_ID', 'MAKE_WEBHOOK_URL'].filter((k) => prev[k]);
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
      phone: content.brand.phone,
      email: content.brand.email,
      address: content.brand.address,
      license: content.brand.license,
      tagline: content.brand.tagline,
    },
    services: (content.services?.items ?? []).map((s) => ({
      name: s.t,
      description: s.d,
      tag: s.tag,
    })),
    faq: content.faq?.items ?? [],
    about: content.about?.body ?? '',
    pillars: (content.about?.pillars ?? []).map((p) => ({ title: p.t, detail: p.d })),
    trustBadges: content.extensions?.trustBadges ?? [],
    bookingUrl: content.extensions?.bookingUrl ?? '',
    hours: content.extensions?.hours ?? null,
  };

  const system = `You write system prompts for Retell AI voice agents at local service businesses. The agent handles inbound calls 24/7 and outbound callbacks within 60 seconds of website form submissions.

Required behavior:
- Warm greeting with exact business name
- Qualify: service, timeline, location, decision-maker
- Answer FAQs ONLY from provided data — never guess
- For unknowns: defer to owner ("Let me have ${content.brand.short || content.brand.name} follow up on that")
- Collect: full name, callback number, email if offered
- Confirm next step
- Tone: professional, warm, never pushy
- Never mention competitors, never quote prices

Write as a direct instruction to the AI in present tense.
Output prompt text only — no markdown, no explanation.`;

  const user = `Business context:\n${JSON.stringify(agentContext, null, 2)}\n\nWrite the complete agent system prompt now.`;

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
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
    console.log(`  Reusing existing Retell agent ${existingAgentId} (skipping create)`);
    return existingAgentId;
  }
  if (DRY_RUN) {
    dryLog(`would POST https://api.retellai.com/create-agent for "${content.brand.name}"`);
    dryLog(`would patch RETELL_AGENT_ID into ${clientDir}/.env.local`);
    return '<dry-run-agent-id>';
  }
  const apiKey = requireEnv('RETELL_API_KEY');
  const llmId = requireEnv('RETELL_LLM_ID');
  const voiceId = requireEnv('RETELL_DEFAULT_VOICE_ID');

  const res = await fetch('https://api.retellai.com/create-agent', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      agent_name: content.brand.name,
      response_engine: { type: 'retell-llm', llm_id: llmId },
      voice_id: voiceId,
      general_prompt: agentPrompt,
      begin_message: `Thank you for calling ${content.brand.name}. How can I help you today?`,
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
// Step 8a: Provision a Retell-managed phone number
//
// Retell owns/manages the number (provider: Twilio under the hood) and binds it
// to the agent for BOTH inbound and outbound. This is required for the outbound
// lead-callback flow: Retell's create-phone-call only accepts a from_number that
// Retell purchased or imported. We try the client's local area code first, then
// fall back to toll-free. The resulting number is stored as TWILIO_NUMBER for
// backward-compat (the Make scenario references <<<TWILIO_NUMBER>>> as
// create-phone-call's from_number).
// ───────────────────────────────────────────────────────────────────────────

async function provisionRetellNumber(content, agentId, clientDir) {
  log(8, `Provision Retell-managed phone number (inbound + outbound → agent)`);
  const existingNumber = readEnvLocal(clientDir).TWILIO_NUMBER;
  if (existingNumber) {
    console.log(`  Reusing existing number ${existingNumber} (skipping purchase)`);
    return existingNumber;
  }
  if (DRY_RUN) {
    dryLog(`would POST https://api.retellai.com/create-phone-number bound to agent ${agentId} (inbound+outbound)`);
    dryLog(`would try local area code from ${content.brand.phone}, then toll-free`);
    dryLog(`would patch TWILIO_NUMBER into ${clientDir}/.env.local`);
    return '<dry-run-number>';
  }
  const apiKey = requireEnv('RETELL_API_KEY');

  const digits = (content.brand.phone || '').replace(/\D/g, '');
  const areaCode = digits.length >= 10 ? parseInt(digits.slice(-10, -7), 10) : null;

  const bind = {
    inbound_agents: [{ agent_id: agentId, weight: 1 }],
    outbound_agents: [{ agent_id: agentId, weight: 1 }],
    nickname: content.brand.name,
  };

  async function tryCreate(body, label) {
    const res = await fetch('https://api.retellai.com/create-phone-number', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) return await res.json();
    console.log(`  ${label} request failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
    return null;
  }

  let data = null;
  if (areaCode) {
    console.log(`  Requesting local number in area code ${areaCode}…`);
    data = await tryCreate({ ...bind, area_code: areaCode }, `local ${areaCode}`);
    if (!data) console.log(`  No local number — falling back to toll-free`);
  } else {
    console.log(`  Could not derive an area code from brand.phone="${content.brand.phone}" — using toll-free`);
  }
  if (!data) {
    data = await tryCreate({ ...bind, toll_free: true }, 'toll-free');
  }
  if (!data) fail(8, `Could not provision a Retell number (local ${areaCode || 'n/a'} and toll-free both failed).`);

  const number = data.phone_number;
  if (!number) fail(8, `Retell create-phone-number response missing phone_number: ${JSON.stringify(data)}`);
  console.log(`  Provisioned ${number} (${data.phone_number_type || 'retell'}) bound to ${agentId} for inbound + outbound`);
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
// Step 8c: Register agent in Make data store (retell-agent-lookup)
//
// The master post-call Make scenario looks up agent_id → { base_id,
// client_name, table_name } to route call logs to the correct Airtable base.
// Without this entry the lookup fails and no Airtable rows are written.
// ───────────────────────────────────────────────────────────────────────────

async function registerInMakeLookup(agentId, content, baseId) {
  log(8, `Register agent in Make data store (retell-agent-lookup)`);
  const apiKey  = process.env.MAKE_API_KEY;
  const dsId    = process.env.MAKE_DATA_STORE_ID;
  if (!apiKey || !dsId) {
    console.warn(`  ⚠ MAKE_API_KEY or MAKE_DATA_STORE_ID not set — skipping data store registration.`);
    console.warn(`    Add the agent manually: key=${agentId}, base_id=${baseId}, client_name=${content.brand.name}, table_name=Call Log`);
    return;
  }
  if (DRY_RUN) {
    dryLog(`would upsert key=${agentId} → base_id=${baseId}, client_name=${content.brand.name}, table_name=Call Log`);
    return;
  }

  const base    = 'https://us2.make.com/api/v2';
  const headers = { Authorization: `Token ${apiKey}`, 'Content-Type': 'application/json' };
  const record  = { base_id: baseId, client_name: content.brand.name, table_name: 'Call Log' };

  // PATCH updates an existing key (flat body, no wrapper).
  // Falls back to POST (create) if the key doesn't exist yet (404).
  // Make returns 400 "duplicate key" on POST if the key already exists, so PATCH-first is safest.
  let res = await fetch(`${base}/data-stores/${dsId}/data/${encodeURIComponent(agentId)}`, {
    method: 'PATCH', headers, body: JSON.stringify(record),
  });
  if (res.status === 404) {
    res = await fetch(`${base}/data-stores/${dsId}/data`, {
      method: 'POST', headers, body: JSON.stringify({ key: agentId, data: record }),
    });
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    console.warn(`  ⚠ Make data store upsert failed (${res.status}): ${txt.slice(0, 200)}`);
    console.warn(`    Add manually: key=${agentId}, base_id=${baseId}, client_name=${content.brand.name}, table_name=Call Log`);
    return;
  }
  console.log(`  Registered: ${agentId} → ${content.brand.name} (${baseId})`);
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
        LEAD_DELIVERY_MODE: plan === 'starter' ? 'email' : 'webhook',
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

async function provisionClerkUser({ intake, provisioned, sharedBaseId, baseSlug }) {
  log(10, `Provision Clerk portal user`);

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    console.warn(`  ⚠ CLERK_SECRET_KEY not set — skipping Clerk user creation. Run CLERK setup first (see RUNBOOK.md).`);
    return;
  }

  // For single-site: clients/{slug}/.env.local
  // For enterprise: clients/{slug}/site-1/.env.local (the primary site dir)
  const primaryClientDir = intake.sites.length === 1
    ? resolve('clients', baseSlug)
    : resolve('clients', baseSlug, 'site-1');

  const existingUserId = readEnvLocal(primaryClientDir).CLERK_USER_ID;
  if (existingUserId) {
    console.log(`  Reusing existing Clerk user ${existingUserId} (skipping create)`);
    return existingUserId;
  }

  if (DRY_RUN) {
    dryLog(`would create Clerk user for ${intake.sites[0].brand.email}`);
    dryLog(`would set publicMetadata: { slug: "${baseSlug}", plan: "${intake.plan}", canonical: "${intake.sites[0].seo?.canonical ?? ''}", airtableBaseId: ..., ga4PropertyId: null }`);
    dryLog(`would patch CLERK_USER_ID into ${primaryClientDir}/.env.local`);
    return;
  }

  const clerk = createClerkClient({ secretKey });

  const airtableBaseId = intake.plan !== 'starter'
    ? (sharedBaseId || readEnvLocal(primaryClientDir).AIRTABLE_BASE_ID || null)
    : null;

  const publicMetadata = {
    slug: baseSlug,
    plan: intake.plan,
    canonical: intake.sites[0].seo?.canonical ?? '',
    airtableBaseId,
    ga4PropertyId: null,
    ...(intake.plan === 'enterprise' ? {
      sites: intake.sites.map((s, i) => ({
        slug: provisioned[i]?.siteSlug ?? `${baseSlug}-${i + 1}`,
        canonical: s.seo?.canonical ?? '',
        ga4PropertyId: null,
      })),
    } : {}),
  };

  let user;
  try {
    user = await clerk.users.createUser({
      emailAddress: [intake.sites[0].brand.email],
      publicMetadata,
    });
  } catch (err) {
    // If user already exists (e.g. re-run), look them up instead
    if (err?.errors?.[0]?.code === 'form_identifier_exists') {
      const list = await clerk.users.getUserList({ emailAddress: [intake.sites[0].brand.email] });
      user = list.data?.[0];
      if (user) {
        console.log(`  Clerk user already exists (${user.id}) — updating metadata`);
        await clerk.users.updateUserMetadata(user.id, { publicMetadata });
      } else {
        console.warn(`  ⚠ Could not create or find Clerk user for ${intake.sites[0].brand.email}`);
        return;
      }
    } else {
      console.warn(`  ⚠ Clerk user creation failed: ${err?.message ?? err}`);
      return;
    }
  }

  console.log(`  Clerk user: ${user.id} (${intake.sites[0].brand.email})`);
  patchEnvLocal(primaryClientDir, 'CLERK_USER_ID', user.id);
  return user.id;
}

// Updates a client's Clerk portal user with their GA4 property ID.
// Usage: node onboard.js --slug {slug} --set-ga4 properties/{id}
async function setGa4Property(slug, ga4PropertyId) {
  console.log(`\n[set-ga4] Updating portal metadata for slug "${slug}"`);

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) fail(0, 'CLERK_SECRET_KEY not set. Cannot update Clerk metadata.');

  // Look for CLERK_USER_ID in single-site or enterprise-primary location
  const singleDir = resolve('clients', slug);
  const enterpriseDir = resolve('clients', slug, 'site-1');
  const clientDir = existsSync(resolve(singleDir, '.env.local')) ? singleDir : enterpriseDir;
  const userId = readEnvLocal(clientDir).CLERK_USER_ID;

  if (!userId) {
    fail(0, `CLERK_USER_ID not found in ${clientDir}/.env.local. Run full onboarding first.`);
  }

  const clerk = createClerkClient({ secretKey });
  const user = await clerk.users.getUser(userId);
  const existing = user.publicMetadata ?? {};

  // For enterprise, also offer per-site GA4 update if --site is provided (future: add --site flag)
  await clerk.users.updateUserMetadata(userId, {
    publicMetadata: { ...existing, ga4PropertyId },
  });

  console.log(`  Updated Clerk user ${userId} → ga4PropertyId: ${ga4PropertyId}`);
  console.log(`\n  Next: add the JDD service account email as a Viewer on the GA4 property.`);
  console.log(`        (Google Analytics → Admin → Property Access Management)`);
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
    console.log(`    3. Once GA4 is set up: npm run onboard -- --slug ${baseSlug} --set-ga4 properties/{id}`);
  } else {
    console.log(`    1. Checkpoint 1 — review Vercel preview URL(s).`);
    console.log(`    2. Checkpoint 2 — test-call each Twilio number; tune each agent-prompt.txt.`);
    provisioned.forEach((p) => {
      if (p.agentId) {
        const slugForCmd = intake.sites.length === 1 ? baseSlug : `${baseSlug}/site-${p.index + 1}`;
        console.log(`         npm run update-prompt -- ${p.agentId} --slug ${slugForCmd}`);
      }
    });
    console.log(`    3. Checkpoint 3 — submit a test lead per site; confirm Retell call + Airtable row.`);
    console.log(`    4. Paste each Make webhook URL into the per-site .env.local, then \`npm run sync-env\`.`);
    console.log(`    5. Portal GA4: add JDD service account as Viewer on client GA4 property, then:`);
    console.log(`         npm run onboard -- --slug ${baseSlug} --set-ga4 properties/{id}`);
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
    // growth / enterprise voice + CRM stack. Phone numbers are now provisioned
    // and owned by Retell (not bought directly on Twilio), so Twilio account
    // credentials are no longer required here.
    need('ANTHROPIC_API_KEY');
    need('RETELL_API_KEY');
    need('RETELL_LLM_ID');
    need('RETELL_DEFAULT_VOICE_ID');
    need('AIRTABLE_API_KEY');
    need('AIRTABLE_WORKSPACE_ID');
    fmt('ANTHROPIC_API_KEY', 'sk-ant-');
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

  // Short-circuit: --set-ga4 flag updates Clerk metadata only, no provisioning
  if (args.setGa4) {
    if (!args.slug) fail(0, '--set-ga4 requires --slug {slug}');
    await setGa4Property(args.slug, args.setGa4);
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
    writeClientEnvLocal(clientDir, siteSlug, intake.plan, site);
    buildClientRepo(repoDir);

    let agentId = null;
    let twilioNumber = null;

    if (intake.plan === 'starter') {
      console.log(`\n  Skipping voice provisioning (plan=starter).`);
    } else {
      const agentPrompt = await generateRetellPrompt(site, clientDir, siteSlug);
      agentId = await createRetellAgent(site, agentPrompt, clientDir);
      twilioNumber = await provisionRetellNumber(site, agentId, clientDir);

      if (i === 0) {
        sharedBaseId = await createAirtableBase(intake, site, clientDir);
      } else {
        patchEnvLocal(clientDir, 'AIRTABLE_BASE_ID', sharedBaseId);
        patchEnvLocal(clientDir, 'AIRTABLE_SITE_TAG', site.brand.short);
        console.log(`  Reusing shared Airtable base ${sharedBaseId} (site tag: ${site.brand.short})`);
      }
      await registerInMakeLookup(agentId, site, sharedBaseId || readEnvLocal(clientDir).AIRTABLE_BASE_ID);
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
