/**
 * A2P Phase 0 readiness must not report a red that isn't real.
 *
 * The bug this encodes shipped and was live: `checkA2pReadiness` found the chain's two policies
 * by SCANNING `GET /trusthub/v1/Policies` for friendly names containing "secondary"/"customer
 * profile" and "a2p"/"messaging". On the live JDD account that listing returns 49 policies and
 * every one of them is an Alphanumeric Sender ID policy — the two we need are simply not in it,
 * and there is no second page. So the scan found nothing, the check went red, and because
 * `PLAN-console-a2p-registration.md` Phase 1 disables every per-client vendor write while
 * readiness is not `true`, that red would have blocked all per-client registration.
 *
 * Both policies fetch fine by SID. `test/fixtures/trusthub/` holds the recorded proof of both
 * halves: a listing that does not contain them, and each policy resolving on its own.
 *
 * Why this is worth a test rather than just a fix: a false red is worse than a missing check.
 * A check that is red for a reason unrelated to what it measures teaches the operator to click
 * past the panel — and then past the next one, which might be true.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkA2pReadiness, resolvePolicies, KNOWN_POLICIES } from '../lib/a2p-readiness.js';

const FIXTURES = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'trusthub');
const read = (name) => JSON.parse(readFileSync(resolve(FIXTURES, name), 'utf8'));

const POLICY_LIST = read('policies-list.json');
const POLICY_BY_SID = new Map(
  KNOWN_POLICIES.map((known) => [known.sid, read(`policy-${known.key}.json`)]),
);

const AUTH = { accountSid: 'AC' + '0'.repeat(32), authToken: 'x'.repeat(32) };
const ENV = {
  TWILIO_ACCOUNT_SID: AUTH.accountSid,
  TWILIO_AUTH_TOKEN: AUTH.authToken,
  TWILIO_PRIMARY_PROFILE_SID: 'BU' + '0'.repeat(32),
  TWILIO_MESSAGING_SERVICE_SID: 'MG' + '0'.repeat(32),
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/**
 * Replay the recorded account for anything policy-related; refuse everything else.
 *
 * The non-policy endpoints answer 500 on purpose. The profile checks then degrade to `null`
 * ("could not check"), which is exactly the tri-state contract, and it means this file never
 * hand-writes a vendor payload shape — the only responses it serves are recorded ones.
 *
 * @param {{ listing?: unknown, direct?: (sid: string) => Response | null }} [override]
 */
function recordedAccount(override = {}) {
  return async (url) => {
    const u = String(url);
    const bySid = /\/Policies\/(RN[0-9a-f]+)/.exec(u);
    if (bySid) {
      if (override.direct) {
        const custom = override.direct(bySid[1]);
        if (custom) return custom;
      }
      const policy = POLICY_BY_SID.get(bySid[1]);
      return policy ? json(policy) : json({ message: 'Not Found' }, 404);
    }
    if (u.includes('/Policies')) return json(override.listing ?? POLICY_LIST);
    return json({ message: 'not part of this test' }, 500);
  };
}

test('the recorded listing really does NOT contain the chain policies', () => {
  // The premise the bug rested on, asserted against the recording rather than remembered. If
  // Twilio ever starts listing these, this fails and tells us the premise changed — which is a
  // better outcome than resolvePolicies' fallback quietly becoming the only path that works.
  const names = (POLICY_LIST.results ?? []).map((p) => String(p.friendly_name).toLowerCase());
  assert.ok(names.length > 0, 'the fixture should hold a real listing');
  for (const known of KNOWN_POLICIES) {
    const found = names.some((name) => known.expect.every((fragment) => name.includes(fragment)));
    assert.equal(found, false, `"${known.label}" was not expected in the listing, but matched a name`);
  }
  assert.equal(POLICY_LIST.meta?.next_page_url ?? null, null, 'and there should be no second page');
});

test('every KNOWN_POLICIES entry has a recorded fixture', () => {
  // Keeps scripts/refresh-fixtures.js and the module in step: add a third policy to the module
  // without re-recording, and this says so instead of the next test skipping over it.
  for (const known of KNOWN_POLICIES) {
    const policy = POLICY_BY_SID.get(known.sid);
    assert.ok(policy, `no recorded fixture for ${known.label}`);
    assert.equal(policy.sid, known.sid, 'the recorded SID must be the one the module asks for');
    const name = String(policy.friendly_name).toLowerCase();
    for (const fragment of known.expect) {
      assert.ok(name.includes(fragment), `recorded name "${policy.friendly_name}" lacks "${fragment}"`);
    }
  }
});

test('both chain policies resolve against the recorded account', async () => {
  const res = await resolvePolicies({ auth: AUTH, fetchImpl: recordedAccount() });
  assert.equal(res.reachable, true);
  assert.deepEqual(res.unresolved, [], 'nothing should be unresolved');
  assert.deepEqual(res.byName, [], 'both should come from their recorded SID, not the listing');
  assert.equal(res.policies.secondaryCustomerProfilePolicySid, 'RNdfbf3fae0e1107f8aded0e7cead80bf5');
  assert.equal(res.policies.a2pMessagingPolicySid, 'RNb0d4771c2c98518d916a3d4cd70a8f8b');
});

test('the readiness report shows the policies check GREEN on the recorded account', async () => {
  // THE REGRESSION. Scanning the listing made this check `false`, which blocks every per-client
  // vendor write server-side. Revert resolvePolicies to a name scan and this goes red.
  const report = await checkA2pReadiness({ env: ENV, fetchImpl: recordedAccount() });
  const check = report.checks.find((c) => c.id === 'policies');
  assert.ok(check, 'there must be a policies check');
  assert.equal(check.ok, true, `policies check should pass, got ${check.ok}: ${check.detail}`);
  assert.equal(report.policies.secondaryCustomerProfilePolicySid, 'RNdfbf3fae0e1107f8aded0e7cead80bf5');
  assert.equal(report.policies.a2pMessagingPolicySid, 'RNb0d4771c2c98518d916a3d4cd70a8f8b');
});

test('a stale recorded SID falls back to the listing, and says that it did', async () => {
  // The reason the old code existed at all: a hardcoded SID could be re-issued under us. The
  // fix keeps that covered — but it has to REPORT the fallback, or a stale SID stays stale
  // forever behind a green tick.
  const reissued = 'RNaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const listing = {
    meta: { next_page_url: null },
    results: [
      ...(POLICY_LIST.results ?? []),
      { sid: reissued, friendly_name: 'Secondary Customer Profile of type Business' },
    ],
  };
  const res = await resolvePolicies({
    auth: AUTH,
    fetchImpl: recordedAccount({
      listing,
      direct: (sid) =>
        sid === 'RNdfbf3fae0e1107f8aded0e7cead80bf5' ? json({ message: 'Not Found' }, 404) : null,
    }),
  });
  assert.equal(res.policies.secondaryCustomerProfilePolicySid, reissued, 'should use the listed SID');
  assert.deepEqual(res.byName, ['secondaryCustomerProfilePolicySid'], 'and must report the fallback');
  assert.deepEqual(res.unresolved, []);
});

test('a SID that resolves to the WRONG policy is not trusted', async () => {
  // Fetching is not verifying. If the recorded SID now names some other policy, filing against
  // it produces a rejection days later having burned a registration attempt — so an unexpected
  // name must fail the check, not satisfy it.
  const res = await resolvePolicies({
    auth: AUTH,
    fetchImpl: recordedAccount({
      direct: (sid) =>
        sid === 'RNb0d4771c2c98518d916a3d4cd70a8f8b'
          ? json({ sid, friendly_name: 'Alphanumeric Sender ID - Spain' })
          : null,
    }),
  });
  assert.equal(res.policies.a2pMessagingPolicySid, undefined, 'must not accept the wrong policy');
  assert.deepEqual(res.unresolved, ['A2P Messaging: Local - Business']);
});

test('an unreachable Policies API is null, never a pass', async () => {
  // CLAUDE.md's tri-state: `null` means the check did not run and is never collapsed into a
  // pass. A credentials or network failure must not read as "registration is unblocked".
  const res = await resolvePolicies({
    auth: AUTH,
    fetchImpl: async () => {
      throw new Error('getaddrinfo ENOTFOUND trusthub.twilio.com');
    },
  });
  assert.equal(res.reachable, false);

  const report = await checkA2pReadiness({
    env: ENV,
    fetchImpl: async () => {
      throw new Error('getaddrinfo ENOTFOUND trusthub.twilio.com');
    },
  });
  const check = report.checks.find((c) => c.id === 'policies');
  assert.equal(check?.ok, null, 'unreachable must be null, not false and certainly not true');
  assert.notEqual(report.ok, true, 'and the overall report must not be READY');
});
