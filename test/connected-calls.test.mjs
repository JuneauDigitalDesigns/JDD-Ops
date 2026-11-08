/**
 * Only a callback that reached a person is logged and briefed.
 *
 * **The rule (operator decision, 2026-11-03): an unanswered callback is a lost lead.** Retell
 * posts `call_analyzed` even for a callback that never connected, and until this the post-call
 * scenario's only gate was `{{1.event}} = call_analyzed` — so every no-answer, busy and voicemail
 * callback would have written an Airtable row, shown up in the portal and texted the owner about
 * a conversation that never happened.
 *
 * The filter is the RECORDED master's, evaluated as Make evaluates it, against outcome shapes
 * this account has really produced (test/fixtures/retell/call-outcomes.json) plus Retell's
 * documented never-connected ones.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { patchPostCallBlueprint, CALL_LOG_FIELDS } from '../onboard.js';
import { checkConnectedCallsOnly, evaluateMakeFilter, fieldMapFromSpec } from '../lib/onboard-checks.js';
import { CALL_OUTCOME_CASES, postCallGateFilter, shouldLog } from '../lib/call-outcomes.js';
import { loadFixture, masterBlueprint, masterFieldMap } from './helpers/fixtures.mjs';

const check = (blueprint) => checkConnectedCallsOnly({ blueprint, cases: CALL_OUTCOME_CASES, shouldLog });
/** The module whose filter decides whether a row is written: the Airtable one. */
const gate = (bp) => bp.flow.find((m) => (m.module ?? '').startsWith('airtable'));
/** Every filter in the flow, so a test can't be rescued by the master's earlier, older one. */
const gates = (bp) => bp.flow.filter((m) => m.filter);

/** The master's filter as recorded before this change — the gate that let every call through. */
const PRE_2026_11_03_FILTER = { name: '', conditions: [[{ a: '{{1.event}}', b: 'call_analyzed', o: 'text:equal' }]] };

test('the recorded master logs connected calls and drops unanswered and voicemail callbacks', () => {
  const c = check(masterBlueprint());
  assert.equal(c.ok, true, c.detail);
});

test('a patched clone keeps that gate — it is carried onto the Airtable module', () => {
  const bp = masterBlueprint();
  patchPostCallBlueprint(bp, {
    baseId: 'appCLIENTbase0001',
    ingestToken: 'c'.repeat(64),
    masterMap: masterFieldMap(),
    clientMap: fieldMapFromSpec(CALL_LOG_FIELDS, { tableId: 'tblCLIENT00000001' }),
    quiet: true,
  });
  assert.equal(gate(bp).module, 'airtable:ActionCreateRecord');
  const c = check(bp);
  assert.equal(c.ok, true, c.detail);
});

test('THE OLD GATE fails: call_analyzed alone logs every unanswered and voicemail callback', () => {
  const bp = masterBlueprint();
  for (const m of gates(bp)) m.filter = PRE_2026_11_03_FILTER;
  const c = check(bp);
  assert.equal(c.ok, false);
  assert.match(c.detail, /callback not answered would be LOGGED/);
  assert.match(c.detail, /voicemail, agent hung up would be LOGGED/);
});

test('a filter written from the docs alone lets the REAL voicemail calls through', () => {
  // `voicemail_reached` is what Retell documents; on these agents (detection off) voicemail is
  // an ordinary hangup with in_voicemail: true. Drop the in_voicemail rule and see.
  const bp = masterBlueprint();
  for (const m of gates(bp)) {
    for (const group of m.filter.conditions) {
      const i = group.findIndex((c) => c.a.includes('in_voicemail'));
      if (i !== -1) group.splice(i, 1);
    }
  }
  const c = check(bp);
  assert.equal(c.ok, false);
  assert.match(c.detail, /reached voicemail/);
});

test('every outcome Retell has really produced here has a case — a new one forces a decision', () => {
  const key = (s) => JSON.stringify([s.direction ?? null, s.call_status, s.disconnection_reason ?? null, s.in_voicemail ?? null]);
  const cased = new Set(
    CALL_OUTCOME_CASES.filter((c) => c.source === 'recorded').map((c) =>
      key({ ...c.payload.call, in_voicemail: c.payload.call.call_analysis?.in_voicemail }),
    ),
  );
  for (const shape of loadFixture('retell/call-outcomes.json')) {
    assert.ok(cased.has(key(shape)), `recorded outcome ${key(shape)} (e.g. ${shape.example_call_id}) has no case in lib/call-outcomes.js`);
  }
});

test('the rule: a connected call is logged only if the agent took something down', () => {
  const logged = CALL_OUTCOME_CASES.filter((c) => shouldLog(c.payload)).map((c) => c.label);
  assert.deepEqual(logged.sort(), [
    'answered callback, agent hung up',
    'answered callback, lead hung up',
    'answered no to texts',
    'dropped after confirming a number',
    'dropped after giving an email',
    'dropped after giving an address',
    'dropped, but said it was an emergency',
    'inbound, agent hung up',
    'inbound, caller hung up',
    'inbound, gave a name then dropped',
    'inbound, silence timeout',
    'web call (no direction)',
  ].sort());
});

/* ── a call that drops before anything is collected (operator rule, 2026-11-08) ─ */

test('the 18-second dropped callback writes no row, so it sends no text', () => {
  const dropped = CALL_OUTCOME_CASES.find((c) => c.label === 'answered callback, dropped before details');
  assert.equal(dropped.source, 'recorded');
  assert.equal(evaluateMakeFilter(gate(masterBlueprint()).filter, dropped.payload), false);
  // The owner's text is the module AFTER the row, so stopping the row stops the text.
  const flow = masterBlueprint().flow.map((m) => m.module);
  assert.ok(flow.findIndex((m) => m.startsWith('airtable')) < flow.findIndex((m) => m.startsWith('http')));
});

test('without the rule, the dropped callback is logged and the owner is texted', () => {
  // The connected-calls gate alone: exactly what shipped until 2026-11-08.
  const bp = masterBlueprint();
  delete gate(bp).filter;
  const c = check(bp);
  assert.equal(c.ok, false);
  assert.match(c.detail, /dropped before details would be LOGGED/);
});

test('the recorded master runs exactly the filter the code defines', () => {
  assert.deepEqual(gate(masterBlueprint()).filter, postCallGateFilter());
});

test('a clone has one complete filter: on its Airtable module, none on the owner text', () => {
  const bp = masterBlueprint();
  patchPostCallBlueprint(bp, {
    baseId: 'appCLIENTbase0001',
    ingestToken: 'c'.repeat(64),
    masterMap: masterFieldMap(),
    clientMap: fieldMapFromSpec(CALL_LOG_FIELDS, { tableId: 'tblCLIENT00000001' }),
    quiet: true,
  });
  assert.deepEqual(gates(bp).map((m) => m.module), ['airtable:ActionCreateRecord']);
  assert.deepEqual(gate(bp).filter, postCallGateFilter());
});

test('a missing value reads as empty and a boolean as its text, as Make coerces them', () => {
  const f = { conditions: [[{ a: '{{1.call.call_analysis.in_voicemail}}', b: 'true', o: 'text:notequal' }]] };
  assert.equal(evaluateMakeFilter(f, { call: { call_analysis: { in_voicemail: true } } }), false);
  assert.equal(evaluateMakeFilter(f, { call: {} }), true, 'a never-connected call may carry no call_analysis');
});

test('an operator it cannot evaluate is "cannot judge", never a pass', () => {
  const bp = masterBlueprint();
  gate(bp).filter.conditions[0][0].o = 'text:contain';
  assert.equal(check(bp).ok, false);
  assert.equal(evaluateMakeFilter(gate(bp).filter, { event: 'call_analyzed', call: {} }), null);
});

test('no blueprint is "could not check"', () => {
  assert.equal(check(null).ok, null);
});
