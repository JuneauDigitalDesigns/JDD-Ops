/**
 * Resuming a provisioning run that died partway.
 *
 * Every step that spends money or creates a resource must detect what already exists and skip
 * it, because real runs DO die partway — this suite exists because one died at step 9 (Twilio
 * suspended) and again at step 11 (the clone 400), leaving a client with an agent, an LLM, a
 * number and an Airtable base but no post-call scenario.
 *
 * The dangerous case is the Make clone. The clone is created first but the "already done"
 * marker used to be written SIX calls later, so a failure in between orphaned a possibly-active
 * scenario and the next run made another. Several live scenarios on one Airtable base means
 * duplicate rows for every call — the kind of damage that accumulates quietly.
 *
 * Source-level assertions, for the same reason as clone-request.test.mjs: these paths create
 * real resources and cannot be exercised without doing so.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(resolve(ROOT, 'onboard.js'), 'utf8');

const fnBody = (name) => {
  const start = SRC.indexOf(`async function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  return SRC.slice(start, SRC.indexOf('\n}\n', start));
};

/* ── The Make clone ──────────────────────────────────────────────────────── */

test('the clone id is recorded BEFORE any follow-up call can fail', () => {
  const src = fnBody('cloneAndWirePostCall');
  const recorded = src.indexOf("patchEnvLocal(clientDir, 'MAKE_POST_CALL_SCENARIO_ID'");
  assert.notEqual(recorded, -1, 'the clone id must be persisted');

  // Everything that could orphan the clone must come after the id is on disk.
  for (const later of ['/blueprint', '/start', 'update-agent']) {
    const at = src.indexOf(later, recorded);
    assert.ok(at > recorded, `"${later}" must happen after the id is recorded, not before`);
  }
});

test('an existing clone is adopted rather than cloned again', () => {
  const src = fnBody('cloneAndWirePostCall');
  assert.match(src, /readEnvLocal\(clientDir\)\.MAKE_POST_CALL_SCENARIO_ID/);
  assert.match(src, /Adopting scenario/, 'an adopted clone should say so in the log');
  // The clone POST must be inside the else-branch, not unconditional.
  assert.match(src, /if \(cloneId\) \{[\s\S]*?\} else \{[\s\S]*?\/clone\?organizationId=/);
});

test('the completed-step fast path still short-circuits on the webhook url', () => {
  const src = fnBody('cloneAndWirePostCall');
  assert.match(src, /RETELL_POST_CALL_WEBHOOK_URL;\s*\n\s*if \(existing\)/);
});

/* ── The Retell LLM ──────────────────────────────────────────────────────── */

test('an existing per-client LLM is reused, not duplicated', () => {
  // RETELL_LLM_ID was persisted immediately but only RETELL_AGENT_ID was ever checked, so a
  // run that died between the two created a second LLM on resume and orphaned the first.
  const src = fnBody('createRetellAgent');
  assert.match(src, /let clientLlmId = readEnvLocal\(clientDir\)\.RETELL_LLM_ID/);
  assert.match(src, /Reusing per-client LLM/);
  assert.match(src, /if \(!clientLlmId\) \{[\s\S]*create-retell-llm/, 'creation must be conditional');
});

test('a deleted LLM is detected and recreated rather than trusted', () => {
  const src = fnBody('createRetellAgent');
  assert.match(src, /check\.status === 404[\s\S]*clientLlmId = null/);
});

/* ── The agent prompt ────────────────────────────────────────────────────── */

test('prompt generation is skipped when the agent already exists', () => {
  // Regenerating on a resume would spend an Anthropic call, OVERWRITE any hand-tuning in
  // agent-prompt.txt, and then be discarded — createRetellAgent short-circuits on the existing
  // agent and never uploads it. Disk would then disagree with the live agent, and the console's
  // voice-agent editor reads that file with no read-back from Retell.
  const src = fnBody('generateRetellPrompt');
  assert.match(src, /readEnvLocal\(clientDir\)\.RETELL_AGENT_ID && existsSync\(promptFile\)/);
  assert.match(src, /not regenerating/);
  assert.match(src, /update-prompt/, 'it should point at the supported way to change a live prompt');
});

test('the skip is keyed on the AGENT, not merely on the file existing', () => {
  // A file with no agent is a leftover from a run that died before creating one; regenerating
  // is correct there. Keying on the file alone would preserve a prompt that is a record of
  // nothing.
  const src = fnBody('generateRetellPrompt');
  const guard = /RETELL_AGENT_ID && existsSync\(promptFile\)/.exec(src);
  assert.ok(guard, 'both conditions must be present, agent first');
});

/* ── The guarantee as a whole ────────────────────────────────────────────── */

test('every resource that costs money has a reuse guard', () => {
  // The property that makes re-running safe at all. If a new paid step is ever added without
  // one, this is the test that should fail.
  const guards = [
    [/existingAgentId = readEnvLocal\(clientDir\)\.RETELL_AGENT_ID/, 'Retell agent'],
    [/let clientLlmId = readEnvLocal\(clientDir\)\.RETELL_LLM_ID/, 'Retell LLM'],
    [/const existingNumber = readEnvLocal\(clientDir\)\.TWILIO_NUMBER/, 'Twilio number'],
    [/const existingBaseId = readEnvLocal\(clientDir\)\.AIRTABLE_BASE_ID/, 'Airtable base'],
    [/readEnvLocal\(clientDir\)\.MAKE_POST_CALL_SCENARIO_ID/, 'Make clone'],
    [/const existing = readEnvLocal\(clientDir\)\.RETELL_POST_CALL_WEBHOOK_URL/, 'post-call webhook'],
  ];
  for (const [re, what] of guards) {
    assert.match(SRC, re, `${what} must have a reuse guard or a resume will pay for it twice`);
  }
});
