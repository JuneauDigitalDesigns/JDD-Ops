/**
 * The post-call Make blueprint patch — four of the seven bugs lived in this one function.
 *
 * Every case below is a bug that actually shipped, asserted against the RECORDED master
 * blueprint rather than a hand-written one. That distinction is the whole point: a
 * hand-written fixture would carry the field ids we assumed, and we assumed wrong. Airtable
 * table and field ids are base-scoped, so the master's `tbl…`/`fld…` mean nothing in a
 * freshly created client base — which is exactly what the old code shipped.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { patchPostCallBlueprint, CALL_LOG_FIELDS } from '../onboard.js';
import {
  checkBlueprintFieldsResolve,
  checkBlueprintEventFilter,
  checkBlueprintNoDatastore,
  fieldMapFromSpec,
} from '../lib/onboard-checks.js';
import { masterBlueprint, masterFieldMap } from './helpers/fixtures.mjs';

const CLIENT_BASE = 'appCLIENTbase0001';

/** Patch a copy of the recorded master the way step 8c does for one client. */
function patched({ siteTag = null, smsEnabled = true, withSiteColumn = false } = {}) {
  const bp = masterBlueprint();
  const masterMap = masterFieldMap();
  const spec = withSiteColumn
    ? [...CALL_LOG_FIELDS, { name: 'Site', type: 'singleSelect', options: { choices: [{ name: siteTag }] } }]
    : CALL_LOG_FIELDS;
  const clientMap = fieldMapFromSpec(spec, { tableId: 'tblCLIENT00000001' });
  patchPostCallBlueprint(bp, {
    baseId: CLIENT_BASE,
    siteTag,
    fromNum: '+15005550006',
    toNum: smsEnabled ? '+15005550009' : '',
    smsEnabled,
    masterMap,
    clientMap,
    quiet: true,
  });
  return { bp, masterMap, clientMap };
}

const airtableOf = (bp) => bp.flow.find((m) => (m.module ?? '').startsWith('airtable'));

test('the recorded master still has the shape the patcher expects', () => {
  const bp = masterBlueprint();
  const at = airtableOf(bp);
  assert.ok(at, 'master must have an airtable module or nothing is ever logged');
  assert.equal(at.module, 'airtable:ActionCreateRecord');
  // If any of these move, the patcher is writing to keys the module does not read.
  for (const key of ['base', 'table', 'record']) {
    assert.ok(key in at.mapper, `airtable mapper must still carry "${key}"`);
  }
  assert.equal(at.mapper.typecast, false, 'typecast:false is why singleSelect casing must match exactly');
});

test('mapper.table is remapped to the client base (stale table id failed every write)', () => {
  const { bp, clientMap } = patched();
  assert.equal(airtableOf(bp).mapper.table, clientMap.tableId);
  assert.notEqual(airtableOf(bp).mapper.table, masterFieldMap().tableId);
});

test('every record key is remapped by column name, none left pointing at the master base', () => {
  const { bp, masterMap, clientMap } = patched();
  const keys = Object.keys(airtableOf(bp).mapper.record);
  assert.ok(keys.length > 0, 'an empty record mapping would create blank rows');
  for (const k of keys) {
    assert.ok(k in clientMap.byId, `record key ${k} must be a client field id`);
    assert.ok(!(k in masterMap.byId), `record key ${k} is still a MASTER field id`);
  }
  // The remap must be lossless: every column the master wrote still has a home.
  const masterCols = Object.keys(airtableOf(masterBlueprint()).mapper.record).map((id) => masterFieldMap().byId[id]);
  const mappedCols = keys.map((id) => clientMap.byId[id]);
  assert.deepEqual(new Set(mappedCols), new Set(masterCols));
});

test('the enterprise Site tag goes INSIDE mapper.record, not as a top-level mapper key', () => {
  const siteTag = 'acme-2';
  const { bp, clientMap } = patched({ siteTag, withSiteColumn: true });
  const mapper = airtableOf(bp).mapper;
  // The original bug: `mapper.Site = siteTag`, a key airtable:ActionCreateRecord never reads.
  // The column stayed empty and the portal — which filters `row.Site === site.slug` — showed
  // a multi-site client no calls at all.
  assert.ok(!('Site' in mapper), 'mapper.Site is not a key the module reads');
  assert.equal(mapper.record[clientMap.byName.Site], siteTag);
});

test('a single-site client gets no Site value at all', () => {
  const { bp, clientMap } = patched({ siteTag: null });
  assert.equal(airtableOf(bp).mapper.record[clientMap.byName.Site], undefined);
});

test('the vestigial datastore module is removed', () => {
  // Left in, a GetRecord miss emits no bundle and halts the route before Airtable or Twilio —
  // so the clone would silently no-op for every newly provisioned agent.
  assert.ok(
    masterBlueprint().flow.some((m) => (m.module ?? '').startsWith('datastore')),
    'the master still carries the datastore module, so removal is still being exercised',
  );
  const { bp } = patched();
  assert.equal(bp.flow.filter((m) => (m.module ?? '').startsWith('datastore')).length, 0);
});

test('the call_analyzed filter survives datastore removal', () => {
  // Retell posts call_started and call_ended to the same webhook. Dropping the module and its
  // filter together logs three rows per call, two with no transcript or summary.
  const master = masterBlueprint();
  const dsFilter = master.flow.find((m) => (m.module ?? '').startsWith('datastore'))?.filter;
  assert.ok(JSON.stringify(dsFilter).includes('call_analyzed'), 'precondition: the master gates on call_analyzed');

  const { bp } = patched();
  assert.ok(
    JSON.stringify(airtableOf(bp).filter).includes('call_analyzed'),
    'the filter must be carried onto the next surviving module',
  );
});

test('Twilio from/to are applied when SMS consent is on file', () => {
  const { bp } = patched({ smsEnabled: true });
  const tw = bp.flow.find((m) => (m.module ?? '').startsWith('twilio'));
  assert.ok(tw, 'the twilio module should survive when consent exists');
  assert.equal(tw.mapper.from, '+15005550006');
  assert.equal(tw.mapper.to, '+15005550009');
});

test('the Twilio module is removed entirely without consent', () => {
  // Not left configured-but-empty: an unconfigured module errors on every run, and enough
  // errors get the scenario auto-disabled — which takes the Airtable call log down with it.
  const { bp } = patched({ smsEnabled: false });
  assert.equal(bp.flow.filter((m) => (m.module ?? '').startsWith('twilio')).length, 0);
  assert.ok(airtableOf(bp), 'removing Twilio must not disturb Airtable logging');
});

test('the predicates agree with the patched result', () => {
  const siteTag = 'acme-2';
  const { bp, clientMap } = patched({ siteTag, withSiteColumn: true });
  for (const c of [
    checkBlueprintFieldsResolve({ blueprint: bp, clientMap, siteTag }),
    checkBlueprintEventFilter({ blueprint: bp }),
    checkBlueprintNoDatastore({ blueprint: bp }),
  ]) {
    assert.equal(c.ok, true, `${c.id} should pass: ${c.detail}`);
  }
});

test('predicates report null — never true — when there is nothing to inspect', () => {
  // "We could not check" must never render as "fine". That conflation is the exact shape of
  // the console probe bug: it returned unchecked for every client and read as healthy.
  for (const c of [
    checkBlueprintFieldsResolve({ blueprint: null, clientMap: null, siteTag: null }),
    checkBlueprintEventFilter({ blueprint: null }),
    checkBlueprintNoDatastore({ blueprint: null }),
  ]) {
    assert.equal(c.ok, null, `${c.id} must be null, not a pass`);
  }
});

test('checkBlueprintFieldsResolve catches each failure mode it exists for', () => {
  const siteTag = 'acme-2';
  const { clientMap } = patched({ siteTag, withSiteColumn: true });

  // stale table id
  const staleTable = patched({ siteTag, withSiteColumn: true });
  airtableOf(staleTable.bp).mapper.table = 'tblMASTERold00000';
  assert.equal(checkBlueprintFieldsResolve({ blueprint: staleTable.bp, clientMap, siteTag }).ok, false);

  // a record key from another base
  const foreignKey = patched({ siteTag, withSiteColumn: true });
  airtableOf(foreignKey.bp).mapper.record.fldFROMANOTHERBASE = '{{1.call.x}}';
  assert.equal(checkBlueprintFieldsResolve({ blueprint: foreignKey.bp, clientMap, siteTag }).ok, false);

  // Site written as a top-level mapper key (the original bug)
  const topLevelSite = patched({ siteTag, withSiteColumn: true });
  airtableOf(topLevelSite.bp).mapper.Site = siteTag;
  assert.equal(checkBlueprintFieldsResolve({ blueprint: topLevelSite.bp, clientMap, siteTag }).ok, false);

  // Site tag expected but absent from the record
  const noSite = patched({ siteTag, withSiteColumn: true });
  delete airtableOf(noSite.bp).mapper.record[clientMap.byName.Site];
  assert.equal(checkBlueprintFieldsResolve({ blueprint: noSite.bp, clientMap, siteTag }).ok, false);

  // no airtable module at all
  const gutted = patched({ siteTag, withSiteColumn: true });
  gutted.bp.flow = gutted.bp.flow.filter((m) => !(m.module ?? '').startsWith('airtable'));
  assert.equal(checkBlueprintFieldsResolve({ blueprint: gutted.bp, clientMap, siteTag }).ok, false);
});
