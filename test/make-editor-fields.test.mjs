/**
 * What Make's editor shows for the Airtable module must include everything the module writes.
 *
 * **The bug this encodes (2026-11-09).** `SMS consent` and `Callback number` were added to the
 * master's `mapper.record` by API. They run, and real rows prove it, but Xander opened the module
 * and could see neither: the editor draws the field list saved in `metadata`, which had not changed
 * since 2026-08-28. The form can only submit what it drew, so OK is unsafe there.
 *
 * test/fixtures/make/master-airtable-metadata.json is RECORDED from the live master. Blueprint
 * fixtures drop module metadata (it can hold call data); this keeps only the form description.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { CALL_LOG_FIELDS } from '../lib/call-log-fields.js';
import { checkEditorShowsMappings } from '../lib/onboard-checks.js';
import { savedFieldLists, withEditorFields } from '../lib/make-editor-fields.js';
import { loadFixture, masterBlueprint, masterFieldMap } from './helpers/fixtures.mjs';

const fieldMap = masterFieldMap();
const SMS = fieldMap.byName['SMS consent'];
const CALLBACK = fieldMap.byName['Callback number'];

/** The master's Airtable module with its recorded form, minus the two columns, as it was on 11-09. */
function drifted() {
  const bp = masterBlueprint();
  const mod = bp.flow.find((m) => (m.module ?? '').startsWith('airtable'));
  mod.metadata = structuredClone(loadFixture('make/master-airtable-metadata.json'));
  const { expect, restore } = savedFieldLists(mod);
  for (const list of [expect, restore]) {
    for (let i = list.length - 1; i >= 0; i--) if ([SMS, CALLBACK].includes(list[i].name)) list.splice(i, 1);
  }
  delete mod.metadata.restore.expect.record?.nested?.[SMS];
  return { bp, mod };
}

const check = (blueprint) => checkEditorShowsMappings({ blueprint, fieldMap });

test('a column that runs but is missing from the editor list is caught, by name', () => {
  const c = check(drifted().bp);
  assert.equal(c.ok, false);
  assert.match(c.detail, /SMS consent/);
  assert.match(c.detail, /Callback number/);
  assert.doesNotMatch(c.detail, /FAIL:/);
});

test('the repair adds exactly the two columns and changes nothing that runs', () => {
  const { bp, mod } = drifted();
  const fixed = withEditorFields(mod, { fieldMap, fields: CALL_LOG_FIELDS });
  assert.deepEqual(fixed.mapper, mod.mapper, 'mappings are untouched');
  assert.deepEqual(fixed.filter, mod.filter, 'the filter is untouched');

  const before = savedFieldLists(mod);
  const after = savedFieldLists(fixed);
  for (const key of ['expect', 'restore']) {
    assert.deepEqual(after[key].slice(0, before[key].length), before[key], `${key}: existing entries are untouched`);
    assert.deepEqual(after[key].slice(before[key].length).map((s) => s.label).sort(), ['Callback number', 'SMS consent']);
  }

  bp.flow[bp.flow.indexOf(mod)] = fixed;
  const c = check(bp);
  assert.equal(c.ok, true, c.detail);
});

test('SMS consent is described like the other mapped selects, with its lowercase choices', () => {
  const { mod } = drifted();
  const fixed = withEditorFields(mod, { fieldMap, fields: CALL_LOG_FIELDS });
  const { expect, restore } = savedFieldLists(fixed);
  assert.deepEqual(expect.find((s) => s.name === SMS), { mode: 'edit', name: SMS, type: 'select', label: 'SMS consent' });
  assert.deepEqual(restore.find((s) => s.name === SMS), {
    mode: 'edit',
    name: SMS,
    type: 'select',
    label: 'SMS consent',
    dynamic: true,
    options: ['granted', 'declined', 'unknown'].map((v) => ({ label: v, value: v })),
    validate: false,
  });
  assert.deepEqual(fixed.metadata.restore.expect.record.nested[SMS], { mode: 'edit' });
  assert.deepEqual(expect.find((s) => s.name === CALLBACK), { name: CALLBACK, type: 'text', label: 'Callback number' });
});

test('a select without edit mode is caught: the editor would draw a dropdown, not the formula', () => {
  const { bp, mod } = drifted();
  const fixed = withEditorFields(mod, { fieldMap, fields: CALL_LOG_FIELDS });
  delete fixed.metadata.restore.expect.record.nested[SMS];
  bp.flow[bp.flow.indexOf(mod)] = fixed;
  const c = check(bp);
  assert.equal(c.ok, false);
  assert.match(c.detail, /SMS consent/);
});

test('the repair is idempotent', () => {
  const once = withEditorFields(drifted().mod, { fieldMap, fields: CALL_LOG_FIELDS });
  assert.deepEqual(withEditorFields(once, { fieldMap, fields: CALL_LOG_FIELDS }), once);
});

test('a clone whose saved list is still the master\'s ids is caught', () => {
  // Every clone today: patchPostCallBlueprint remaps mapper.record to the client's ids and leaves
  // metadata alone, so none of a clone's mapped columns are in the list its editor draws.
  const { bp, mod } = drifted();
  mod.mapper.record = Object.fromEntries(Object.entries(mod.mapper.record).map(([k, v], i) => [`fldCLIENT${i}`, v]));
  const byId = Object.fromEntries(Object.keys(mod.mapper.record).map((k, i) => [k, Object.keys(fieldMap.byName)[i]]));
  const c = checkEditorShowsMappings({ blueprint: bp, fieldMap: { ...fieldMap, byId } });
  assert.equal(c.ok, false);
});

test('a blueprint without metadata is "could not check", never a pass', () => {
  assert.equal(check(masterBlueprint()).ok, null, 'the scrubbed fixture has no metadata');
  assert.equal(checkEditorShowsMappings({ blueprint: null, fieldMap }).ok, null);
});
