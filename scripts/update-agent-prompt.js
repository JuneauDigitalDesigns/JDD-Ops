#!/usr/bin/env node
/**
 * scripts/update-agent-prompt.js — re-upload a tuned Retell prompt.
 *
 * Used at Checkpoint 2 after manually editing clients/{slug}/agent-prompt.txt.
 *
 * Usage:
 *   npm run update-prompt -- <agentId> --slug <slug>               # upload existing agent-prompt.txt
 *   npm run update-prompt -- <agentId> --file <path>               # any path, relative to repo root
 *   npm run update-prompt -- <agentId> --slug <slug> --regen       # re-generate via Claude, then upload
 *
 * `--file` exists for JDD's own demo-line agent, whose prompt lives at demo/agent-prompt.txt
 * rather than under clients/. It isn't a client — it's the sales script on the public demo
 * number — and .gitignore excludes /clients/*, so keeping it there meant it was never
 * version-controlled. `--file` wins when both are given.
 *
 * `--regen` reads the plan from LEAD_DELIVERY_MODE in clients/{slug}/.env.local
 * (email=starter, callback=growth/enterprise), generates a fresh prompt via Claude,
 * writes it to clients/{slug}/agent-prompt.txt, then uploads it. Requires ANTHROPIC_API_KEY.
 */

import 'dotenv/config';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { generateStarterPrompt, generateGrowthPrompt } from '../lib/agent-prompt.js';

function fail(msg, err) {
  console.error(`update-agent-prompt: ${msg}`);
  if (err) console.error(err);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { agentId: null, slug: null, file: null, regen: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--slug' && argv[i + 1]) {
      args.slug = argv[i + 1];
      i++;
    } else if (argv[i] === '--file' && argv[i + 1]) {
      args.file = argv[i + 1];
      i++;
    } else if (argv[i] === '--regen') {
      args.regen = true;
    } else if (!args.agentId && !argv[i].startsWith('--')) {
      args.agentId = argv[i];
    }
  }
  return args;
}

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

/**
 * Load site content from clients/{slug}/site.ts.
 * Mirrors the TS-stripping logic in onboard.js loadIntake; returns the first site's
 * SiteContent (INTAKE envelope) or the top-level CONTENT (legacy shape).
 */
async function loadSiteContent(slug) {
  const schemaPath = resolve('clients', slug, 'site.ts');
  if (!existsSync(schemaPath)) fail(`No site.ts found at ${schemaPath}`);
  const src = readFileSync(schemaPath, 'utf8');
  const stripped = src
    .replace(/(?:export\s+)?interface\s+\w+[^{]*\{(?:[^{}]|\{[^{}]*\})*\}/gs, '')
    .replace(/:\s*SiteContent/g, '')
    .replace(/:\s*Intake/g, '')
    .replace(/^import .*$/gm, '')
    .replace(/^export type .*?;$/gms, '');
  const dataUrl = 'data:text/javascript;base64,' + Buffer.from(stripped).toString('base64');
  let mod;
  try {
    mod = await import(dataUrl);
  } catch (err) {
    fail(`Could not parse site.ts for "${slug}": ${err.message}`, err);
  }
  if (mod.INTAKE?.sites?.[0]) return mod.INTAKE.sites[0];
  if (mod.CONTENT) return mod.CONTENT;
  fail(`site.ts for "${slug}" must export INTAKE or CONTENT`);
}

async function main() {
  const { agentId, slug, file, regen } = parseArgs(process.argv);
  if (!agentId) fail('Missing <agentId>. Usage: npm run update-prompt -- <agentId> --slug <slug>');
  if (!slug && !file) fail('Missing --slug <slug> or --file <path>');

  // --regen: generate a fresh prompt from Claude (plan from .env.local), write it to
  // disk, then fall through to the normal upload path below.
  if (regen) {
    if (!slug) fail('--regen requires --slug <slug>');
    const env = readEnvLocal(resolve('clients', slug));
    const deliveryMode = env.LEAD_DELIVERY_MODE;
    if (!deliveryMode) {
      fail(`No LEAD_DELIVERY_MODE in clients/${slug}/.env.local — cannot infer plan. Run onboard.js first.`);
    }
    const plan = deliveryMode === 'email' ? 'starter' : 'growth';
    console.log(`Regenerating prompt for plan="${plan}" (LEAD_DELIVERY_MODE=${deliveryMode})...`);
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) fail('ANTHROPIC_API_KEY not set in .env');
    const anthropic = new Anthropic();
    const content = await loadSiteContent(slug);
    const clientDir = resolve('clients', slug);
    const newPrompt = plan === 'starter'
      ? await generateStarterPrompt(content, clientDir, slug, anthropic)
      : await generateGrowthPrompt(content, clientDir, slug, anthropic);
    console.log(`Prompt regenerated (${newPrompt.length} chars) — written to clients/${slug}/agent-prompt.txt`);
    // Fall through: promptPath below resolves to the file we just wrote.
  }

  const apiKey = process.env.RETELL_API_KEY;
  if (!apiKey) fail('RETELL_API_KEY not set in .env');

  // --file wins, so a caller who passes an explicit path never silently gets a client's prompt.
  const promptPath = file ? resolve(file) : resolve('clients', slug, 'agent-prompt.txt');
  if (!existsSync(promptPath)) fail(`Prompt file not found: ${promptPath}`);
  const prompt = readFileSync(promptPath, 'utf8').trim();
  if (!prompt) fail(`Prompt file is empty: ${promptPath}`);

  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };

  // The prompt lives on the agent's LLM, not the agent itself (retell-llm engine).
  // Look up the agent's bound llm_id, then update that LLM's general_prompt.
  const agentRes = await fetch(`https://api.retellai.com/get-agent/${agentId}`, { headers });
  if (!agentRes.ok) fail(`Retell get-agent ${agentId} returned ${agentRes.status}: ${await agentRes.text().catch(() => '')}`);
  const agent = await agentRes.json();
  const llmId = agent.response_engine?.llm_id;
  if (!llmId) {
    fail(`Agent ${agentId} is not backed by a retell-llm engine (response_engine=${JSON.stringify(agent.response_engine)}). Cannot update prompt.`);
  }

  console.log(`Uploading prompt (${prompt.length} chars) → Retell LLM ${llmId} (agent ${agentId})`);

  const res = await fetch(`https://api.retellai.com/update-retell-llm/${llmId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ general_prompt: prompt }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '<unreadable>');
    fail(`Retell API returned ${res.status}: ${text}`);
  }

  console.log(`✓ LLM ${llmId} (agent ${agentId}) updated.`);
}

main().catch((err) => fail('unhandled error', err));
