/**
 * The contract between the base onboard.js CREATES and the columns the Make master WRITES.
 *
 * Step 8c remaps the cloned blueprint's record keys by column NAME (ids are base-scoped and
 * useless across bases). So the two sides must agree on names, and on `singleSelect` choices.
 *
 * Note what is being compared: `CALL_LOG_FIELDS` — the live spec onboard.js sends to
 * create-base — against a RECORDED read of the real master base. Freezing a captured client
 * base as a fixture would only prove what one historical base looked like; this proves what
 * the NEXT client base will look like, which is the thing that can still break.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { CALL_LOG_FIELDS } from '../onboard.js';
import { checkAirtableSchemaCovers, fieldMapFromSpec } from '../lib/onboard-checks.js';
import { masterBlueprint, masterFieldMap } from './helpers/fixtures.mjs';

const clientMap = () => fieldMapFromSpec(CALL_LOG_FIELDS);

/** The column names the master actually writes, resolved through the master's own field ids. */
function masterWrittenColumns() {
  const master = masterFieldMap();
  const at = masterBlueprint().flow.find((m) => (m.module ?? '').startsWith('airtable'));
  return Object.keys(at.mapper.record).map((id) => master.byId[id]);
}

test('every column the master writes exists in the base we create', () => {
  const created = new Set(Object.keys(clientMap().byName));
  const missing = masterWrittenColumns().filter((c) => !created.has(c));
  assert.deepEqual(missing, [], 'a missing column is silently dropped from every logged call');
});

test('singleSelect choices match what Retell actually sends', () => {
  // `typecast: false` means an unknown option rejects the ENTIRE row, not just the cell. This
  // is why Call type is lowercase "inbound"/"outbound" and not "Inbound"/"Outbound callback":
  // the master maps {{1.call.direction}} straight through.
  const master = masterFieldMap();
  const spec = clientMap();
  for (const [col, masterChoices] of Object.entries(master.choices)) {
    const ours = spec.choices[col];
    if (!ours) continue; // a column we create as a different type is caught by the test above
    const absent = masterChoices.filter((c) => !ours.includes(c));
    assert.deepEqual(absent, [], `"${col}" is missing choice(s) the master writes`);
  }
});

test('Call type is specifically lowercase, matching Retell', () => {
  // Pinned explicitly because this exact value regressed once and the symptom was a row that
  // silently failed to write rather than a visible error.
  const ct = CALL_LOG_FIELDS.find((f) => f.name === 'Call type');
  assert.deepEqual(ct.options.choices.map((c) => c.name), ['inbound', 'outbound']);
});

test('Outcome exists but is deliberately unwritten by the master', () => {
  // It is for the owner to set by hand while triaging, which is why it keeps human-cased
  // labels. If the master ever starts writing it, this test should fail and force a decision.
  assert.ok(CALL_LOG_FIELDS.some((f) => f.name === 'Outcome'));
  assert.ok(!masterWrittenColumns().includes('Outcome'), 'the master has no Outcome mapping');
});

test('the schema-covers predicate passes for the real pair', () => {
  const master = masterFieldMap();
  const spec = clientMap();
  const c = checkAirtableSchemaCovers({
    masterMap: master,
    clientMap: spec,
    masterChoices: master.choices,
    clientChoices: spec.choices,
  });
  assert.equal(c.ok, true, c.detail);
});

test('the predicate catches a dropped column', () => {
  const master = masterFieldMap();
  const spec = fieldMapFromSpec(CALL_LOG_FIELDS.filter((f) => f.name !== 'Summary'));
  const c = checkAirtableSchemaCovers({ masterMap: master, clientMap: spec });
  assert.equal(c.ok, false);
  assert.match(c.detail, /Summary/);
});

test('the predicate catches mis-cased singleSelect choices', () => {
  // The exact regression: prettier labels that Airtable then rejects.
  const master = masterFieldMap();
  const spec = fieldMapFromSpec(
    CALL_LOG_FIELDS.map((f) =>
      f.name === 'Call type'
        ? { ...f, options: { choices: [{ name: 'Inbound' }, { name: 'Outbound callback' }] } }
        : f,
    ),
  );
  const c = checkAirtableSchemaCovers({
    masterMap: master,
    clientMap: spec,
    masterChoices: master.choices,
    clientChoices: spec.choices,
  });
  assert.equal(c.ok, false);
  assert.match(c.detail, /Call type/);
});

test('the predicate reports null when a schema could not be read', () => {
  assert.equal(checkAirtableSchemaCovers({ masterMap: null, clientMap: clientMap() }).ok, null);
  assert.equal(checkAirtableSchemaCovers({ masterMap: masterFieldMap(), clientMap: null }).ok, null);
});
