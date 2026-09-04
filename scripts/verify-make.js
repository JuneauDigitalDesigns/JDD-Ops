#!/usr/bin/env node
/**
 * scripts/verify-make.js — read-only check that onboard.js can reach the Make.com
 * account it will clone the post-call master scenario from.
 *
 * Background: step 8c of onboard.js (`cloneAndWirePostCall`) authenticates to Make
 * with `MAKE_API_KEY` (sent as `Authorization: Token …`) and clones the scenario
 * named by `MAKE_POST_CALL_MASTER_SCENARIO_ID`. All requests target a HARDCODED
 * zone, https://us2.make.com/api/v2 (onboard.js and console/src/lib/reconcile.ts).
 * If the key is missing or the zone is wrong, step 8c silently skips and no client
 * ever gets a post-call scenario. This script proves the connection before a run.
 *
 * Strictly read-only — GET only. Never clones, patches, or activates anything.
 *
 * Usage:
 *   npm run verify-make
 *   npm run verify-make -- --json     # machine-readable
 *
 * Exit codes:
 *   0  token reaches the account AND the master scenario is visible
 *   1  a check failed (bad/missing key, wrong zone, scenario not found)
 *   2  required config missing (can't even attempt the checks)
 */

import dotenv from 'dotenv';
// override:true so a stale value injected by a parent shell can't win over .env,
// matching how onboard.js loads config.
dotenv.config({ override: true });

const json = process.argv.includes('--json');

// The zone onboard.js / reconcile.ts hardcode. We try it first, then fall back so a
// token that's valid in a DIFFERENT zone reads as a zone mismatch, not an auth failure.
const CODE_ZONE_HOST = 'us2.make.com';
const ZONE_HOSTS = [CODE_ZONE_HOST, 'eu1.make.com', 'eu2.make.com', 'us1.make.com'];
const zoneUrl = (host) => `https://${host}/api/v2`;

const out = (msg) => { if (!json) console.log(msg); };
const err = (msg) => { if (!json) console.error(msg); };

async function getJson(url, headers) {
  try {
    const res = await fetch(url, { headers });
    let body = null;
    try { body = await res.json(); } catch { /* non-JSON body */ }
    return { ok: res.ok, status: res.status, body };
  } catch (e) {
    return { ok: false, status: 0, body: null, error: String(e?.message ?? e) };
  }
}

async function main() {
  const apiKey = process.env.MAKE_API_KEY;
  const masterId = process.env.MAKE_POST_CALL_MASTER_SCENARIO_ID;

  const result = {
    ok: false,
    zone: null,
    zoneMatchesCode: null,
    account: null,
    scenario: null,
    problems: [],
  };

  if (!apiKey || !masterId) {
    const missing = [
      !apiKey && 'MAKE_API_KEY',
      !masterId && 'MAKE_POST_CALL_MASTER_SCENARIO_ID',
    ].filter(Boolean).join(', ');
    result.problems.push(`Missing required config: ${missing}`);
    if (json) console.log(JSON.stringify(result, null, 2));
    else {
      err(`✗ ${missing} not set in .env`);
      err(`  Get a token from Make: Profile → API → Add token (scopes: scenarios:read, user:read).`);
      err(`  Then add MAKE_API_KEY=<token> to .env and re-run.`);
    }
    process.exit(2);
  }

  const headers = { Authorization: `Token ${apiKey}` };

  // 1) Confirm the token and discover which zone it's valid in.
  out(`Checking token against ${ZONE_HOSTS.length} zone(s)…`);
  let workingHost = null;
  let me = null;
  let lastStatus = null;
  for (const host of ZONE_HOSTS) {
    const r = await getJson(`${zoneUrl(host)}/users/me`, headers);
    lastStatus = r.status;
    if (r.ok && r.body) {
      workingHost = host;
      me = r.body?.authUser ?? r.body?.users ?? r.body;
      break;
    }
  }

  if (!workingHost) {
    result.problems.push(
      `Token rejected on every zone tried (${ZONE_HOSTS.join(', ')}). Last HTTP ${lastStatus}.`,
    );
    if (json) console.log(JSON.stringify(result, null, 2));
    else {
      err(`✗ Token not accepted on any known zone (last status ${lastStatus}).`);
      err(`  Check the token value, or that it hasn't been revoked.`);
    }
    process.exit(1);
  }

  result.zone = zoneUrl(workingHost);
  result.zoneMatchesCode = workingHost === CODE_ZONE_HOST;
  result.account = {
    email: me?.email ?? null,
    name: me?.name ?? null,
    id: me?.id ?? null,
  };
  out(`✓ Token valid on zone ${workingHost}`);
  out(`  Account: ${result.account.name ?? '(unknown)'}${result.account.email ? ` <${result.account.email}>` : ''}`);

  // 2) Confirm the master scenario is visible on that zone (ID lookup — no team param).
  const s = await getJson(`${zoneUrl(workingHost)}/scenarios/${masterId}`, headers);
  if (!s.ok || !s.body?.scenario) {
    result.problems.push(
      `Master scenario ${masterId} not found on ${workingHost} (HTTP ${s.status}).`,
    );
    if (json) console.log(JSON.stringify(result, null, 2));
    else {
      err(`✗ Master scenario ${masterId} not visible on ${workingHost} (HTTP ${s.status}).`);
      err(`  Confirm MAKE_POST_CALL_MASTER_SCENARIO_ID and that the token's team can see it.`);
    }
    process.exit(1);
  }
  const scen = s.body.scenario;
  result.scenario = {
    id: scen.id ?? masterId,
    name: scen.name ?? null,
    isActive: scen.isActive ?? null,
  };
  out(`✓ Master scenario visible: "${scen.name ?? '(unnamed)'}" (id ${scen.id ?? masterId}, active=${scen.isActive ?? 'unknown'})`);

  // 3) Zone-mismatch warning: the code hardcodes us2, so a token elsewhere won't work at run time.
  if (!result.zoneMatchesCode) {
    result.problems.push(
      `Zone mismatch: token lives on ${workingHost} but onboard.js:1122 and ` +
        `console/src/lib/reconcile.ts:745 hardcode ${CODE_ZONE_HOST}. Update those before provisioning.`,
    );
    err(`⚠ ZONE MISMATCH: your token is on ${workingHost}, but the code hardcodes ${CODE_ZONE_HOST}.`);
    err(`  onboard.js:1122 and console/src/lib/reconcile.ts:745 must point at ${workingHost} first.`);
    if (json) console.log(JSON.stringify(result, null, 2));
    process.exit(1);
  }

  result.ok = true;
  if (json) console.log(JSON.stringify(result, null, 2));
  else out(`\n✓ Make access verified. onboard.js step 8c can clone scenario ${masterId}.`);
  process.exit(0);
}

main().catch((e) => {
  if (json) console.log(JSON.stringify({ ok: false, problems: [String(e?.message ?? e)] }, null, 2));
  else console.error(`verify-make: unexpected error: ${e?.stack ?? e}`);
  process.exit(2);
});
