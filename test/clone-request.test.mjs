/**
 * The Make clone request contract.
 *
 * A live provisioning run died here:
 *
 *   [step 11] FAIL: Make clone returned 400: {"message":"Bad Request","code":"SC400",
 *     "suberrors":[{"message":"Expected required property"},{"message":"Expected integer"}]}
 *
 * `POST /scenarios/{scenarioId}/clone` requires `teamId` (integer) and `states` (boolean) in the
 * body and `organizationId` (integer) in the query string. We were sending only `name`. Two
 * missing required properties plus a missing integer is exactly that pair of suberrors.
 *
 * These assertions read the source rather than executing the call, because cloning is a write
 * and there is no way to exercise it without creating a real scenario. That is a real limit:
 * this pins the request SHAPE against Make's documented contract, and the live run is still the
 * proof. It would, however, have caught the actual bug — every one of these was absent.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(resolve(ROOT, 'onboard.js'), 'utf8');

/**
 * The body of cloneAndWirePostCall, with dry-run log lines removed.
 *
 * The strip is not cosmetic. The dry-run preview prints the request it is about to make —
 * `POST /scenarios/…/clone?organizationId=… body { teamId: …, states: false }` — so assertions
 * run against the whole function matched that STRING and passed even with the real request
 * reverted to its broken form. A test that matches prose describing the code rather than the
 * code is a test that cannot fail. Verified by reverting the fix and watching these go red.
 */
function cloneFn() {
  const start = SRC.indexOf('async function cloneAndWirePostCall(');
  assert.notEqual(start, -1, 'cloneAndWirePostCall must exist');
  const end = SRC.indexOf('\n}', SRC.indexOf('// 1) Clone the master scenario', start));
  return SRC.slice(start, end)
    .split('\n')
    // Drop comments AND dry-run log lines. Both describe the request in prose that looks
    // exactly like the request: the comment above the clone call writes out
    // `POST /scenarios/{id}/clone`, and the dry-run preview prints the full body. Matching
    // either means asserting that the code is well documented, not that it is correct — which
    // is how three assertions here passed against a provably broken call.
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*') && !/\bdryLog\(/.test(l);
    })
    .join('\n');
}

/** Just the `fetch(...)` that performs the clone, so nothing else can satisfy these. */
function cloneRequest() {
  const src = cloneFn();
  const at = src.indexOf('/clone');
  assert.notEqual(at, -1, 'the clone request must exist');
  const open = src.lastIndexOf('await fetch(', at);
  const close = src.indexOf('});', at);
  assert.ok(open !== -1 && close > open, 'could not isolate the clone fetch call');
  return src.slice(open, close + 3);
}

test('organizationId is sent in the query string', () => {
  assert.match(
    cloneRequest(),
    /\/clone\?organizationId=\$\{organizationId\}/,
    'the clone endpoint requires organizationId as a query parameter',
  );
});

test('teamId and states are sent in the body', () => {
  const req = cloneRequest();
  assert.match(req, /\bteamId,/, 'teamId is a required body property');
  assert.match(req, /\bstates:\s*false\b/, 'states is required, and false resets module state');
});

test('states is false — a client clone must not inherit the master run state', () => {
  // "true copies module state; false resets it". A fresh client starting with the master's
  // accumulated state would be inheriting another scenario's history.
  assert.ok(!/states:\s*true/.test(cloneRequest()));
});

test('teamId and organizationId are required to be NUMBERS before the request is made', () => {
  // The 400 said "Expected integer" specifically, so a stringified id fails the same way as a
  // missing one. The guard must reject non-numbers rather than send them.
  const src = cloneFn();
  assert.match(src, /typeof teamId !== 'number' \|\| typeof organizationId !== 'number'/);
  assert.match(src, /fail\(8,/, 'an unresolvable id must stop the run, not attempt a known-400 call');
});

test('the clone name is capped at the documented 120 characters', () => {
  assert.match(cloneRequest(), /\.slice\(0, 120\)/, 'Make caps the clone name at 120 chars');
});

test('the clone remaps the trigger hook to a new one', () => {
  // Second live 400, after the first was fixed:
  //   {"detail":"The hook already has a scenario assigned.","code":"IM000"}
  // A webhook-triggered scenario cannot be duplicated without a `hook` mapping — Make tries to
  // attach the clone to the MASTER's hook, which already belongs to the master. This also
  // settles an earlier open question: a clone does NOT get a fresh hook automatically.
  assert.match(
    cloneRequest(),
    /hook:\s*\{\s*\[String\(masterHookId\)\]:\s*cloneHookId\s*\}/,
    'the clone must substitute the master hook with this client\'s own',
  );
});

test('the client hook is created with the master hook\'s payload settings', () => {
  // method/headers/stringify decide the SHAPE of the payload the modules receive, and every
  // mapping in the blueprint reads {{1.call.…}} off the parsed JSON body. Master hook 2421720
  // has all three false; a clone hook that differs would silently break the field mapping.
  const src = cloneFn();
  const at = src.indexOf("typeName: 'gateway-webhook'");
  assert.notEqual(at, -1, 'the client hook must be a gateway-webhook');
  const req = src.slice(src.lastIndexOf('await fetch(', at), src.indexOf('});', at) + 3);
  assert.match(req, /method:\s*false/);
  assert.match(req, /headers:\s*false/);
  assert.match(req, /stringify:\s*false/);
  assert.match(req, /teamId:\s*String\(teamId\)/, 'POST /hooks documents teamId as a string');
});

test('the client hook id is recorded before the clone is attempted', () => {
  // Creating a hook and then failing the clone would orphan it, and the next run would make
  // another — the same trap the clone id itself had.
  const src = cloneFn();
  const recorded = src.indexOf("patchEnvLocal(clientDir, 'MAKE_POST_CALL_HOOK_ID'");
  const cloned = src.indexOf('/clone?organizationId=');
  assert.ok(recorded !== -1, 'the hook id must be persisted');
  assert.ok(recorded < cloned, 'it must be persisted BEFORE the clone call');
});

test('an existing client hook is reused rather than recreated', () => {
  assert.match(cloneFn(), /readEnvLocal\(clientDir\)\.MAKE_POST_CALL_HOOK_ID/);
});

test('the ids come from resolveMasterResources, not from new env vars', () => {
  // Taking them from the master's own hook record means there is no second place for them to
  // drift, and no new configuration for an operator to get wrong.
  const src = cloneFn();
  assert.match(src, /await resolveMasterResources\(\)/);
  assert.match(src, /master\?\.teamId/);
  assert.match(src, /master\?\.organizationId/);
  assert.ok(
    !/process\.env\.MAKE_TEAM_ID|process\.env\.MAKE_ORG/.test(SRC),
    'no new env var should have been introduced for these',
  );
});

test('resolveMasterResources surfaces teamId and organizationId as numbers', () => {
  const start = SRC.indexOf('async function resolveMasterResources(');
  const src = SRC.slice(start, SRC.indexOf('\n}', start));
  assert.match(src, /typeof hook\.teamId === 'number'/);
  assert.match(src, /typeof hook\.organizationId === 'number'/);
  assert.match(src, /MASTER_RESOURCES = \{[^}]*teamId, organizationId \}/);
});
