#!/usr/bin/env node
// @ts-check
/**
 * scripts/record-a2p-fixtures.js — capture the Trust Hub payloads the A2P chain's tests replay.
 *
 *   npm run fixtures:a2p
 *   npm run fixtures:a2p -- --check     # exit 1 if anything drifted
 *
 * Separate from `refresh-fixtures.js` on purpose: that script also reads Make, and Make's API
 * limit is per organisation per minute, shared by every session on the account. Re-recording
 * Twilio shapes should never spend it.
 *
 * Strictly read-only — GETs only. What it records and why:
 *
 *   - The two sole-proprietor policies (`SOLE_PROP_POLICIES`). Whole, like the chain policies
 *     `refresh-fixtures.js` records: their `requirements` block is the authoritative list of
 *     EndUser types and attribute keys, and the test pins our builders to it.
 *   - The newest compliance evaluation of JDD's own primary profile and of JDD's own A2P trust
 *     product. These exist because Twilio's ISV guide documents an evaluation's results as
 *     `valid[]` / `invalid[]` and the real response carries `results[].fields[]` with a
 *     `passed` per field. A hand-written fixture would have encoded the documented shape and
 *     certified a parser that reads nothing. An evaluation holds field NAMES and pass flags,
 *     never values — the scrub below drops the account SID and URLs, and the script refuses to
 *     write anything tax-ID-shaped regardless.
 */

import dotenv from 'dotenv';
dotenv.config({ override: true });

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SOLE_PROP_POLICIES } from '../lib/a2p-register.js';
import { findTaxIdPaths } from '../lib/a2p-identity.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES = resolve(ROOT, 'test', 'fixtures', 'trusthub');
const TRUSTHUB = 'https://trusthub.twilio.com/v1';
const CHECK_ONLY = process.argv.includes('--check');

let failed = 0;
let changed = 0;

const sid = (process.env.TWILIO_ACCOUNT_SID ?? '').trim();
const token = (process.env.TWILIO_AUTH_TOKEN ?? '').trim();
const primary = (process.env.TWILIO_PRIMARY_PROFILE_SID ?? '').trim();
if (!sid || !token || !primary) {
  console.error('record-a2p-fixtures: needs TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_PRIMARY_PROFILE_SID in .env');
  process.exit(2);
}
const headers = { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}` };

/** @param {string} url @param {string} label */
async function getJson(url, label) {
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.error(`  ✗ ${label}: HTTP ${res.status}`);
      failed++;
      return null;
    }
    return await res.json();
  } catch (e) {
    console.error(`  ✗ ${label}: ${e instanceof Error ? e.message : e}`);
    failed++;
    return null;
  }
}

/** Drop the account SID, every URL and any email; nothing a test reads lives in them. */
function scrub(/** @type {unknown} */ value) {
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === 'object') {
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === 'account_sid' || k === 'url' || k === 'links' || k === 'email') continue;
      out[k] = scrub(v);
    }
    return out;
  }
  return value;
}

/** @param {string} name @param {unknown} data */
function save(name, data) {
  if (data == null) return;
  if (findTaxIdPaths(data).length) {
    console.error(`  ✗ ${name}: refused — tax-ID-shaped value at ${findTaxIdPaths(data).join(', ')}`);
    failed++;
    return;
  }
  const path = resolve(FIXTURES, name);
  const next = JSON.stringify(data, null, 2) + '\n';
  const prev = existsSync(path) ? readFileSync(path, 'utf8') : null;
  if (prev === next) {
    console.log(`  = ${name}`);
    return;
  }
  changed++;
  if (CHECK_ONLY) {
    console.log(`  ~ ${name} (drifted)`);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, next);
  console.log(`  ✓ ${name}`);
}

console.log('Trust Hub (A2P chain):');
for (const policy of SOLE_PROP_POLICIES) {
  save(`policy-${policy.key}.json`, scrub(await getJson(`${TRUSTHUB}/Policies/${policy.sid}`, policy.label)));
}

// JDD's primary profile as readiness reads it — so the suite can replay a READY account from a
// recording instead of a hand-written one. Three responses:
//   - the profile itself (status);
//   - its entity assignments (which IT… objects to look at);
//   - the business-information EndUser, REDUCED to `type` + `sid` + the two attributes readiness
//     reads (`business_identity`, `business_type`). Everything else is dropped before anything is
//     written — that EndUser is the one object on this account that holds JDD's own EIN, and an
//     allowlist is the only safe way to record it. `save` would refuse a tax-ID shape anyway.
save('primary-profile.json', scrub(await getJson(`${TRUSTHUB}/CustomerProfiles/${primary}`, 'primary profile')));
const assignments = await getJson(`${TRUSTHUB}/CustomerProfiles/${primary}/EntityAssignments?PageSize=50`, 'primary assignments');
save('primary-profile-assignments.json', assignments && scrub({ results: assignments.results ?? [], meta: { next_page_url: null } }));
for (const a of assignments?.results ?? []) {
  if (!String(a.object_sid).startsWith('IT')) continue;
  const endUser = await getJson(`${TRUSTHUB}/EndUsers/${a.object_sid}`, 'primary EndUser');
  if (endUser?.type !== 'customer_profile_business_information') continue;
  save('primary-business-enduser.json', {
    sid: endUser.sid,
    type: endUser.type,
    attributes: {
      business_identity: endUser.attributes?.business_identity,
      business_type: endUser.attributes?.business_type,
    },
  });
}

const profileEvals = await getJson(`${TRUSTHUB}/CustomerProfiles/${primary}/Evaluations?PageSize=1`, 'primary profile evaluations');
save('evaluation-customer-profile.json', profileEvals && scrub(profileEvals.results?.[0] ?? null));

// JDD's own A2P trust product is whichever approved one files against the A2P messaging policy.
const products = await getJson(`${TRUSTHUB}/TrustProducts?PageSize=50`, 'trust products');
const a2pProduct = (products?.results ?? []).find(
  (/** @type {{ policy_sid?: string, status?: string }} */ p) =>
    p.policy_sid === 'RNb0d4771c2c98518d916a3d4cd70a8f8b' && p.status === 'twilio-approved',
);
if (a2pProduct) {
  const evals = await getJson(`${TRUSTHUB}/TrustProducts/${a2pProduct.sid}/Evaluations?PageSize=1`, 'trust product evaluations');
  save('evaluation-trust-product.json', evals && scrub(evals.results?.[0] ?? null));
} else {
  console.error('  ✗ no approved A2P trust product found on this account');
  failed++;
}

// ── Teardown (lib/a2p-teardown.js) ─────────────────────────────────────────────────────────
// Each response is cut to an ALLOWLIST of the fields the teardown reads. Sources: the
// `_e2e_test_growth` drafts (a never-completed registration, the deletable case), JDD's own
// approved brand and verified campaign (the live case, which teardown must never delete), a real
// 404, and the KV record + a KV miss as Upstash's REST API returns them.
const pick = (/** @type {any} */ o, /** @type {string[]} */ keys) => (o ? Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k]])) : null);
const kvUrl = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/+$/, '');
const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
if (kvUrl && kvToken) {
  for (const [name, key] of [['kv-registration-e2e.json', 'jdd:a2p-registration:_e2e_test_growth'], ['kv-miss.json', 'jdd:a2p-registration:__fixture-miss__']]) {
    const res = await fetch(`${kvUrl}/get/${encodeURIComponent(key)}`, { headers: { Authorization: `Bearer ${kvToken}` } });
    save(`teardown/${name}`, res.ok ? await res.json() : null);
  }
} else {
  console.error('  ✗ KV credentials missing — teardown KV fixtures not recorded');
  failed++;
}
const e2e = { profile: 'BU3782f82c2f2f0c8fce2850d86ed2e932', doc: 'RD45150bfae738a5fc79746a2415e9502e' };
save('teardown/e2e-profile.json', pick(await getJson(`${TRUSTHUB}/CustomerProfiles/${e2e.profile}`, 'e2e profile'), ['sid', 'status', 'policy_sid']));
save('teardown/e2e-supporting-document.json', pick(await getJson(`${TRUSTHUB}/SupportingDocuments/${e2e.doc}`, 'e2e document'), ['sid', 'status', 'type']));
save('teardown/e2e-enduser-business.json', pick(await getJson(`${TRUSTHUB}/EndUsers/ITd979f6114c919fe4c1bdbf797ed3e7e2`, 'e2e business EndUser'), ['sid', 'type']));
save('teardown/e2e-enduser-rep.json', pick(await getJson(`${TRUSTHUB}/EndUsers/ITc341e12902d045d8a090218d07652d3a`, 'e2e rep EndUser'), ['sid', 'type']));
save('teardown/e2e-address.json', pick(await getJson(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Addresses/ADaa688365e86e41c5d6d4a1326733b3ed.json`, 'e2e address'), ['sid', 'iso_country', 'validated']));
save('teardown/brand-approved.json', pick(await getJson('https://messaging.twilio.com/v1/a2p/BrandRegistrations/BN6051caf4a60936c690c106d5a72f2de9', 'JDD brand'), ['sid', 'status', 'identity_status', 'mock', 'brand_type']));
const campaigns = await getJson('https://messaging.twilio.com/v1/Services/MGd65c80f165d080f5d6d5b451ac4f431c/Compliance/Usa2p', 'JDD campaign');
save('teardown/campaign-list-verified.json', campaigns && { compliance: (campaigns.compliance ?? []).map((/** @type {any} */ c) => pick(c, ['sid', 'campaign_status', 'brand_registration_sid', 'mock', 'us_app_to_person_usecase'])) });
{
  const res = await fetch(`${TRUSTHUB}/EndUsers/IT00000000000000000000000000000000`, { headers });
  save('teardown/twilio-404.json', { httpStatus: res.status, body: pick(await res.json(), ['code', 'message', 'status']) });
}

// A real NONCOMPLIANT evaluation, by explicit SID: `-- --noncompliant BU…/EL…`. JDD's own
// bundles only ever evaluate compliant, so the failing shape can only come from a client
// profile — first captured from the 2026-11-02 `_e2e_test_growth` draft (job_position "Owner").
const flag = process.argv.indexOf('--noncompliant');
if (flag > -1) {
  const [bundle, evaluation] = String(process.argv[flag + 1] ?? '').split('/');
  if (!/^BU[0-9a-f]{32}$/.test(bundle ?? '') || !/^EL[0-9a-f]{32}$/.test(evaluation ?? '')) {
    console.error('  ✗ --noncompliant expects BU…/EL…');
    failed++;
  } else {
    const body = await getJson(`${TRUSTHUB}/CustomerProfiles/${bundle}/Evaluations/${evaluation}`, 'noncompliant evaluation');
    save('evaluation-customer-profile-noncompliant.json', body && scrub(body));
  }
}

if (failed) process.exit(1);
if (CHECK_ONLY && changed) process.exit(1);
console.log(changed ? `✓ ${changed} fixture(s) updated — review the diff.` : '✓ All A2P fixtures current.');
