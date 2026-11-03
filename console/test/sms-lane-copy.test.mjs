/**
 * The runbook's SMS and lead-delivery copy, pinned to the code it describes.
 *
 * Two pieces of console copy outlived the behaviour they described, and both were instructions
 * an operator would follow:
 *
 *   1. After onboard.js moved the owner's post-call brief onto the JDD notification number
 *      (30acaf3), the Make replica still said "From = this client's TWILIO_NUMBER", and the
 *      per-client step told the operator to set it. Following it re-strands the client's number
 *      in JDD's Messaging Service — the exact thing that commit exists to stop.
 *   2. After Resend lead delivery was removed, the web-only checkpoint still told the operator
 *      to wait for a lead email, and Part A still asked for RESEND_API_KEY "for Starter lead
 *      emails". An operator waiting for an email that can never arrive concludes the form is
 *      broken.
 *
 * Same lesson as ring-window.test.mjs: prose that steers an operator is part of the behaviour,
 * so it is asserted against the code rather than trusted to stay in step.
 *
 * make-modules.ts is imported and run for real (it imports only types). runbook-content.ts is
 * read as source text: it imports envFields.ts, whose runtime `@jdd/schema` import resolves
 * through a CJS codepath that fails under the plain node runner (ERR_PACKAGE_PATH_NOT_EXPORTED)
 * — the constraint d5-degradation and catalog-invariants already work around the same way.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { makeModulesForSite } from '../src/lib/make-modules.ts';

const CONSOLE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OPS_ROOT = resolve(CONSOLE_ROOT, '..');
const read = (root, rel) => readFileSync(resolve(root, rel), 'utf8');

const onboardSrc = read(OPS_ROOT, 'onboard.js');
const runbookSrc = read(CONSOLE_ROOT, 'src/lib/runbook-content.ts');

function site(env = {}) {
  return {
    slug: 'fixture',
    brandName: 'Fixture Co',
    brandShort: 'fc',
    canonical: null,
    repoBuilt: true,
    env: { TWILIO_NUMBER: '+14075551212', CLIENT_FORWARD_PHONE: '+14075550000', ...env },
    missingFields: [],
    accent: '#000',
    brandPhone: '(407) 555-1212',
    numberPublished: true,
  };
}

const growth = {
  slug: 'fixture',
  plan: 'growth',
  brandName: 'Fixture Co',
  isEnterprise: false,
  repoBuilt: true,
  detectedStatus: 'live',
  schemaPath: 'clients/fixture/site.ts',
  hasIntake: true,
  isWebOnly: false,
  receptionistMode: 'forwarded',
  receptionistModeVerified: true,
  sites: [site()],
};

const twilioModule = () => makeModulesForSite(growth, growth.sites[0]).find((m) => m.app === 'twilio');

/** The env key onboard.js reads for the sender it stamps onto every clone's Twilio module. */
function onboardSenderKey() {
  const keys = [...onboardSrc.matchAll(/fromNum\s*(?::|=)\s*\(process\.env\.([A-Z_]+)/g)].map((m) => m[1]);
  assert.ok(keys.length >= 2, 'expected both patchPostCallBlueprint call sites to resolve fromNum from process.env');
  const unique = new Set(keys);
  assert.equal(unique.size, 1, `onboard.js call sites disagree on the sender: ${[...unique].join(', ')}`);
  return keys[0];
}

test('the Make replica’s From names the same env key onboard.js stamps on the clone', () => {
  const from = twilioModule().fields.find((f) => f.label === 'Phone number');
  assert.equal(from.select.value, onboardSenderKey());
  assert.notEqual(from.select.value, growth.sites[0].env.TWILIO_NUMBER);
});

test('the Make replica does not offer the forwarding line as the SMS destination', () => {
  // `to` is the owner's SMS-consent number. The forwarding line is not a number we have
  // permission to text, and a copy button holding it invites pasting it into the clone.
  assert.doesNotMatch(JSON.stringify(twilioModule().fields), /\+14075550000/);
});

test('no runbook step tells the operator to set the clone’s From to the client’s number', () => {
  assert.doesNotMatch(runbookSrc, /From to this client’s number/);
  assert.doesNotMatch(runbookSrc, /From = client TWILIO_NUMBER/);
});

test('no runbook copy describes a lead email — leads go to the portal on every tier', () => {
  // The premise, checked against the code that writes it: every tier is written `portal`.
  assert.match(read(OPS_ROOT, 'lib/client-env.js'), /LEAD_DELIVERY_MODE=portal/);
  assert.doesNotMatch(read(OPS_ROOT, 'lib/client-env.js'), /LEAD_DELIVERY_MODE=(email|callback)/);

  assert.doesNotMatch(runbookSrc, /lead email lands|Starter lead email/i);
  assert.doesNotMatch(runbookSrc, /LEAD_DELIVERY_MODE=(email|callback)/);
  assert.doesNotMatch(runbookSrc, /\(Resend\)/);
});

test('the notification-number card reads the configured value and reports pending without it', () => {
  const step = runbookSrc.slice(runbookSrc.indexOf("id: 'a-twilio-notification-number'"));
  assert.ok(step.length < runbookSrc.length, 'the notification-number step is missing from Part A');
  const card = step.slice(step.indexOf("t: 'context'"), step.indexOf("t: 'substeps'"));
  assert.match(card, /value: config\.twilioNotificationNumber,/);
  assert.match(card, /pending: !config\.twilioNotificationNumber,/);
  // And the field is actually read from .env, or the card is pending forever.
  assert.match(read(CONSOLE_ROOT, 'src/lib/opsConfig.ts'), /twilioNotificationNumber: ops\.TWILIO_NOTIFICATION_NUMBER/);
});
