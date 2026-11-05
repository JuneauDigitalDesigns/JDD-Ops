/**
 * A base provisioned before the SMS consent column can be repaired in place.
 *
 * **The bug this encodes (2026-11-04).** `_e2e_test_starter`'s base predates `SMS consent`, so
 * every caller's answer was dropped, and its onboard re-run refused on `airtable.schemaCovers`.
 * No repair could fix it: `repairAirtableBase` could create a whole Call Log table or the Site
 * column, never a missing column.
 *
 * The base is the RECORDED schema of that client base on that day
 * (test/fixtures/airtable/starter-base-pre-consent.json). Airtable is stood in for only by
 * replaying that recorded GET; the test asserts the create-field request the real repair sends.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { CALL_LOG_FIELDS, missingCallLogFields } from '../lib/call-log-fields.js';
import { SMS_CONSENT_CHOICES } from '../lib/voice-consent.js';
import { checkAirtableSchemaCovers, fieldMapFromSpec } from '../lib/onboard-checks.js';
import { repairAirtableBase } from '../lib/repair-ops.js';
import { loadFixture, masterFieldMap } from './helpers/fixtures.mjs';

const recorded = () => structuredClone(loadFixture('airtable/starter-base-pre-consent.json'));
const callLogOf = (schema) => schema.tables.find((t) => t.name === 'Call Log');
const coverage = (fields) => {
  const master = masterFieldMap();
  const client = fieldMapFromSpec(fields);
  return checkAirtableSchemaCovers({ masterMap: master, clientMap: client, masterChoices: master.choices, clientChoices: client.choices });
};

test('the recorded pre-consent base is refused by onboard.js, for the SMS consent column', () => {
  const c = coverage(callLogOf(recorded()).fields);
  assert.equal(c.ok, false);
  assert.match(c.detail, /SMS consent/);
});

test('it lacks the two later columns, with the right types and lowercase choices', () => {
  const missing = missingCallLogFields(callLogOf(recorded()));
  assert.deepEqual(missing.map((f) => f.name), ['Callback number', 'SMS consent']);
  const consent = missing.find((f) => f.name === 'SMS consent');
  assert.equal(consent.type, 'singleSelect');
  assert.deepEqual(consent.options.choices.map((c) => c.name), SMS_CONSENT_CHOICES);
  assert.equal(missing.find((f) => f.name === 'Callback number').type, 'phoneNumber');
  assert.deepEqual(SMS_CONSENT_CHOICES, ['granted', 'declined', 'unknown']);
  // And a complete table lacks nothing.
  assert.deepEqual(missingCallLogFields({ fields: CALL_LOG_FIELDS }), []);
});

/** Replay the recorded GET; capture every write. */
async function withRecordedBase(schema, run) {
  const writes = [];
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    if ((init.method ?? 'GET') === 'GET') return new Response(JSON.stringify(schema), { status: 200 });
    writes.push({ url: String(url), method: init.method, body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ id: 'fldNEW', ...JSON.parse(init.body) }), { status: 200 });
  };
  try {
    return { result: await run(), writes };
  } finally {
    globalThis.fetch = real;
  }
}

test('the columns repair adds exactly what is missing, and then onboard.js accepts the base', async () => {
  const schema = recorded();
  const table = callLogOf(schema);
  const { result, writes } = await withRecordedBase(schema, () =>
    repairAirtableBase({ apiKey: 'k', baseId: 'appRECORDED', want: 'columns' }),
  );
  assert.equal(result.ok, true, result.reason);
  assert.match(result.after, /SMS consent/);
  // Only create-field writes on the existing table — nothing modified, nothing removed.
  assert.equal(writes.length, 2);
  for (const w of writes) {
    assert.equal(w.method, 'POST');
    assert.ok(w.url.endsWith(`/v0/meta/bases/appRECORDED/tables/${table.id}/fields`), w.url);
    assert.deepEqual(w.body, CALL_LOG_FIELDS.find((f) => f.name === w.body.name));
  }

  // The table as it would read back: onboard.js's schema check now passes.
  const after = coverage([...table.fields, ...writes.map((w) => w.body)]);
  assert.equal(after.ok, true, after.detail);
});

test('a complete base is a no-op — no write at all', async () => {
  const schema = recorded();
  callLogOf(schema).fields.push(...missingCallLogFields(callLogOf(schema)));
  const { result, writes } = await withRecordedBase(schema, () =>
    repairAirtableBase({ apiKey: 'k', baseId: 'appRECORDED', want: 'columns' }),
  );
  assert.equal(result.noop, true);
  assert.equal(writes.length, 0);
});
