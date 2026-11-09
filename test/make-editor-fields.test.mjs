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
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CALL_LOG_FIELDS } from '../lib/call-log-fields.js';
import { checkEditorShowsMappings } from '../lib/onboard-checks.js';
import { savedFieldLists, withEditorFields } from '../lib/make-editor-fields.js';
import { fieldMapFromSpec } from '../lib/onboard-checks.js';
import { rebuildCloneBlueprint } from '../lib/post-call-repatch.js';
import { loadFixture, masterBlueprint, masterFieldMap } from './helpers/fixtures.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
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

/* ── what a clone's editor draws ────────────────────────────────────────── */

const isAirtable = (m) => (m.module ?? '').startsWith('airtable');
const clientSpec = (extra = []) => fieldMapFromSpec([...CALL_LOG_FIELDS, ...extra], { tableId: 'tblCLIENT00000001' });

/** A clone built by the real path, from the master WITH its recorded form. */
function buildClone({ clientMap = clientSpec(), siteTag = null } = {}) {
  const master = drifted().bp;
  const clone = masterBlueprint();
  clone.flow[0].parameters = { ...clone.flow[0].parameters, hook: 3013197 };
  const next = rebuildCloneBlueprint({ clone, master, baseId: 'appCLIENTbase0001', siteTag, ingestToken: '9'.repeat(64), masterMap: fieldMap, clientMap });
  return { next, clientMap, mod: next.flow.find(isAirtable) };
}

test("a clone's saved list names its own base's columns, and its editor shows every mapping", () => {
  // Found 2026-11-09: patchPostCallBlueprint remapped mapper.record and left metadata as the
  // master's ids, so all 12 of each clone's mapped columns were missing from its editor.
  const { next, clientMap, mod } = buildClone();
  const c = checkEditorShowsMappings({ blueprint: next, fieldMap: clientMap });
  assert.equal(c.ok, true, c.detail);
  for (const list of Object.values(savedFieldLists(mod))) {
    assert.equal(list.length, Object.keys(mod.mapper.record).length);
    for (const entry of list) assert.equal(clientMap.byId[entry.name], entry.label, `${entry.label} points at another base`);
  }
});

test('a clone keeps each entry as the master described it, under its own id', () => {
  const { clientMap, mod } = buildClone();
  const { restore } = savedFieldLists(mod);
  const master = savedFieldLists(drifted().mod).restore.find((e) => e.label === 'Priority');
  assert.deepEqual(restore.find((e) => e.label === 'Priority'), { ...master, name: clientMap.byName.Priority });
});

test("a clone's mapped selects stay in edit mode, under its own ids", () => {
  const { clientMap, mod } = buildClone();
  const nested = mod.metadata.restore.expect.record.nested;
  assert.deepEqual(Object.keys(nested).sort(), ['Call type', 'Priority', 'SMS consent'].map((n) => clientMap.byName[n]).sort());
});

test('the master is not touched by building a clone from it', () => {
  const { bp } = drifted();
  const before = structuredClone(bp);
  const clone = masterBlueprint();
  rebuildCloneBlueprint({ clone, master: bp, baseId: 'appCLIENTbase0001', ingestToken: '9'.repeat(64), masterMap: fieldMap, clientMap: clientSpec() });
  assert.deepEqual(bp, before);
});

test("an enterprise clone's Site column shows too", () => {
  const site = { name: 'Site', type: 'singleSelect', options: { choices: [{ name: 'site-1' }] } };
  const { next, clientMap, mod } = buildClone({ clientMap: clientSpec([site]), siteTag: 'site-1' });
  const c = checkEditorShowsMappings({ blueprint: next, fieldMap: clientMap });
  assert.equal(c.ok, true, c.detail);
  assert.ok(savedFieldLists(mod).expect.some((e) => e.label === 'Site'));
});

test("a saved list naming another base's columns is caught, even when nothing is missing", () => {
  const { next, clientMap, mod } = buildClone();
  savedFieldLists(mod).expect.push({ name: 'fldMASTERonly00000', type: 'text', label: 'Caller name' });
  const c = checkEditorShowsMappings({ blueprint: next, fieldMap: clientMap });
  assert.equal(c.ok, false);
  assert.match(c.detail, /another base/);
});

test('re-patch and the dry run both hold a clone to this', () => {
  const repatch = readFileSync(resolve(ROOT, 'scripts/repatch-post-call.js'), 'utf8');
  assert.match(repatch, /checkEditorShowsMappings\(\{ blueprint, fieldMap: clientMap \}\)/);
  assert.match(readFileSync(resolve(ROOT, 'onboard.js'), 'utf8'), /checkEditorShowsMappings\(/);
});

