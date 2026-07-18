#!/usr/bin/env node
/**
 * scripts/update-agent-prompt.js — re-upload a tuned Retell prompt.
 *
 * Used at Checkpoint 2 after manually editing clients/{slug}/agent-prompt.txt.
 *
 * Usage:
 *   npm run update-prompt -- <agentId> --slug <slug>
 */

import 'dotenv/config';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function fail(msg, err) {
  console.error(`update-agent-prompt: ${msg}`);
  if (err) console.error(err);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { agentId: null, slug: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--slug' && argv[i + 1]) {
      args.slug = argv[i + 1];
      i++;
    } else if (!args.agentId && !argv[i].startsWith('--')) {
      args.agentId = argv[i];
    }
  }
  return args;
}

async function main() {
  const { agentId, slug } = parseArgs(process.argv);
  if (!agentId) fail('Missing <agentId>. Usage: npm run update-prompt -- <agentId> --slug <slug>');
  if (!slug) fail('Missing --slug <slug>');
  const apiKey = process.env.RETELL_API_KEY;
  if (!apiKey) fail('RETELL_API_KEY not set in .env');

  const promptPath = resolve('clients', slug, 'agent-prompt.txt');
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
