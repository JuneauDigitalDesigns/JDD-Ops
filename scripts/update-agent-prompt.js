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
 *   ... --prompt-only                                         # prompt alone (+ the voicemail hang-up)
 *   ... --voicemail-only                                      # ONLY the voicemail hang-up; no prompt read
 *   ... --signed-recordings-only                              # ONLY the signed recording links; no prompt read
 *
 * ── The voicemail hang-up does not wait on the prompt ───────────────────────
 *
 * For a client agent, `voicemail_option` (hang up on voicemail) is pushed FIRST and on its own,
 * before the prompt file is even read — with `--prompt-only`, with `--voicemail-only`, and when
 * the prompt then turns out to lack the consent ask and the run refuses. It is a safety setting:
 * an agent without it talks to an unanswered lead's voicemail (growth fixture, 2026-11-03, 48 s).
 * It used to ride inside the consent push, so every pre-consent client — exactly the agents that
 * lacked it — could not get it without first regenerating their prompt.
 *
 * ── Signed recording links go the same way ──────────────────────────────────
 *
 * `opt_in_signed_url` is pushed on its own right after the voicemail hang-up, for the same reason:
 * it must not wait on a prompt regeneration. The portal has to be on the version that fetches a
 * fresh link at play time before this reaches an agent, or the link Make stores goes dead and
 * the owner's recording with it (lib/voice-consent.js). Calls already made are unaffected.
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
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { buildPostCallAnalysisData, inboundOpeningLine, smsConsentAsk, SIGNED_RECORDING_SETTINGS, VOICEMAIL_OPTION } from '../lib/voice-consent.js';
import { applyStoredAiStatement } from '../lib/ai-statement.js';
import { setRetellAgentConfig } from '../lib/repair-ops.js';
import { checkPromptHasConsentAsk } from '../lib/onboard-checks.js';

function fail(msg, err) {
  console.error(`update-agent-prompt: ${msg}`);
  if (err) console.error(err);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { agentId: null, slug: null, file: null, business: null, promptOnly: false, voicemailOnly: false, signedRecordingsOnly: false };
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
    } else if (argv[i] === '--voicemail-only') {
      args.voicemailOnly = true;
    } else if (argv[i] === '--signed-recordings-only') {
      args.signedRecordingsOnly = true;
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

/**
 * What a run will push, decided from the flags alone — exported so the test exercises the real
 * decision rather than a copy of it.
 *
 *   voicemail — client agents (`--slug`), first. Not `--file`: that is JDD's own demo line, not
 *               a client callback agent. Not with `--signed-recordings-only`.
 *   signedRecordings — client agents, next and on its own. Not with `--voicemail-only`.
 *   prompt    — unless one of the `--…-only` flags.
 *   consent   — the prompt push plus the opening disclosure and analysis schema; a client
 *               agent, not `--prompt-only`.
 */
export function planAgentUpdate({ slug, file, promptOnly = false, voicemailOnly = false, signedRecordingsOnly = false }) {
  const client = Boolean(slug) && !file;
  const prompt = !voicemailOnly && !signedRecordingsOnly;
  return {
    voicemail: client && !signedRecordingsOnly,
    signedRecordings: client && !voicemailOnly,
    prompt,
    consent: client && prompt && !promptOnly,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const { slug, file } = args;
  if (!slug && !file) fail('Missing --slug <slug> or --file <path>');
  const agentId = args.agentId ?? (slug && !file ? agentIdFromEnvLocal(slug) : null);
  if (!agentId) fail('Missing <agentId>, and none recorded in clients/{slug}/.env.local. Usage: npm run update-prompt -- [<agentId>] --slug <slug>');
  const apiKey = process.env.RETELL_API_KEY;
  if (!apiKey) fail('RETELL_API_KEY not set in .env');

  const plan = planAgentUpdate(args);

  // The safety setting first, on its own, so nothing below — a missing prompt, a refused prompt,
  // a failed LLM update — can stop it landing.
  if (plan.voicemail) {
    const vm = await setRetellAgentConfig({ apiKey, agentId, patch: { voicemail_option: VOICEMAIL_OPTION } });
    if (!vm.ok) fail(`Agent ${agentId} voicemail_option not updated: ${vm.reason}`);
    console.log(`✓ Agent ${agentId} voicemail: ${JSON.stringify(vm.before?.voicemail_option ?? null)} → ${JSON.stringify(vm.after?.voicemail_option ?? null)}`);
  }
  if (plan.signedRecordings) {
    const signed = await setRetellAgentConfig({ apiKey, agentId, patch: SIGNED_RECORDING_SETTINGS });
    if (!signed.ok) fail(`Agent ${agentId} signed recording links not updated: ${signed.reason}`);
    console.log(`✓ Agent ${agentId} signed recording links: ${JSON.stringify(signed.before)} → ${JSON.stringify(signed.after)}`);
  }
  if (!plan.prompt) return;

  // --file wins, so a caller who passes an explicit path never silently gets a client's prompt.
  const promptPath = file ? resolve(file) : resolve('clients', slug, 'agent-prompt.txt');
  if (!existsSync(promptPath)) fail(`Prompt file not found: ${promptPath}`);
  const fromDisk = readFileSync(promptPath, 'utf8').trim();
  if (!fromDisk) fail(`Prompt file is empty: ${promptPath}`);

  // The client's stored AI statement choice decides whether its line is in what gets pushed, not
  // what the file happens to hold: a hand-edited or regenerated file must not lose it quietly.
  // Keyed on the prompt's own folder, so an enterprise site pushed with --file is covered too.
  let carried;
  try {
    carried = applyStoredAiStatement(fromDisk, dirname(promptPath));
  } catch (err) {
    fail(err.message);
  }
  const prompt = carried.prompt;
  if (carried.change) {
    writeFileSync(promptPath, prompt, 'utf8');
    console.log(`AI statement ${carried.change} in ${promptPath}, per this client's stored choice (${carried.setting.enabled ? 'on' : 'off'}).`);
  }

  const withConsent = plan.consent;
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
  // Never write to the MASTER LLM. In the root .env, RETELL_LLM_ID is the template every client's
  // own LLM is cloned from; an agent bound to it (the growth fixture was, 2026-11-04) would have
  // this push overwrite every future client's prompt. Re-point the agent at its own LLM first.
  if (process.env.RETELL_LLM_ID && llmId === process.env.RETELL_LLM_ID) {
    fail(
      `Agent ${agentId} is bound to the MASTER Retell LLM (${llmId}). Refusing: this would rewrite every client's template.\n` +
        'Bind the agent to its own LLM first (onboard.js creates one per client), then push again.',
    );
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
          'Pass --prompt-only to push the prompt alone, without the disclosure or the consent schema.\n' +
          (plan.voicemail ? 'The voicemail hang-up WAS applied — it does not depend on the prompt.' : ''),
      );
    }
    console.log(`Business name spoken on the line: "${business}"${args.business ? '' : ' (from agent_name; override with --business)'}`);

    // Schema first: alone, it can only ever record "unknown", which blocks.
    const schema = await setRetellAgentConfig({
      apiKey,
      agentId,
      patch: { post_call_analysis_data: buildPostCallAnalysisData(business) },
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

// Only when run as the CLI, so the test can import planAgentUpdate without starting a run.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => fail('unhandled error', err));
}
