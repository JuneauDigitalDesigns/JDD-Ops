#!/usr/bin/env node
/**
 * scripts/verify-post-call.js — read-only proof that step 8c's blueprint patch produces a
 * working post-call scenario BEFORE a client run creates one.
 *
 * Background: `cloneAndWirePostCall` clones the Make master scenario and rewrites its
 * Airtable + Twilio modules for one client. Everything that can go wrong there goes wrong
 * silently — a clone with a stale table id, a dropped column, or a missing event filter
 * still looks like a healthy scenario in the Make UI, and the only symptom is a call log
 * that never fills. Every failure of this kind costs a real client real leads before anyone
 * notices, so it is worth proving on demand.
 *
 * What it does:
 *   1. GETs the live master blueprint.
 *   2. Reads the master base's `Call Log` schema (field id → column name).
 *   3. Reads a REAL client base's schema if --base is given, otherwise simulates the base
 *      `createAirtableBase` would create today.
 *   4. Runs the actual `patchPostCallBlueprint` from onboard.js — not a copy — and asserts
 *      the result is something that would work.
 *
 * Strictly read-only. GETs only; never clones, patches, or activates anything.
 *
 * Usage:
 *   npm run verify-post-call
 *   npm run verify-post-call -- --base appXXXXXXXX   # check a provisioned client's base
 *   npm run verify-post-call -- --site e2e_test_2    # also check the enterprise Site tag
 *
 * Exit codes:
 *   0  the patched blueprint would log calls correctly
 *   1  a check failed
 *   2  required config missing
 */

import dotenv from 'dotenv';
dotenv.config({ override: true });

import { patchPostCallBlueprint, airtableFieldMap, CALL_LOG_FIELDS } from '../onboard.js';
import { checkAnalysisCoversBlueprint } from '../lib/onboard-checks.js';
import { buildPostCallAnalysisData } from '../lib/voice-consent.js';

const MAKE_ZONE = 'https://us2.make.com/api/v2';

const argOf = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : null;
};
const clientBaseArg = argOf('base');
const siteTag = argOf('site');

const problems = [];
const note = (m) => console.log(m);
const bad = (m) => { problems.push(m); console.error(`  ✗ ${m}`); };

// The columns createAirtableBase creates today — read from the shared spec, not restated, so the
// verifier cannot pass against a column list onboard.js no longer creates.
const EXPECTED_COLUMNS = CALL_LOG_FIELDS.map((f) => f.name);

async function main() {
  const apiKey = process.env.MAKE_API_KEY;
  const masterId = process.env.MAKE_POST_CALL_MASTER_SCENARIO_ID;
  if (!apiKey || !masterId) {
    console.error('✗ MAKE_API_KEY / MAKE_POST_CALL_MASTER_SCENARIO_ID not set in .env');
    console.error('  Run `npm run verify-make` first — it diagnoses credentials specifically.');
    process.exit(2);
  }
  if (!process.env.AIRTABLE_API_KEY) {
    console.error('✗ AIRTABLE_API_KEY not set in .env — cannot resolve field ids.');
    process.exit(2);
  }

  const headers = { Authorization: `Token ${apiKey}` };

  // 1) Master blueprint.
  const res = await fetch(`${MAKE_ZONE}/scenarios/${masterId}/blueprint`, { headers });
  if (!res.ok) {
    console.error(`✗ get-blueprint returned ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  const blueprint = (await res.json())?.response?.blueprint;
  if (!blueprint?.flow) {
    console.error('✗ Blueprint missing `flow` — the response shape onboard.js expects has changed.');
    process.exit(1);
  }
  note(`✓ Master blueprint "${blueprint.name}" — ${blueprint.flow.length} module(s): ${blueprint.flow.map((m) => m.module).join(' → ')}`);

  const airtableMod = blueprint.flow.find((m) => (m.module ?? '').startsWith('airtable'));
  if (!airtableMod) {
    console.error('✗ Master has no airtable:* module — step 8c would clone a scenario that logs nothing.');
    process.exit(1);
  }

  // 2) + 3) Schemas on both sides.
  const masterBaseId = airtableMod.mapper?.base;
  const masterMap = await airtableFieldMap(masterBaseId);
  if (!masterMap) {
    console.error(`✗ Could not read master base ${masterBaseId} schema.`);
    process.exit(1);
  }
  note(`✓ Master base ${masterBaseId} "Call Log" — ${Object.keys(masterMap.byName).length} column(s)`);

  let clientMap;
  if (clientBaseArg) {
    clientMap = await airtableFieldMap(clientBaseArg);
    if (!clientMap) {
      console.error(`✗ Could not read client base ${clientBaseArg} schema.`);
      process.exit(1);
    }
    note(`✓ Client base ${clientBaseArg} "Call Log" — ${Object.keys(clientMap.byName).length} column(s)`);
  } else {
    const byName = {};
    const byId = {};
    for (const [i, name] of EXPECTED_COLUMNS.entries()) {
      const id = `fldSIM${String(i).padStart(11, '0')}`;
      byName[name] = id;
      byId[id] = name;
    }
    if (siteTag) { byName.Site = 'fldSIMSITE00000'; byId.fldSIMSITE00000 = 'Site'; }
    clientMap = { tableId: 'tblSIMULATED0000', byName, byId };
    note(`• No --base given — simulating the base createAirtableBase would create (${EXPECTED_COLUMNS.length} columns${siteTag ? ' + Site' : ''})`);
  }

  // Master column with no home in the client base = a value silently dropped from every call.
  const orphans = Object.keys(masterMap.byName).filter((n) => !(n in clientMap.byName));
  if (orphans.length) {
    bad(`Master writes column(s) the client base lacks: ${orphans.join(', ')} — add them to createAirtableBase.`);
  } else {
    note(`✓ Every master column exists in the client base`);
  }

  // 4) Run the real patch.
  const before = JSON.stringify(blueprint);
  patchPostCallBlueprint(blueprint, {
    baseId: clientMap === null ? null : (clientBaseArg ?? 'appSIMULATED'),
    siteTag,
    fromNum: '+15005550006',
    toNum: '+15005550009',
    smsEnabled: true,
    masterMap,
    clientMap,
  });
  if (JSON.stringify(blueprint) === before) bad('patchPostCallBlueprint made no changes at all.');

  const patchedAirtable = blueprint.flow.find((m) => (m.module ?? '').startsWith('airtable'));
  const patchedTwilio = blueprint.flow.find((m) => (m.module ?? '').startsWith('twilio'));

  console.log('\nPatched Airtable module:');
  if (patchedAirtable?.mapper?.table !== clientMap.tableId) {
    bad(`mapper.table is "${patchedAirtable?.mapper?.table}", expected the client table "${clientMap.tableId}". A stale table id fails every write.`);
  } else {
    note(`  ✓ table → ${clientMap.tableId}`);
  }

  const recordKeys = Object.keys(patchedAirtable?.mapper?.record ?? {});
  const foreign = recordKeys.filter((k) => !(k in clientMap.byId));
  if (foreign.length) {
    bad(`${foreign.length} record key(s) still belong to another base: ${foreign.join(', ')}`);
  } else {
    note(`  ✓ all ${recordKeys.length} record key(s) resolve to client field ids`);
    for (const k of recordKeys) note(`      ${clientMap.byId[k]}`);
  }

  if (siteTag) {
    const siteFld = clientMap.byName.Site;
    if (patchedAirtable?.mapper?.record?.[siteFld] !== siteTag) {
      bad(`Site tag "${siteTag}" was not written into mapper.record — the portal filters on row.Site and would show no calls.`);
    } else {
      note(`  ✓ Site → "${siteTag}" (in record, keyed ${siteFld})`);
    }
    if ('Site' in (patchedAirtable?.mapper ?? {})) {
      bad('mapper.Site is set as a top-level key — airtable:ActionCreateRecord does not read that.');
    }
  }

  // The datastore module must be gone AND its event filter must have survived, or the clone
  // logs a row for call_started and call_ended too — three rows per call, two of them empty.
  if (blueprint.flow.some((m) => (m.module ?? '').startsWith('datastore'))) {
    bad('A datastore module survived the patch — a lookup miss halts the route before Airtable runs.');
  } else {
    note('  ✓ datastore module removed');
  }
  const guard = JSON.stringify(patchedAirtable?.filter ?? null);
  if (guard.includes('call_analyzed')) {
    note('  ✓ call_analyzed event filter carried onto the Airtable module');
  } else {
    bad(`Airtable module has no call_analyzed filter (${guard}) — every Retell event would log a row.`);
  }

  // Every custom_analysis_data field the scenario reads must be one the agent extracts, or that
  // cell is blank on every call. Same predicate the dry run and the suite use.
  const analysis = checkAnalysisCoversBlueprint({ blueprint, analysisData: buildPostCallAnalysisData('') });
  if (analysis.ok) note(`  ✓ ${analysis.detail}`);
  else bad(analysis.detail);

  console.log('\nPatched Twilio module:');
  if (patchedTwilio?.mapper?.from !== '+15005550006' || patchedTwilio?.mapper?.to !== '+15005550009') {
    bad(`from/to not applied (from=${patchedTwilio?.mapper?.from}, to=${patchedTwilio?.mapper?.to}).`);
  } else {
    note('  ✓ from/to applied');
  }

  if (problems.length) {
    console.error(`\n✗ ${problems.length} problem(s) — step 8c would produce a scenario that does not log calls correctly.`);
    process.exit(1);
  }
  console.log('\n✓ Post-call blueprint patch verified against the live master.');
  process.exit(0);
}

main().catch((e) => {
  console.error(`verify-post-call: unexpected error: ${e?.stack ?? e}`);
  process.exit(2);
});
