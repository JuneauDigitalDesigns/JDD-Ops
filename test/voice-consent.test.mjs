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
} from '../lib/onboard-checks.js';
import {
  buildPostCallAnalysisData,
  inboundOpeningLine,
  outboundOpeningLine,
  smsConsentAsk,
  voiceConsentInstructions,
  SMS_CONSENT_CHOICES,
} from '../lib/voice-consent.js';
import { masterBlueprint } from './helpers/fixtures.mjs';

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
