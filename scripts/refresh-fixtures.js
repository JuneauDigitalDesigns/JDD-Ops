#!/usr/bin/env node
/**
 * scripts/refresh-fixtures.js — re-capture the vendor payloads that test/fixtures/ replays.
 *
 * Why fixtures are captured rather than written by hand: four of the seven bugs that prompted
 * this suite were wrong BELIEFS about vendor APIs. A hand-written fixture encodes the belief,
 * so the test certifies the bug — a mock returning `{hooks:[{url}]}` would have made the
 * `/scenarios/{id}/hooks` test pass forever while production 404s. Only a recorded response
 * can contradict us.
 *
 * The flip side is that captured fixtures go stale silently. That is what this script is for:
 * run it, and vendor drift shows up as a reviewable `git diff` instead of as a client whose
 * calls stopped being logged.
 *
 * Strictly read-only — GETs only. Never clones, patches, activates, or creates anything.
 *
 * Usage:
 *   npm run fixtures:refresh
 *   npm run fixtures:refresh -- --check    # exit 1 if anything changed; for CI/pre-commit
 *
 * Exit codes:
 *   0  fixtures written (or unchanged, with --check)
 *   1  a fixture changed under --check, or a fetch failed
 *   2  required config missing
 */

import dotenv from 'dotenv';
dotenv.config({ override: true });

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES = resolve(ROOT, 'test', 'fixtures');
const MAKE_ZONE = 'https://us2.make.com/api/v2';
const CHECK_ONLY = process.argv.includes('--check');

let failed = 0;
let changed = 0;

/**
 * Strip everything the checks don't read before a blueprint is committed.
 *
 * Make stores a sample of the last real webhook payload under each module's `metadata`, and
 * for the post-call master that sample is an ACTUAL customer call: a Twilio Call SID plus
 * Retell `recording_url` / `public_log_url` links on a public CDN. A call recording URL in a
 * committed fixture is a leak, not a test input.
 *
 * `patchPostCallBlueprint` and every predicate read only `module`, `mapper`, `filter` and
 * `routes`, so dropping `metadata` costs the tests nothing. The Twilio `to`/`from` numbers are
 * kept structurally but placeheld — the patcher overwrites both anyway, and they are a real
 * cell number and a real JDD line.
 */
function scrubBlueprint(payload) {
  const bp = payload?.response?.blueprint;
  if (!bp) return payload;

  const scrubModule = (mod) => {
    const { metadata: _drop, ...rest } = mod;
    const out = { ...rest };
    if ((out.module ?? '').startsWith('twilio') && out.mapper) {
      out.mapper = { ...out.mapper, to: '+15005550006', from: '+15005550009' };
    }
    if (Array.isArray(out.routes)) {
      out.routes = out.routes.map((r) => ({ ...r, flow: (r.flow ?? []).map(scrubModule) }));
    }
    return out;
  };

  // The blueprint ALSO carries a top-level `metadata.designer.samples` holding a complete
  // captured webhook payload from a real call — both phone numbers, the Twilio call SID, and
  // three CDN recording URLs. Scrubbing only per-module metadata left all of it in place, so
  // this drops the samples too. Verified afterwards by re-scanning the fixture.
  const { designer, ...restMeta } = bp.metadata ?? {};
  const { samples: _dropSamples, ...restDesigner } = designer ?? {};

  return {
    ...payload,
    response: {
      ...payload.response,
      blueprint: {
        ...bp,
        metadata: { ...restMeta, ...(designer ? { designer: restDesigner } : {}) },
        flow: (bp.flow ?? []).map(scrubModule),
      },
    },
  };
}

async function getJson(url, headers, label) {
  try {
    const res = await fetch(url, { headers });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      console.error(`  ✗ ${label}: HTTP ${res.status}`);
      failed++;
      return null;
    }
    return body;
  } catch (e) {
    console.error(`  ✗ ${label}: ${e?.message ?? e}`);
    failed++;
    return null;
  }
}

function save(relPath, data) {
  if (data == null) return;
  const full = resolve(FIXTURES, relPath);
  mkdirSync(dirname(full), { recursive: true });
  const next = JSON.stringify(data, null, 2) + '\n';
  const prev = existsSync(full) ? readFileSync(full, 'utf8') : null;
  if (prev === next) {
    console.log(`  = ${relPath} (unchanged)`);
    return;
  }
  changed++;
  if (CHECK_ONLY) {
    console.error(`  ! ${relPath} WOULD CHANGE — vendor payload drifted since it was captured`);
    return;
  }
  writeFileSync(full, next, 'utf8');
  console.log(`  ${prev ? '~' : '+'} ${relPath}`);
}

async function main() {
  const makeKey = process.env.MAKE_API_KEY;
  const masterScenario = process.env.MAKE_POST_CALL_MASTER_SCENARIO_ID;
  const airtableKey = process.env.AIRTABLE_API_KEY;

  const missing = [
    !makeKey && 'MAKE_API_KEY',
    !masterScenario && 'MAKE_POST_CALL_MASTER_SCENARIO_ID',
    !airtableKey && 'AIRTABLE_API_KEY',
  ].filter(Boolean);
  if (missing.length) {
    console.error(`✗ Missing required config: ${missing.join(', ')}`);
    console.error('  Fixtures can only be refreshed from a machine with master credentials.');
    process.exit(2);
  }

  const mk = { Authorization: `Token ${makeKey}` };
  const at = { Authorization: `Bearer ${airtableKey}` };

  console.log('Make:');
  const bp = await getJson(`${MAKE_ZONE}/scenarios/${masterScenario}/blueprint`, mk, 'master blueprint');
  save('make/master-blueprint.json', scrubBlueprint(bp));

  const scen = await getJson(`${MAKE_ZONE}/scenarios/${masterScenario}`, mk, 'master scenario');
  save('make/scenario.json', scen);

  const orgs = await getJson(`${MAKE_ZONE}/organizations`, mk, 'organizations');
  save('make/organizations.json', orgs);

  // The org → team → hooks walk that probeMakeScenario performs. Captured so the probe test
  // replays the real pagination/shape rather than an invented one.
  for (const org of orgs?.organizations ?? []) {
    const teams = await getJson(`${MAKE_ZONE}/teams?organizationId=${org.id}`, mk, `teams of org ${org.id}`);
    save('make/teams.json', teams);
    for (const team of teams?.teams ?? []) {
      const hooks = await getJson(`${MAKE_ZONE}/hooks?teamId=${team.id}`, mk, `hooks of team ${team.id}`);
      // Hook URLs are capability tokens — anyone holding one can post into the scenario. The
      // fixture keeps the shape and the scenario linkage, and redacts the secret path segment.
      //
      // The placeholder must stay UNIQUE PER HOOK. A first pass replaced every token with the
      // same string, which made the hooks indistinguishable: probeMakeScenario looks a hook up
      // by URL, so it matched the first entry instead of the linked one and the test failed
      // against its own fixture. The hook id is already non-secret (it appears in the API
      // path), so it makes a safe discriminator.
      const redacted = {
        ...hooks,
        hooks: (hooks?.hooks ?? []).map((h) => ({
          ...h,
          url: String(h.url ?? '').replace(/\/[A-Za-z0-9]{20,}$/, `/REDACTED_HOOK_TOKEN_${h.id}`),
          udid: h.udid ? `REDACTED_${h.id}` : h.udid,
        })),
      };
      save('make/hooks-list.json', redacted);
    }
  }

  console.log('Airtable:');
  // The master base is whatever the master blueprint's airtable module currently points at,
  // so this never hardcodes a base id that could drift out from under the fixture.
  const masterBaseId = (bp?.response?.blueprint?.flow ?? [])
    .find((m) => (m.module ?? '').startsWith('airtable'))?.mapper?.base;
  if (!masterBaseId) {
    console.error('  ✗ could not find the master base id in the blueprint');
    failed++;
  } else {
    const schema = await getJson(`https://api.airtable.com/v0/meta/bases/${masterBaseId}/tables`, at, `master base ${masterBaseId} schema`);
    // Only the Call Log table matters, and trimming keeps the fixture reviewable in a diff.
    const callLog = (schema?.tables ?? []).find((t) => t.name === 'Call Log');
    save('airtable/master-schema.json', callLog ? { baseId: masterBaseId, table: callLog } : null);
  }

  console.log('');
  if (failed) {
    console.error(`✗ ${failed} fetch(es) failed — fixtures may be incomplete.`);
    process.exit(1);
  }
  if (CHECK_ONLY && changed) {
    console.error(`✗ ${changed} fixture(s) drifted. Run \`npm run fixtures:refresh\` and review the diff.`);
    process.exit(1);
  }
  console.log(changed ? `✓ ${changed} fixture(s) updated — review the diff before committing.` : '✓ All fixtures current.');
  process.exit(0);
}

main().catch((e) => {
  console.error(`refresh-fixtures: unexpected error: ${e?.stack ?? e}`);
  process.exit(2);
});
