/**
 * The voice agent's recording disclosure, SMS consent ask, and the post-call analysis schema
 * that turns the caller's answer into the `SMS consent` Call Log column.
 *
 * Every case is a bug that shipped or a contract that has already been broken once:
 *   - the master read three analysis fields the agent never extracted, so Email, Address and
 *     Priority were blank on every call ever logged (checkAnalysisCoversBlueprint)
 *   - the Call Log spec existed twice and the copies drifted to 7 vs 11 columns
 *   - singleSelect casing that fails the whole row under `typecast: false`
 *
 * The blueprint is the RECORDED master, never a hand-written one.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CALL_LOG_FIELDS } from '../onboard.js';
import {
  analysisFieldsReadBy,
  checkAnalysisCoversBlueprint,
  checkPromptHasConsentAsk,
  checkSelectMappingsTotal,
} from '../lib/onboard-checks.js';
import {
  buildPostCallAnalysisData,
  inboundOpeningLine,
  outboundOpeningLine,
  smsConsentAsk,
  voiceConsentInstructions,
  SMS_CONSENT_CHOICES,
  SELECT_MAPPINGS,
} from '../lib/voice-consent.js';
import { masterBlueprint, masterFieldMap } from './helpers/fixtures.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BIZ = 'Acme Plumbing';

/** The schema onboard.js shipped until 2026-11-02 — what the agent actually extracted. */
const SHIPPED_SCHEMA = [
  { type: 'string', name: 'caller_name' },
  { type: 'string', name: 'callback_number' },
  { type: 'enum', name: 'urgency', choices: ['Immediate service', 'Callback requested', 'General inquiry'] },
];

const enumChoices = (name) => buildPostCallAnalysisData(BIZ).find((f) => f.name === name)?.choices;
const columnChoices = (name) =>
  CALL_LOG_FIELDS.find((f) => f.name === name)?.options?.choices?.map((c) => c.name);

/* ── Analysis schema vs what the master reads ─────────────────────────────── */

test('the recorded master reads custom_analysis_data fields', () => {
  // Guards the guard: if the fixture stopped containing any, the coverage test below would pass
  // by checking nothing.
  const read = analysisFieldsReadBy(masterBlueprint());
  assert.ok(read.includes('caller_name'), `read: ${read.join(', ')}`);
});

test('every analysis field the recorded master reads is one the agent extracts', () => {
  const c = checkAnalysisCoversBlueprint({ blueprint: masterBlueprint(), analysisData: buildPostCallAnalysisData(BIZ) });
  assert.equal(c.ok, true, c.detail);
});

test('the predicate catches the schema that actually shipped', () => {
  // Email, Address and Priority were blank on every logged call because of exactly this.
  const c = checkAnalysisCoversBlueprint({ blueprint: masterBlueprint(), analysisData: SHIPPED_SCHEMA });
  assert.equal(c.ok, false);
  for (const f of ['caller_email', 'caller_address', 'caller_priority']) assert.match(c.detail, new RegExp(f));
  assert.doesNotMatch(c.detail, /FAIL:/, 'onboard-parse.ts treats FAIL: as a fatal run');
});

test('no blueprint is "could not check", never a pass', () => {
  assert.equal(checkAnalysisCoversBlueprint({ blueprint: null, analysisData: [] }).ok, null);
});

test('the master mapping for sms_consent is covered once it exists', () => {
  // Simulates the deliberate master edit by adding the one mapping to the recorded blueprint,
  // so the contract holds before AND after the fixture is refreshed.
  const bp = masterBlueprint();
  const at = bp.flow.find((m) => (m.module ?? '').startsWith('airtable'));
  at.mapper.record.fldSMSCONSENT0000 = '{{1.call.call_analysis.custom_analysis_data.sms_consent}}';
  const c = checkAnalysisCoversBlueprint({ blueprint: bp, analysisData: buildPostCallAnalysisData(BIZ) });
  assert.equal(c.ok, true, c.detail);
  assert.match(c.detail, /sms_consent/);
});

/* ── Enum choices must equal the singleSelect they feed ───────────────────── */

test('sms_consent is exactly granted / declined / unknown, lowercase', () => {
  // A boolean was rejected: it collapses "never asked" into "refused", and the gate needs both.
  assert.deepEqual(enumChoices('sms_consent'), ['granted', 'declined', 'unknown']);
  assert.deepEqual(SMS_CONSENT_CHOICES, ['granted', 'declined', 'unknown']);
});

test('each analysis enum equals the Call Log singleSelect it is mapped into', () => {
  // typecast: false — a value the column lacks fails the WHOLE row, not just the cell.
  assert.deepEqual(enumChoices('sms_consent'), columnChoices('SMS consent'));
  assert.deepEqual(enumChoices('caller_priority'), columnChoices('Priority'));
});

test('urgency is gone — its values were never valid Priority choices', () => {
  assert.ok(!buildPostCallAnalysisData(BIZ).some((f) => f.name === 'urgency'));
  const priority = columnChoices('Priority');
  assert.ok(!SHIPPED_SCHEMA[2].choices.some((c) => priority.includes(c)));
});

/* ── One Call Log spec ────────────────────────────────────────────────────── */

test('the Call Log column list is defined exactly once', () => {
  // lib/repair-ops.js carried a private copy that had drifted to 7 of 11 columns, so a repaired
  // base silently lost Email, Address, Recording URL and Priority.
  const files = ['onboard.js', ...readdirSync(resolve(ROOT, 'lib')).filter((f) => f.endsWith('.js')).map((f) => `lib/${f}`)];
  const defining = files.filter((f) => /\bconst CALL_LOG_FIELDS\s*=/.test(readFileSync(resolve(ROOT, f), 'utf8')));
  assert.deepEqual(defining, ['lib/call-log-fields.js']);
  assert.match(readFileSync(resolve(ROOT, 'lib/repair-ops.js'), 'utf8'), /from '\.\/call-log-fields\.js'/);
});

test('the SMS consent column exists', () => {
  assert.ok(CALL_LOG_FIELDS.some((f) => f.name === 'SMS consent' && f.type === 'singleSelect'));
});

/* ── The spoken wording ───────────────────────────────────────────────────── */

test('both opening lines start with the recording notice', () => {
  // All-party-consent state: the notice must come before anything the caller could answer.
  assert.match(inboundOpeningLine(BIZ), /^This call is recorded\. /);
  assert.match(outboundOpeningLine(BIZ, 'Dana'), /^This call is on a recorded line\. /);
  assert.ok(inboundOpeningLine(BIZ).includes(BIZ) && outboundOpeningLine(BIZ, 'Dana').includes(BIZ));
});

test('the outbound line confirms the lead by name, and falls back without one', () => {
  assert.match(outboundOpeningLine(BIZ, 'Dana'), /Am I speaking with Dana\?$/);
  assert.match(outboundOpeningLine(BIZ, '  '), /Is now a good time\?$/);
  assert.match(outboundOpeningLine(BIZ, undefined), /Is now a good time\?$/);
});

test('the generator is handed the consent ask verbatim', () => {
  assert.ok(voiceConsentInstructions(BIZ).includes(smsConsentAsk(BIZ)));
  assert.match(smsConsentAsk(BIZ), /Acme Plumbing texts you/);
  assert.match(smsConsentAsk(BIZ), /reply STOP/);
});

test('a paraphrased ask is caught; the verbatim one passes', () => {
  const ask = smsConsentAsk(BIZ);
  assert.equal(checkPromptHasConsentAsk({ prompt: `## CLOSING\nSay: "${ask}"`, ask }).ok, true);
  const paraphrase = 'One last thing — can Acme Plumbing text you about this? Yes or no is fine.';
  const c = checkPromptHasConsentAsk({ prompt: paraphrase, ask });
  assert.equal(c.ok, false);
  assert.doesNotMatch(c.detail, /FAIL:/);
  assert.equal(checkPromptHasConsentAsk({ prompt: '', ask }).ok, null);
});

/* ── singleSelect mappings must be total (2026-11-03 outage) ──────────────── */

// The recorded master's field ids for the two select columns, resolved by NAME so the test
// follows a re-recorded fixture rather than hard-coding ids.
function masterWithSelectMappings(mappings) {
  const bp = masterBlueprint();
  const map = masterFieldMap();
  const at = bp.flow.find((m) => (m.module ?? '').startsWith('airtable'));
  for (const [column, expr] of Object.entries(mappings)) at.mapper.record[map.byName[column]] = expr;
  return { bp, map };
}

test('the recorded master maps no singleSelect in a way that can fail the row', () => {
  // On 2026-11-03 a completed callback returned caller_priority "", the bare mapping wrote ""
  // into Priority, Airtable rejected it as a new option, and the whole row was lost.
  const c = checkSelectMappingsTotal({ blueprint: masterBlueprint(), fieldMap: masterFieldMap() });
  assert.equal(c.ok, true, c.detail);
});

test('a bare analysis mapping into a select is caught — the shape that failed on 2026-11-03', () => {
  const { bp, map } = masterWithSelectMappings({
    Priority: '{{1.call.call_analysis.custom_analysis_data.caller_priority}}',
  });
  const c = checkSelectMappingsTotal({ blueprint: bp, fieldMap: map });
  assert.equal(c.ok, false);
  assert.match(c.detail, /Priority/);
  assert.doesNotMatch(c.detail, /FAIL:/);
});

test('a mapping that can emit a mis-cased option is caught', () => {
  const { bp, map } = masterWithSelectMappings({
    Priority: '{{if(1.call.call_analysis.custom_analysis_data.caller_priority = "emergency"; "emergency"; "Callback")}}',
  });
  const c = checkSelectMappingsTotal({ blueprint: bp, fieldMap: map });
  assert.equal(c.ok, false);
  assert.match(c.detail, /"Callback"/);
});

test('the shared SELECT_MAPPINGS are total against the recorded master base', () => {
  const { bp, map } = masterWithSelectMappings(SELECT_MAPPINGS);
  const c = checkSelectMappingsTotal({ blueprint: bp, fieldMap: map });
  assert.equal(c.ok, true, c.detail);
});

test('the recorded master carries exactly the shared SELECT_MAPPINGS', () => {
  const map = masterFieldMap();
  const at = masterBlueprint().flow.find((m) => (m.module ?? '').startsWith('airtable'));
  for (const [column, expr] of Object.entries(SELECT_MAPPINGS)) {
    assert.equal(at.mapper.record[map.byName[column]], expr, `master mapping for "${column}"`);
  }
});

test('the console replica shows the same select expressions the master runs', () => {
  // make-modules.ts is bundled by Next and cannot import from the ops root, so it restates
  // them. An operator copying a stale bare mapping off that screen would reintroduce the bug.
  const src = readFileSync(resolve(ROOT, 'console/src/lib/make-modules.ts'), 'utf8');
  for (const expr of Object.values(SELECT_MAPPINGS)) {
    assert.ok(src.includes(`raw: '${expr}'`), `console replica is missing ${expr}`);
  }
});

/* ── the outbound opening line, as /api/contact sends it ─────────────────── */

test('the callback route sends the approved outbound opening line, word for word', () => {
  // The route is written verbatim into client repos, which cannot import lib/voice-consent.js, so
  // it carries a copy. Without it the agent opened a call it placed with the INBOUND line, "how
  // can I help you today?", to a lead who had asked us to call.
  const src = readFileSync(resolve(ROOT, 'lib/site-routes/contact.route.ts'), 'utf8');
  const template = outboundOpeningLine('${businessName}', 'X').replace('Am I speaking with X?', '${question}');
  assert.ok(src.includes(`\`${template}\``), `contact.route.ts lost the approved line:\n${template}`);
  assert.ok(src.includes('`Am I speaking with ${name}?`'));
  assert.ok(src.includes("'Is now a good time?'"));
  assert.match(src, /agent_override:\s*\{\s*retell_llm:\s*\{\s*begin_message:\s*outboundOpeningLine\(/);
});

/* ── voicemail: hang up, leave nothing (2026-11-03) ──────────────────────── */

test('every agent is told to hang up on voicemail', async () => {
  // The growth fixture's agent had no voicemail_option, so Retell never detected voicemail and
  // the agent talked to the lead's voicemail for 48 seconds on an unanswered callback.
  const { VOICEMAIL_OPTION } = await import('../lib/voice-consent.js');
  assert.deepEqual(VOICEMAIL_OPTION, { action: { type: 'hangup' } });
  // The body onboard.js sends comes from clientAgentCreateBody; run it for real.
  const { clientAgentCreateBody } = await import('../onboard.js');
  assert.deepEqual(clientAgentCreateBody({ businessName: 'Acme', llmId: 'llm_x', voiceId: 'v' }).voicemail_option, VOICEMAIL_OPTION);
  const onboard = readFileSync(resolve(ROOT, 'onboard.js'), 'utf8');
  const createAgent = onboard.slice(onboard.indexOf("'https://api.retellai.com/create-agent'"));
  assert.match(createAgent.slice(0, 400), /body: JSON\.stringify\(clientAgentCreateBody\(/, 'create-agent must send the builder');
});

test('the voicemail hang-up is pushed whatever happens to the prompt', async () => {
  // It used to ride inside the consent push, so --prompt-only skipped it and a prompt without the
  // consent ask refused the run before it — i.e. every pre-consent agent, the ones that lacked it.
  const { planAgentUpdate } = await import('../scripts/update-agent-prompt.js');
  assert.deepEqual(planAgentUpdate({ slug: 'acme' }), { voicemail: true, prompt: true, consent: true });
  assert.deepEqual(planAgentUpdate({ slug: 'acme', promptOnly: true }), { voicemail: true, prompt: true, consent: false });
  assert.deepEqual(planAgentUpdate({ slug: 'acme', voicemailOnly: true }), { voicemail: true, prompt: false, consent: false });
  // JDD's own demo line is not a client callback agent.
  assert.equal(planAgentUpdate({ file: 'demo/agent-prompt.txt' }).voicemail, false);
});

test('the voicemail push runs before the prompt is read or checked', () => {
  // So a missing prompt file or a refused prompt cannot stop it landing.
  const src = readFileSync(resolve(ROOT, 'scripts/update-agent-prompt.js'), 'utf8');
  const main = src.slice(src.indexOf('async function main()'));
  const vm = main.indexOf('patch: { voicemail_option: VOICEMAIL_OPTION }');
  assert.ok(vm > 0, 'voicemail is pushed on its own');
  assert.ok(vm < main.indexOf('readFileSync(promptPath'), 'before the prompt is read');
  assert.ok(vm < main.indexOf('checkPromptHasConsentAsk('), 'before the consent check can refuse');
});

test('the repair allow-list accepts voicemail_option (and still refuses anything else)', async () => {
  const { setRetellAgentConfig } = await import('../lib/repair-ops.js');
  const res = await setRetellAgentConfig({ apiKey: 'k', agentId: 'a', patch: { voicemail_option: { action: { type: 'hangup' } }, general_prompt: 'x' } });
  assert.equal(res.ok, false);
  assert.match(res.reason, /Not settable from here: general_prompt$/, 'voicemail_option must not be the refused key');
});

test('no prompt instruction tells the agent to leave a voicemail on a callback', () => {
  const onboard = readFileSync(resolve(ROOT, 'onboard.js'), 'utf8');
  assert.doesNotMatch(onboard, /leaving a short friendly voicemail/);
  // Only an agent that places callbacks has an outbound voicemail rule at all.
  assert.doesNotMatch(voiceConsentInstructions('Acme', { callbacks: true }), /leave the short voicemail/);
  assert.match(voiceConsentInstructions('Acme', { callbacks: true }), /leave NO message — hang up/);
});

test('the consent ask is the wording approved on 2026-11-04, word for word', () => {
  // Spoken to the public and the evidence of consent: a paraphrase is a different disclosure.
  assert.equal(
    smsConsentAsk('Acme Plumbing'),
    "One last thing — is it okay if Acme Plumbing texts you at that number about this request? It's optional. Message frequency varies, message and data rates may apply, and you can reply STOP to opt out or HELP for help. A yes or no is fine.",
  );
});

test('update-prompt refuses an agent bound to the MASTER LLM, before it writes anything to the LLM', () => {
  // The growth fixture's agent ran on the master LLM (2026-11-04): a push would have rewritten
  // every client's template.
  const src = readFileSync(resolve(ROOT, 'scripts/update-agent-prompt.js'), 'utf8');
  const main = src.slice(src.indexOf('async function main()'));
  const guard = main.indexOf('llmId === process.env.RETELL_LLM_ID');
  assert.ok(guard > 0, 'the master-LLM guard is missing');
  assert.ok(guard < main.indexOf('update-retell-llm/'), 'the guard must come before the LLM write');
});
