/**
 * The published phone number.
 *
 * The bug: `writeClientSchema` ran before `provisionTwilioNumber`, and nothing ever rewrote
 * the schema afterwards. So every deployed site advertised the owner's own line, and the
 * entire two-hop stack — human-first forward, Retell fallback on no-answer, Airtable call log
 * — sat behind a number that appeared nowhere public. The receptionist worked perfectly and
 * was simply never reached. No error, anywhere.
 *
 * Two numbers with two jobs, and conflating them is the failure mode:
 *   brand.phone / phoneHref  → what the site shows  → the Twilio number
 *   CLIENT_FORWARD_PHONE     → where /api/voice goes → the owner's real line
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { formatPhoneForDisplay, resolvePublishedPhone } from '../onboard.js';
import { checkSitePublishesTwilioNumber, checkForwardPreserved } from '../lib/onboard-checks.js';

test('US numbers render in the punctuation the rest of the schema uses', () => {
  for (const raw of ['+14075551212', '4075551212', '(407) 555-1212', '14075551212']) {
    const p = resolvePublishedPhone(raw);
    assert.equal(p.display, '(407) 555-1212', `from ${raw}`);
    assert.equal(p.e164, '+14075551212');
    assert.equal(p.href, 'tel:+14075551212');
  }
});

test('a non-US number falls back to E.164 rather than being mangled', () => {
  // JDD buys US local numbers only, so this is a guard against silently reformatting
  // something that isn't a NANP number into a shape that no longer dials.
  assert.equal(formatPhoneForDisplay('+442071838750'), '+442071838750');
});

test('an undialable number resolves to null instead of a best guess', () => {
  // A number that is nearly right is not useful — it is a call that fails.
  for (const raw of ['<dry-run-number>', '', null, undefined, '555']) {
    assert.equal(resolvePublishedPhone(raw), null, `${JSON.stringify(raw)} must not resolve`);
  }
});

test('the site publishes the Twilio number, compared across formats', () => {
  const published = resolvePublishedPhone('+14075551212');
  const c = checkSitePublishesTwilioNumber({ published, twilioNumber: '(407) 555-1212', webOnly: false });
  assert.equal(c.ok, true, c.detail);
});

test('publishing a DIFFERENT number than the one provisioned is caught', () => {
  // This is the shipped bug, expressed as an assertion: the site kept the owner's number
  // while the stack hung off the Twilio number.
  const published = resolvePublishedPhone('+12073181838'); // owner's line
  const c = checkSitePublishesTwilioNumber({ published, twilioNumber: '+14075551212', webOnly: false });
  assert.equal(c.ok, false);
  assert.match(c.detail, /would publish/);
});

test('an undialable number is a failure, with the consequence spelled out', () => {
  const c = checkSitePublishesTwilioNumber({ published: null, twilioNumber: 'garbage', webOnly: false });
  assert.equal(c.ok, false);
  assert.match(c.detail, /bypass \/api\/voice/);
});

test('a mismatched phoneHref is caught even when the display is right', () => {
  const c = checkSitePublishesTwilioNumber({
    published: { e164: '+14075551212', display: '(407) 555-1212', href: 'tel:+12073181838' },
    twilioNumber: '+14075551212',
    webOnly: false,
  });
  assert.equal(c.ok, false, 'a tappable link to the wrong number still bypasses the stack');
});

test('a web-only client has nothing to publish and is skipped, not failed', () => {
  const c = checkSitePublishesTwilioNumber({ published: null, twilioNumber: null, webOnly: true });
  assert.equal(c.ok, null);
});

test('the forward target survives the publish swap', () => {
  const c = checkForwardPreserved({
    lines: ['CLIENT_FORWARD_PHONE=(207) 318-1838'],
    previousPhone: '+12073181838',
    webOnly: false,
  });
  assert.equal(c.ok, true, 'same line, different formatting, is not drift');
});

test('a clobbered forward target is caught', () => {
  // What an ordering regression looks like: the env captured the number AFTER the swap, so
  // CLIENT_FORWARD_PHONE became the Twilio number and /api/voice forwards to itself.
  const c = checkForwardPreserved({
    lines: ['CLIENT_FORWARD_PHONE=+14075551212'],
    previousPhone: '+12073181838',
    webOnly: false,
  });
  assert.equal(c.ok, false);
});
