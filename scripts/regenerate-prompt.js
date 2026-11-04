#!/usr/bin/env node
/**
 * scripts/regenerate-prompt.js — write a NEW agent-prompt.txt for an existing client, through
 * onboard.js's real prompt generator.
 *
 * Usage:
 *   npm run regenerate-prompt -- --slug <slug>           # single-site client
 *   npm run regenerate-prompt -- --slug <slug> --site 2  # an enterprise site
 *
 * onboard.js reuses the prompt on disk once an agent exists, to protect hand-tuning. That is right
 * for a resume, and wrong when the generator's instructions changed after the client was onboarded
 * — the opening-line rules, the consent ask (re-approved 2026-11-04), the voicemail hang-up. Their
 * agents kept prompts that never ask for consent. This regenerates on purpose.
 *
 * LOCAL ONLY. It writes clients/<slug>/agent-prompt.txt (the old one saved beside it as
 * agent-prompt.<timestamp>.prev.txt) and changes nothing in Retell. Review the diff, then push it
 * with `npm run update-prompt -- --slug <slug> --business "<Business Name>"`.
 *
 * The generator itself refuses a prompt that paraphrases the approved consent ask.
 */

import dotenv from 'dotenv';
dotenv.config({ override: true });

import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { loadIntake, generateRetellPrompt } from '../onboard.js';
import { placesCallbacks } from '../lib/client-env.js';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : null;
};
const slug = arg('slug');
if (!slug) {
  console.error('regenerate-prompt: Missing --slug <slug>');
  process.exit(2);
}
const siteNo = arg('site') ? Number(arg('site')) : null;

const single = resolve('clients', slug, 'site.ts');
const schemaPath = existsSync(single) ? single : resolve('clients', slug, 'site-1', 'site.ts');
const intake = await loadIntake(schemaPath);
const index = siteNo ? siteNo - 1 : 0;
const content = intake.sites[index];
if (!content) {
  console.error(`regenerate-prompt: ${slug} has no site ${index + 1}`);
  process.exit(2);
}
const clientDir = intake.sites.length > 1 ? resolve('clients', slug, `site-${index + 1}`) : resolve('clients', slug);

const promptFile = resolve(clientDir, 'agent-prompt.txt');
const before = existsSync(promptFile) ? readFileSync(promptFile, 'utf8') : null;
if (before !== null) {
  const saved = resolve(clientDir, `agent-prompt.${new Date().toISOString().replace(/[:.]/g, '-')}.prev.txt`);
  copyFileSync(promptFile, saved);
  console.log(`Saved the current prompt to ${saved}`);
}

// Outbound rules only if this agent places callbacks. LEAD_CALLBACK in .env.local is what the site
// actually does (a downgrade flips it); the plan is the fallback for a client without one.
const envPath = resolve(clientDir, '.env.local');
const recorded = existsSync(envPath) ? /^LEAD_CALLBACK=(on|off)s*$/m.exec(readFileSync(envPath, 'utf8'))?.[1] : null;
const callbacks = recorded ? recorded === 'on' : placesCallbacks(intake.plan);
console.log(`Callbacks: ${callbacks ? 'yes — inbound + outbound rules' : 'no — inbound only'} (${recorded ? `LEAD_CALLBACK=${recorded}` : `plan ${intake.plan}`})`);

const after = await generateRetellPrompt(content, clientDir, slug, { regenerate: true, callbacks });
console.log(`\nBusiness: "${content.brand.name}"`);
console.log(`Prompt: ${before === null ? 'none' : `${before.length.toLocaleString()} chars`} → ${after.length.toLocaleString()} chars`);
console.log(`Next: review the diff, then npm run update-prompt -- --slug ${slug} --business "${content.brand.name}"`);
