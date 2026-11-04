#!/usr/bin/env node
/**
 * scripts/verify-agents.js — read-only: does every LIVE client agent carry the consent setup?
 *
 * Usage:
 *   npm run verify-agents                 # every client with a RETELL_AGENT_ID
 *   npm run verify-agents -- --slug <s>   # one client (and its site-N folders)
 *
 * For each agent it reads the agent and the LLM it is actually BOUND to, and runs
 * `checkLiveAgentSetup`: not on the master LLM, the recording disclosure as its opening line,
 * the approved consent ask in its prompt, an `sms_consent` field, the voicemail hang-up.
 *
 * Found 2026-11-04: the consent work reached new clients only, and the growth fixture's agent ran
 * on the master LLM. Nothing reported either — this is the report. GETs only; changes nothing.
 *
 * Exit codes: 0 all pass · 1 an agent failed or could not be read · 2 missing config
 */

import dotenv from 'dotenv';
dotenv.config({ override: true });

import { readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { readEnvLocal } from '../onboard.js';
import { checkLiveAgentSetup, formatCheckLines } from '../lib/onboard-checks.js';

const apiKey = process.env.RETELL_API_KEY;
const masterLlmId = process.env.RETELL_LLM_ID || null; // in the ROOT .env this is the master template
if (!apiKey) {
  console.error('verify-agents: RETELL_API_KEY not set in .env');
  process.exit(2);
}
const only = (() => {
  const i = process.argv.indexOf('--slug');
  return i !== -1 ? process.argv[i + 1] : null;
})();

/** Every client folder (and enterprise site-N folder) whose .env.local names an agent. */
function agentDirs() {
  const root = resolve('clients');
  if (!existsSync(root)) return [];
  const out = [];
  for (const slug of readdirSync(root)) {
    if (only && slug !== only) continue;
    const dirs = [resolve(root, slug)];
    try {
      for (const sub of readdirSync(resolve(root, slug))) if (/^site-\d+$/.test(sub)) dirs.push(resolve(root, slug, sub));
    } catch {
      continue;
    }
    for (const dir of dirs) {
      const id = readEnvLocal(dir).RETELL_AGENT_ID;
      if (id) out.push({ label: dir.slice(root.length + 1).replace(/\\/g, '/'), agentId: id });
    }
  }
  return out;
}

const headers = { Authorization: `Bearer ${apiKey}` };
const getJson = async (url) => {
  const r = await fetch(url, { headers });
  return r.ok ? r.json() : null;
};

let failed = 0;
const dirs = agentDirs();
if (!dirs.length) console.log('No client agents found.');
for (const { label, agentId } of dirs) {
  const agent = await getJson(`https://api.retellai.com/get-agent/${agentId}`);
  const llmId = agent?.response_engine?.llm_id;
  const llm = llmId ? await getJson(`https://api.retellai.com/get-retell-llm/${llmId}`) : null;
  const c = checkLiveAgentSetup({ agent, llm, masterLlmId });
  if (c.ok !== true) failed++;
  console.log(`${label} (${agentId}, LLM ${llmId ?? '?'})`);
  for (const line of formatCheckLines([c])) console.log(`  ${line}`);
}
console.log(failed ? `\n✗ ${failed} of ${dirs.length} agent(s) need attention.` : `\n✓ All ${dirs.length} agent(s) carry the consent setup.`);
process.exit(failed ? 1 : 0);
