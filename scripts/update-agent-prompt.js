#!/usr/bin/env node
/**
 * scripts/update-agent-prompt.js — re-upload a tuned Retell prompt, and with it the recording
 * disclosure and the post-call analysis schema.
 *
 * Used at Checkpoint 2 after manually editing clients/{slug}/agent-prompt.txt, and to backfill
 * agents provisioned before the SMS consent work (lib/voice-consent.js).
 *
 * Usage:
 *   npm run update-prompt -- --slug <slug>                    # agent id from clients/{slug}/.env.local
 *   npm run update-prompt -- <agentId> --slug <slug>          # explicit agent id
 *   npm run update-prompt -- <agentId> --file <path>          # any path, relative to repo root
 *   ... --business "<Business Name>"                          # override the spoken business name
 *   ... --prompt-only                                         # the old behaviour: prompt alone
 *
 * ── Two objects, one command ────────────────────────────────────────────────
 *
 * The prompt and `begin_message` live on the per-client LLM (`update-retell-llm`); for a
 * retell-llm engine a `general_prompt` sent to the agent is ignored. `post_call_analysis_data`
 * lives on the AGENT (`update-agent`). They are pushed together on purpose: a prompt that asks
 * for SMS consent on an agent with no `sms_consent` field produces a caller who said yes and a
 * row that says nothing. The schema goes first — a schema without the ask only ever records
 * `unknown`, which blocks, so the half-done state fails closed.
 *
 * A client push REFUSES a prompt that does not contain the approved consent ask word for word.
 * Prompts generated before 2026-11-02 do not, and pushing the new opening line on top of one
 * would greet the caller twice and never ask. Regenerate the prompt (or add the ask), then push.
 *
 * `--file` exists for JDD's own demo-line agent, whose prompt lives at demo/agent-prompt.txt
 * rather than under clients/. It isn't a client — it's the sales script on the public demo
 * number — so it gets the prompt only, never the client consent wording. `--file` wins when
 * both are given.
 */

import 'dotenv/config';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { buildPostCallAnalysisData, inboundOpeningLine, smsConsentAsk, VOICEMAIL_OPTION } from '../lib/voice-consent.js';
import { setRetellAgentConfig } from '../lib/repair-ops.js';
import { checkPromptHasConsentAsk } from '../lib/onboard-checks.js';

function fail(msg, err) {
  console.error(`update-agent-prompt: ${msg}`);
  if (err) console.error(err);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { agentId: null, slug: null, file: null, business: null, promptOnly: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--slug' && argv[i + 1]) {
      args.slug = argv[i + 1];
      i++;
    } else if (argv[i] === '--file' && argv[i + 1]) {
      args.file = argv[i + 1];
      i++;
    } else if (argv[i] === '--business' && argv[i + 1]) {
      args.business = argv[i + 1];
      i++;
    } else if (argv[i] === '--prompt-only') {
      args.promptOnly = true;
    } else if (!args.agentId && !argv[i].startsWith('--')) {
      args.agentId = argv[i];
    }
  }
  return args;
}

/** RETELL_AGENT_ID from clients/{slug}/.env.local — the value onboard.js recorded. */
function agentIdFromEnvLocal(slug) {
  const envPath = resolve('clients', slug, '.env.local');
  if (!existsSync(envPath)) return null;
  const m = /^RETELL_AGENT_ID=(.*)$/m.exec(readFileSync(envPath, 'utf8'));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') || null : null;
}

async function main() {
  const args = parseArgs(process.argv);
  const { slug, file } = args;
  if (!slug && !file) fail('Missing --slug <slug> or --file <path>');
  const agentId = args.agentId ?? (slug && !file ? agentIdFromEnvLocal(slug) : null);
  if (!agentId) fail('Missing <agentId>, and none recorded in clients/{slug}/.env.local. Usage: npm run update-prompt -- [<agentId>] --slug <slug>');
  const apiKey = process.env.RETELL_API_KEY;
  if (!apiKey) fail('RETELL_API_KEY not set in .env');

  // --file wins, so a caller who passes an explicit path never silently gets a client's prompt.
  const promptPath = file ? resolve(file) : resolve('clients', slug, 'agent-prompt.txt');
  if (!existsSync(promptPath)) fail(`Prompt file not found: ${promptPath}`);
  const prompt = readFileSync(promptPath, 'utf8').trim();
  if (!prompt) fail(`Prompt file is empty: ${promptPath}`);

  const withConsent = !file && !args.promptOnly;
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

  const llmPatch = { general_prompt: prompt };

  if (withConsent) {
    // onboard.js names the agent after brand.name, so that is the business the caller hears.
    const business = (args.business ?? agent.agent_name ?? '').trim();
    if (!business) fail(`Agent ${agentId} has no agent_name to take the business name from — pass --business "<name>".`);
    if (checkPromptHasConsentAsk({ prompt, ask: smsConsentAsk(business) }).ok !== true) {
      fail(
        `${promptPath} does not contain the approved SMS consent ask for "${business}" word for word:\n` +
          `  "${smsConsentAsk(business)}"\n` +
          'Regenerate the prompt (delete it and re-run onboard.js for this client) or add the ask, then push again.\n' +
          'Pass --prompt-only to push the prompt alone, without the disclosure or the consent schema.',
      );
    }
    console.log(`Business name spoken on the line: "${business}"${args.business ? '' : ' (from agent_name; override with --business)'}`);

    // Schema first: alone, it can only ever record "unknown", which blocks.
    const schema = await setRetellAgentConfig({
      apiKey,
      agentId,
      // The voicemail hang-up rides along: an agent provisioned before it talks to voicemail.
      patch: { post_call_analysis_data: buildPostCallAnalysisData(business), voicemail_option: VOICEMAIL_OPTION },
    });
    if (!schema.ok) fail(`Agent ${agentId} post_call_analysis_data not updated: ${schema.reason}`);
    const before = (schema.before?.post_call_analysis_data ?? []).map((f) => f?.name).join(', ') || '(none)';
    const after = (schema.after?.post_call_analysis_data ?? []).map((f) => f?.name).join(', ') || '(none)';
    console.log(`✓ Agent ${agentId} analysis fields: ${before} → ${after}`);

    llmPatch.start_speaker = 'agent';
    llmPatch.begin_message = inboundOpeningLine(business);
  }

  console.log(`Uploading prompt (${prompt.length} chars) → Retell LLM ${llmId} (agent ${agentId})`);

  const res = await fetch(`https://api.retellai.com/update-retell-llm/${llmId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(llmPatch),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '<unreadable>');
    fail(
      `Retell API returned ${res.status}: ${text}` +
        (withConsent ? '\nThe agent schema WAS updated; the prompt and opening line were not. Re-run once fixed.' : ''),
    );
  }

  console.log(`✓ LLM ${llmId} (agent ${agentId}) updated${withConsent ? ' — prompt + opening disclosure' : ''}.`);
  // Retell documents update-agent as editing the agent's "latest draft version" and does not
  // say which version a live call uses. Until a test call proves it, say so rather than imply.
  if (withConsent) console.log('  Verify with one real test call: the disclosure first, the SMS ask last, and the Airtable row.');
}

main().catch((err) => fail('unhandled error', err));
