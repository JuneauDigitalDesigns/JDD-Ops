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

if (failed) process.exit(1);
if (CHECK_ONLY && changed) process.exit(1);
console.log(changed ? `✓ ${changed} fixture(s) updated — review the diff.` : '✓ All A2P fixtures current.');
