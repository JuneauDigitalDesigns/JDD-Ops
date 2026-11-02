/**
 * The owner's post-call brief must send from the JDD notification number, not the client's.
 *
 * This encodes the state onboard.js shipped in until 2026-11-02: `fromNum` was
 * `readEnvLocal(clientDir).TWILIO_NUMBER`, so every clone texted the owner FROM the client's
 * own provisioned number.
 *
 * It is worth being precise about what was wrong with that, because the handoff that raised
 * it described a break that does not exist. The brief delivers today: onboard.js adds every
 * client number to the master Messaging Service's pool, and pool membership is what registers
 * a number with the campaign. The account's own message history is the evidence — one number
 * went 30034 → delivered in mid-August when the campaign was approved, with
 * `messaging_service_sid` null on every single message before and after. Naming the service
 * in the API call is not what makes 10DLC traffic deliver.
 *
 * What was actually wrong is structural. A campaign binds to a Messaging Service and a number
 * sits in exactly one, so a client number used for owner alerts is stranded in JDD's service
 * and can never join that client's own CUSTOMER_CARE campaign later. And it breaks outright
 * the moment client numbers stop joining the master pool, which is the entire point of the
 * two-lane migration — making this a PREREQUISITE for that work rather than a fix for a
 * visible fault.
 *
 * Asserted against the RECORDED master blueprint and the real `patchPostCallBlueprint`, not a
 * hand-written shape: four of the seven original bugs lived in that function, and a
 * hand-written blueprint carries the field ids we assumed rather than the ones Make returns.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { patchPostCallBlueprint } from '../onboard.js';
import { checkAccountLaneSender, fieldMapFromSpec } from '../lib/onboard-checks.js';
import { CALL_LOG_FIELDS } from '../onboard.js';
import { masterBlueprint, masterFieldMap } from './helpers/fixtures.mjs';

/** The real numbers' shapes, not their values: a JDD sender and a client's provisioned line. */
const NOTIFICATION = '+16893292464';
const CLIENT_NUMBER = '+12075693204';
const OWNER_MOBILE = '+12073181838';

/** Patch a copy of the recorded master exactly as step 8c does, with a chosen sender. */
function patched({ fromNum, smsEnabled = true }) {
  const bp = masterBlueprint();
  patchPostCallBlueprint(bp, {
    baseId: 'appCLIENTbase0001',
    siteTag: null,
    fromNum,
    toNum: smsEnabled ? OWNER_MOBILE : '',
    smsEnabled,
    masterMap: masterFieldMap(),
    clientMap: fieldMapFromSpec(CALL_LOG_FIELDS, { tableId: 'tblCLIENT00000001' }),
    quiet: true,
  });
  return bp;
}

test('a clone sending from the notification number passes', () => {
  const bp = patched({ fromNum: NOTIFICATION });
  const res = checkAccountLaneSender({
    blueprint: bp,
    notificationNumber: NOTIFICATION,
    clientNumber: CLIENT_NUMBER,
    smsEnabled: true,
  });
  assert.equal(res.ok, true, res.detail);
});

test('THE REGRESSION: a clone sending from the client’s own number fails', () => {
  // What shipped. The patcher stamps `from` onto every clone, so this is what the old
  // `fromNum: readEnvLocal(clientDir).TWILIO_NUMBER` produced for every client.
  const bp = patched({ fromNum: CLIENT_NUMBER });
  const res = checkAccountLaneSender({
    blueprint: bp,
    notificationNumber: NOTIFICATION,
    clientNumber: CLIENT_NUMBER,
    smsEnabled: true,
  });
  assert.equal(res.ok, false, 'sending owner alerts from the client number must not pass');
  assert.match(res.detail, /client/i, 'and must say whose number it is');
  assert.match(res.detail, /Messaging Service|campaign/i, 'and why that matters');
});

test('the patcher really does overwrite the master’s own `from`', () => {
  // The reason the fix belongs in onboard.js and NOT in the master blueprint. §6 item 2 said
  // to patch the master so the notification number is "a constant in every clone" — it cannot
  // be, because this runs on every clone and stamps over whatever the master carried.
  const master = masterBlueprint();
  const twilioBefore = (master.flow ?? []).find((m) => String(m.module ?? '').startsWith('twilio'));
  assert.ok(twilioBefore, 'the recorded master should carry a Twilio module');
  const bp = patched({ fromNum: NOTIFICATION });
  const twilioAfter = (bp.flow ?? []).find((m) => String(m.module ?? '').startsWith('twilio'));
  assert.equal(twilioAfter.mapper.from, NOTIFICATION);
  assert.notEqual(
    twilioAfter.mapper.from,
    twilioBefore.mapper.from,
    'if these were equal the test would prove nothing about the overwrite',
  );
});

test('an unset notification number fails rather than reporting "could not check"', () => {
  // `null` is reserved for "we could not look". Here we looked: there is no sender, so the
  // clone would carry an empty `from`, error on every run, and get the scenario auto-disabled
  // — which takes the Airtable call log down with it. That is a finding, not an unknown.
  const bp = patched({ fromNum: '' });
  const res = checkAccountLaneSender({
    blueprint: bp,
    notificationNumber: '',
    clientNumber: CLIENT_NUMBER,
    smsEnabled: true,
  });
  assert.equal(res.ok, false);
  assert.match(res.detail, /TWILIO_NOTIFICATION_NUMBER/);
});

test('no SMS consent is a skip, because no Twilio module is cloned at all', () => {
  const bp = patched({ fromNum: NOTIFICATION, smsEnabled: false });
  const twilio = (bp.flow ?? []).find((m) => String(m.module ?? '').startsWith('twilio'));
  assert.equal(twilio, undefined, 'the patcher should have removed the module entirely');
  const res = checkAccountLaneSender({
    blueprint: bp,
    notificationNumber: NOTIFICATION,
    clientNumber: CLIENT_NUMBER,
    smsEnabled: false,
  });
  assert.equal(res.ok, null, 'nothing to judge, so neither a pass nor a failure');
});

test('a display-formatted sender still matches the configured one', () => {
  // The live master carried `to` as "(207) 318-1838" rather than E.164, so a sender arriving
  // in display form is not hypothetical here. samePhone normalizes both sides; a digits-only
  // comparison would have called these different and failed a correct clone.
  const bp = patched({ fromNum: '(689) 329-2464' });
  const res = checkAccountLaneSender({
    blueprint: bp,
    notificationNumber: NOTIFICATION,
    clientNumber: CLIENT_NUMBER,
    smsEnabled: true,
  });
  assert.equal(res.ok, true, res.detail);
});

// ─── and that onboard.js actually PASSES it ───────────────────────────────────
//
// Everything above exercises the predicate with a `fromNum` the test chose, so all of it would
// still pass if onboard.js went back to handing over the client's number. The predicate is
// guarded; the wiring was not. That is the same shape as a regression test that cannot fail.
//
// The dry run is the real defence — it runs this predicate against the actual client, so a
// reverted onboard.js shows up as a FAIL line to the operator. But that needs someone to run
// it. These two read the source, the way test/ring-window.test.mjs asserts the docs, so a
// revert is caught in CI with no credentials and no vendor calls.

test('both patchPostCallBlueprint call sites pass the notification number', () => {
  const src = readFileSync(new URL('../onboard.js', import.meta.url), 'utf8');
  const senders = [...src.matchAll(/fromNum\s*[:=]\s*([^,\n]+)/g)].map((m) => m[1].trim());
  assert.ok(senders.length >= 2, `expected both call sites, found ${senders.length}`);
  for (const expr of senders) {
    assert.match(
      expr,
      /TWILIO_NOTIFICATION_NUMBER/,
      `a patchPostCallBlueprint call site resolves fromNum as "${expr}" — the owner brief must send from the Account-lane number`,
    );
  }
});

test('no call site resolves fromNum from the client’s TWILIO_NUMBER', () => {
  // Stated as its own assertion rather than inferred from the one above, because the failure
  // being prevented is specifically the old expression coming back:
  //   fromNum: readEnvLocal(clientDir).TWILIO_NUMBER
  const src = readFileSync(new URL('../onboard.js', import.meta.url), 'utf8');
  assert.doesNotMatch(
    src,
    /fromNum\s*[:=][^,\n]*\bTWILIO_NUMBER\b/,
    'fromNum must not be derived from the client’s own provisioned number',
  );
});
