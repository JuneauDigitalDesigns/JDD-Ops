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

import 'dotenv/config';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, basename, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';
import Anthropic from '@anthropic-ai/sdk';
import { Octokit } from '@octokit/rest';
import twilio from 'twilio';
import { syncEnvToVercel } from './lib/vercel-sync.js';

const TOTAL_STEPS = 9;

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
  const args = { schema: null, dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--schema' && argv[i + 1]) {
      args.schema = argv[i + 1];
      i++;
    } else if (argv[i] === '--dry-run') {
      args.dryRun = true;
    } else if (argv[i] === '--help' || argv[i] === '-h') {
      console.log('Usage: npm run onboard -- --schema clients/{slug}/site.ts [--dry-run]');
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

async function loadIntake(schemaPath) {
  if (!schemaPath) fail(1, 'Missing --schema argument');
  if (!existsSync(schemaPath)) fail(1, `Schema file not found: ${schemaPath}`);

  const ext = schemaPath.endsWith('.ts') ? '.ts' : '.js';
  let mod;
  try {
    if (ext === '.ts') {
      const src = readFileSync(schemaPath, 'utf8');
      const stripped = src
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
    const created = await octokit.repos.createInOrg({
      org: githubOrg,
      name: siteSlug,
      private: true,
      auto_init: false,
      description: `${content.brand.name} — managed site`,
    });
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

function writeClientEnvLocal(clientDir, siteSlug, plan, content) {
  log(4, `Write .env.local (plan=${plan})`);
  if (DRY_RUN) {
    dryLog(`would write ${clientDir}/.env.local`);
    return;
  }
  const envPath = resolve(clientDir, '.env.local');
  let body;
  if (plan === 'starter') {
    body = `# Auto-generated by onboard.js — do not edit by hand
LEAD_DELIVERY_MODE=email
LEAD_TO_EMAIL=${content.brand.email}
RESEND_API_KEY=
RESEND_FROM_EMAIL=leads@juneaudigitaldesigns.com
VERCEL_PROJECT_NAME=${siteSlug}
`;
  } else {
    body = `# Auto-generated by onboard.js — do not edit by hand
LEAD_DELIVERY_MODE=webhook
RETELL_AGENT_ID=
TWILIO_NUMBER=
AIRTABLE_BASE_ID=
MAKE_WEBHOOK_URL=
VERCEL_PROJECT_NAME=${siteSlug}
`;
  }
  writeFileSync(envPath, body, 'utf8');
  console.log(`  Wrote ${envPath}`);
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
// Step 8a: Purchase Twilio number
// ───────────────────────────────────────────────────────────────────────────

async function purchaseTwilioNumber(content, agentId, clientDir) {
  log(8, `Purchase Twilio number`);
  if (DRY_RUN) {
    dryLog(`would search Twilio for a local number near ${content.brand.phone}`);
    dryLog(`would set voice webhook to https://api.retellai.com/twilio-voice-webhook/${agentId}`);
    dryLog(`would patch TWILIO_NUMBER into ${clientDir}/.env.local`);
    return '<dry-run-number>';
  }
  const sid = requireEnv('TWILIO_ACCOUNT_SID');
  const token = requireEnv('TWILIO_AUTH_TOKEN');
  const twilioClient = twilio(sid, token);

  const digits = (content.brand.phone || '').replace(/\D/g, '');
  const areaCode = digits.length >= 10 ? digits.slice(-10, -7) : null;
  if (!areaCode) fail(8, `Could not derive area code from brand.phone="${content.brand.phone}"`);
  console.log(`  Searching area code ${areaCode}…`);

  const available = await twilioClient.availablePhoneNumbers('US').local.list({ areaCode, limit: 5 });
  if (!available.length) {
    fail(8, `No numbers available in area code ${areaCode}. Try a different area code or fall back to toll-free.`);
  }

  const number = available[0].phoneNumber;
  const voiceUrl = `https://api.retellai.com/twilio-voice-webhook/${agentId}`;
  const purchased = await twilioClient.incomingPhoneNumbers.create({
    phoneNumber: number,
    voiceUrl,
    voiceMethod: 'POST',
  });
  console.log(`  Purchased: ${purchased.phoneNumber}`);
  patchEnvLocal(clientDir, 'TWILIO_NUMBER', purchased.phoneNumber);
  return purchased.phoneNumber;
}

// ───────────────────────────────────────────────────────────────────────────
// Step 8b: Create Airtable base (shared for Enterprise)
// ───────────────────────────────────────────────────────────────────────────

async function createAirtableBase(intake, primaryContent, clientDir) {
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
// Step 8c: Commit + push client repo
// ───────────────────────────────────────────────────────────────────────────

function commitAndPush(repoDir, brandName) {
  console.log(`  Commit + push client repo…`);
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
  log(9, `Sync env to Vercel project "${siteSlug}"`);
  if (DRY_RUN) {
    dryLog(`would lookup/create Vercel project "${siteSlug}" linked to GitHub repo`);
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
  console.log(`\n${line}`);
  console.log(`  Next:`);
  if (intake.plan === 'starter') {
    console.log(`    1. Verify lead email at ${intake.sites[0].brand.email} after a test form submission.`);
    console.log(`    2. Verify the deployed Vercel URL renders correctly.`);
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
  }
  console.log('');
}

// ───────────────────────────────────────────────────────────────────────────
// Main orchestration
// ───────────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv);
  DRY_RUN = args.dryRun;
  if (DRY_RUN) {
    console.log('\n=== DRY RUN MODE — no external API calls, no file writes outside this print ===\n');
  }

  const baseSlug = deriveBaseSlug(args.schema || '');
  if (!baseSlug || baseSlug === '.' || baseSlug === '..') {
    fail(0, `Could not derive a slug from --schema "${args.schema}". Expected: clients/{slug}/site.ts`);
  }

  const intake = await loadIntake(args.schema);
  validateIntake(intake);

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
      twilioNumber = await purchaseTwilioNumber(site, agentId, clientDir);

      if (i === 0) {
        sharedBaseId = await createAirtableBase(intake, site, clientDir);
      } else {
        patchEnvLocal(clientDir, 'AIRTABLE_BASE_ID', sharedBaseId);
        patchEnvLocal(clientDir, 'AIRTABLE_SITE_TAG', site.brand.short);
        console.log(`  Reusing shared Airtable base ${sharedBaseId} (site tag: ${site.brand.short})`);
      }
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
  printHandoff({ intake, provisioned, sharedBaseId, baseSlug });

  if (DRY_RUN) {
    console.log('=== DRY RUN COMPLETE — no resources were created ===\n');
  }
}

main().catch((err) => fail(0, 'unhandled error in onboard.js', err));
