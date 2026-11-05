#!/usr/bin/env node
/**
 * scripts/repatch-post-call.js — bring one client's post-call Make clone up to the current master.
 *
 * Usage:
 *   npm run repatch-post-call -- --slug <slug>                 # PREVIEW: checks + before/after, writes nothing
 *   npm run repatch-post-call -- --slug <slug> --write         # also PATCH the clone, read back, re-check
 *   ... --site site-2                                          # an enterprise site's folder under clients/<slug>/
 *
 * A clone is a copy taken at onboarding, so a master edit never reaches existing clients. This
 * rebuilds the clone from the CURRENT master through the real `patchPostCallBlueprint` (see
 * lib/post-call-repatch.js), keeping the clone's own webhook trigger.
 *
 * Safe by construction:
 *   - preview unless `--write`;
 *   - every blueprint check runs on the rebuilt clone FIRST, and any failure refuses the write;
 *   - the clone's current blueprint is saved beside its .env.local before writing (it contains
 *     the site's token, so it stays in the gitignored client folder and is never printed);
 *   - after the PATCH the clone is read back and checked again, and the trigger compared;
 *   - the clone's on/off state is reported, never changed — a switched-off clone stays off.
 *
 * Never prints LEAD_INGEST_TOKEN: no check detail and no log line here includes it.
 *
 * Exit codes: 0 ok (or clean preview) · 1 a check failed / Make refused · 2 missing config
 */

import dotenv from 'dotenv';
dotenv.config({ override: true });

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { airtableFieldMap, readEnvLocal } from '../onboard.js';
import { fetchWithRetry } from '../lib/make-fetch.js';
import { rebuildCloneBlueprint, checkCloneTriggerKept, describeFlow } from '../lib/post-call-repatch.js';
import {
  checkBlueprintFieldsResolve,
  checkBlueprintNoDatastore,
  checkSelectMappingsTotal,
  checkCallbackNumberColumn,
  checkConnectedCallsOnly,
  checkOwnerBriefViaAgency,
  checkAnalysisCoversBlueprint,
  formatCheckLines,
} from '../lib/onboard-checks.js';
import { CALL_OUTCOME_CASES, shouldLog } from '../lib/call-outcomes.js';
import { buildPostCallAnalysisData } from '../lib/voice-consent.js';

const MAKE_ZONE = 'https://us2.make.com/api/v2';
const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : null;
};
const WRITE = process.argv.includes('--write');

function die(code, msg) {
  console.error(`repatch-post-call: ${msg}`);
  process.exit(code);
}

/** Every check a correct clone must pass, on one blueprint. */
function checksFor(blueprint, { clientMap, siteTag, ingestToken }) {
  return [
    checkBlueprintFieldsResolve({ blueprint, clientMap, siteTag }),
    checkBlueprintNoDatastore({ blueprint }),
    checkSelectMappingsTotal({ blueprint, fieldMap: clientMap }),
    checkCallbackNumberColumn({ blueprint, fieldMap: clientMap }),
    checkAnalysisCoversBlueprint({ blueprint, analysisData: buildPostCallAnalysisData('') }),
    checkConnectedCallsOnly({ blueprint, cases: CALL_OUTCOME_CASES, shouldLog }),
    checkOwnerBriefViaAgency({ blueprint, ingestToken }),
  ];
}

async function main() {
  const slug = arg('slug');
  if (!slug) die(2, 'Missing --slug <slug>');
  const clientDir = resolve('clients', slug, ...(arg('site') ? [arg('site')] : []));
  const env = readEnvLocal(clientDir);
  const cloneId = env.MAKE_POST_CALL_SCENARIO_ID;
  const baseId = env.AIRTABLE_BASE_ID;
  const ingestToken = env.LEAD_INGEST_TOKEN || '';
  const siteTag = env.AIRTABLE_SITE_TAG || null;
  if (!cloneId) die(2, `No MAKE_POST_CALL_SCENARIO_ID in ${clientDir}/.env.local — nothing to re-patch`);
  if (!baseId) die(2, `No AIRTABLE_BASE_ID in ${clientDir}/.env.local`);
  if (!process.env.MAKE_API_KEY || !process.env.MAKE_POST_CALL_MASTER_SCENARIO_ID) die(2, 'MAKE_API_KEY / MAKE_POST_CALL_MASTER_SCENARIO_ID not set in .env');

  const headers = { Authorization: `Token ${process.env.MAKE_API_KEY}`, 'Content-Type': 'application/json' };
  const onRetry = ({ attempt, waitMs }) => console.warn(`  … Make rate limit; waiting ${Math.round(waitMs / 1000)}s (retry ${attempt})`);
  const getJson = async (path) => {
    const r = await fetchWithRetry(`${MAKE_ZONE}${path}`, { headers }, { onRetry });
    if (!r.ok) die(1, `Make GET ${path} returned ${r.status}`);
    return r.json();
  };

  const master = (await getJson(`/scenarios/${process.env.MAKE_POST_CALL_MASTER_SCENARIO_ID}/blueprint`)).response.blueprint;
  const clone = (await getJson(`/scenarios/${cloneId}/blueprint`)).response.blueprint;
  const scenario = (await getJson(`/scenarios/${cloneId}`)).scenario;

  const masterBaseId = master.flow.find((m) => (m.module ?? '').startsWith('airtable'))?.mapper?.base;
  const [masterMap, clientMap] = await Promise.all([airtableFieldMap(masterBaseId), airtableFieldMap(baseId)]);
  if (!masterMap || !clientMap) die(1, 'could not read the master or client Airtable schema');

  console.log(`Clone ${cloneId} for ${slug} — ${scenario?.isActive ? 'ACTIVE' : 'switched OFF'} (left as it is)`);
  console.log(`  now:   ${describeFlow(clone)}`);
  console.log('  checks on the clone as it is:');
  for (const l of formatCheckLines(checksFor(clone, { clientMap, siteTag, ingestToken }))) console.log(`  ${l}`);

  let next;
  try {
    next = rebuildCloneBlueprint({ clone, master, baseId, siteTag, ingestToken, masterMap, clientMap });
  } catch (e) {
    die(1, e.message);
  }
  const after = [...checksFor(next, { clientMap, siteTag, ingestToken }), checkCloneTriggerKept({ before: clone, after: next })];
  console.log(`  next:  ${describeFlow(next)}`);
  console.log('  checks on the rebuilt clone:');
  for (const l of formatCheckLines(after)) console.log(`  ${l}`);

  if (after.some((c) => c.ok !== true)) die(1, 'a check on the rebuilt clone did not pass — nothing written');
  if (!WRITE) {
    console.log('\nPreview only — nothing written. Re-run with --write to apply.');
    return;
  }

  const backup = resolve(clientDir, `post-call-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(backup, JSON.stringify(clone, null, 2));
  console.log(`  saved the current blueprint to ${backup} (contains this site's token — keep it local)`);

  const r = await fetchWithRetry(
    `${MAKE_ZONE}/scenarios/${cloneId}`,
    { method: 'PATCH', headers, body: JSON.stringify({ blueprint: JSON.stringify(next) }) },
    { onRetry },
  );
  if (!r.ok) die(1, `Make PATCH returned ${r.status}`);

  const readBack = (await getJson(`/scenarios/${cloneId}/blueprint`)).response.blueprint;
  const state = (await getJson(`/scenarios/${cloneId}`)).scenario;
  const final = [...checksFor(readBack, { clientMap, siteTag, ingestToken }), checkCloneTriggerKept({ before: clone, after: readBack })];
  console.log(`\n✓ PATCH ${r.status}. Read back: ${describeFlow(readBack)} — ${state?.isActive ? 'ACTIVE' : 'switched OFF'}`);
  for (const l of formatCheckLines(final)) console.log(`  ${l}`);
  if (final.some((c) => c.ok !== true)) die(1, `a check failed on the read-back — restore from ${backup} if needed`);
}

main().catch((e) => die(1, `unexpected error: ${e?.message ?? e}`));
