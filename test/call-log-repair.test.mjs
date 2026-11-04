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

test('the only column it lacks is SMS consent, with its lowercase choices', () => {
  const missing = missingCallLogFields(callLogOf(recorded()));
  assert.deepEqual(missing.map((f) => f.name), ['SMS consent']);
  assert.equal(missing[0].type, 'singleSelect');
  assert.deepEqual(missing[0].options.choices.map((c) => c.name), SMS_CONSENT_CHOICES);
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

test('the columns repair adds exactly SMS consent, and then onboard.js accepts the base', async () => {
  const schema = recorded();
  const table = callLogOf(schema);
  const { result, writes } = await withRecordedBase(schema, () =>
    repairAirtableBase({ apiKey: 'k', baseId: 'appRECORDED', want: 'columns' }),
  );
  assert.equal(result.ok, true, result.reason);
  assert.match(result.after, /SMS consent/);
  // One write, a create-field on the existing table — nothing modified, nothing removed.
  assert.equal(writes.length, 1);
  assert.equal(writes[0].method, 'POST');
  assert.ok(writes[0].url.endsWith(`/v0/meta/bases/appRECORDED/tables/${table.id}/fields`), writes[0].url);
  assert.deepEqual(writes[0].body, CALL_LOG_FIELDS.find((f) => f.name === 'SMS consent'));

  // The table as it would read back: onboard.js's schema check now passes.
  const after = coverage([...table.fields, writes[0].body]);
  assert.equal(after.ok, true, after.detail);
});

test('a complete base is a no-op — no write at all', async () => {
  const schema = recorded();
  callLogOf(schema).fields.push(CALL_LOG_FIELDS.find((f) => f.name === 'SMS consent'));
  const { result, writes } = await withRecordedBase(schema, () =>
    repairAirtableBase({ apiKey: 'k', baseId: 'appRECORDED', want: 'columns' }),
  );
  assert.equal(result.noop, true);
  assert.equal(writes.length, 0);
});
