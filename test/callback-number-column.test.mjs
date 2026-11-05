/**
 * The number a caller asks to be reached at is kept.
 *
 * **The bug this encodes (found 2026-11-05).** Told "no, use my cell", the agent took the number
 * and confirmed it, Retell extracted it as `callback_number`, and then it was stored nowhere: no
 * column, no mapping. `Caller number` holds the line the call was on, so the owner was handed the
 * number the caller had just said not to use.
 *
 * The master side is the recorded blueprint and schema; the clone is built by the real
 * rebuild path; the pre-column base is the recorded schema of the starter fixture.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CALL_LOG_FIELDS, missingCallLogFields } from '../lib/call-log-fields.js';
import { checkCallbackNumberColumn, checkSelectMappingsTotal, fieldMapFromSpec } from '../lib/onboard-checks.js';
import { rebuildCloneBlueprint } from '../lib/post-call-repatch.js';
import { buildPostCallAnalysisData, CALLBACK_NUMBER_COLUMN, CALLBACK_NUMBER_MAPPING } from '../lib/voice-consent.js';
import { loadFixture, masterBlueprint, masterFieldMap } from './helpers/fixtures.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const clientMap = () => fieldMapFromSpec(CALL_LOG_FIELDS, { tableId: 'tblCLIENT00000001' });
const clone = () =>
  rebuildCloneBlueprint({
    clone: masterBlueprint(),
    master: masterBlueprint(),
    baseId: 'appCLIENTbase0001',
    ingestToken: '9'.repeat(64),
    masterMap: masterFieldMap(),
    clientMap: clientMap(),
  });

test('the recorded master keeps the callback number', () => {
  const c = checkCallbackNumberColumn({ blueprint: masterBlueprint(), fieldMap: masterFieldMap() });
  assert.equal(c.ok, true, c.detail);
});

test('a new client gets the column and the mapping through the real patch', () => {
  assert.ok(CALL_LOG_FIELDS.some((f) => f.name === CALLBACK_NUMBER_COLUMN && f.type === 'phoneNumber'));
  const cm = clientMap();
  const bp = clone();
  const c = checkCallbackNumberColumn({ blueprint: bp, fieldMap: cm });
  assert.equal(c.ok, true, c.detail);
  const at = bp.flow.find((m) => (m.module ?? '').startsWith('airtable'));
  assert.equal(at.mapper.record[cm.byName[CALLBACK_NUMBER_COLUMN]], CALLBACK_NUMBER_MAPPING);
});

test('a base without the column is refused, and the repair would add it', () => {
  const base = loadFixture('airtable/starter-base-pre-consent.json').tables[0];
  const c = checkCallbackNumberColumn({ blueprint: clone(), fieldMap: fieldMapFromSpec(base.fields) });
  assert.equal(c.ok, false);
  assert.match(c.detail, /no "Callback number" column/);
  assert.ok(missingCallLogFields(base).some((f) => f.name === CALLBACK_NUMBER_COLUMN));
});

test('a dropped mapping is caught: the column exists and stays empty', () => {
  const master = masterFieldMap();
  const bp = masterBlueprint();
  delete bp.flow.find((m) => (m.module ?? '').startsWith('airtable')).mapper.record[master.byName[CALLBACK_NUMBER_COLUMN]];
  const c = checkCallbackNumberColumn({ blueprint: bp, fieldMap: master });
  assert.equal(c.ok, false);
  assert.match(c.detail, /mapped to nothing/);
});

test('it can never lose the row: a free-text column, not a select', () => {
  const master = masterFieldMap();
  assert.equal(master.choices?.[CALLBACK_NUMBER_COLUMN], undefined);
  assert.equal(checkSelectMappingsTotal({ blueprint: masterBlueprint(), fieldMap: master }).ok, true);
  const asSelect = { ...master, choices: { ...master.choices, [CALLBACK_NUMBER_COLUMN]: ['a'] } };
  assert.equal(checkCallbackNumberColumn({ blueprint: masterBlueprint(), fieldMap: asSelect }).ok, false);
});

test('the extraction never falls back to "the number they called from"', () => {
  // On a callback the agent placed, "from" is the client's own Twilio number: the fallback could
  // have written the business's line into the column. Wording approved by Xander, 2026-11-05.
  const f = buildPostCallAnalysisData('Acme').find((x) => x.name === 'callback_number');
  assert.equal(
    f.description,
    "The best callback number the caller asked to be reached at, as spoken during the call (digits only). Empty string if none was spoken — never guess one, and never use the business's own number.",
  );
});

test('the console replica shows the mapping the master runs', () => {
  const src = readFileSync(resolve(ROOT, 'console/src/lib/make-modules.ts'), 'utf8');
  assert.ok(src.includes(`raw: '${CALLBACK_NUMBER_MAPPING}'`), 'console replica is missing the Callback number mapping');
  assert.match(src, /label: 'Callback number'/);
});
