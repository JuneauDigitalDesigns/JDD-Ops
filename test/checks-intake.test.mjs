/**
 * Intake validation — the refusals that stop a run from spending money on a guess.
 *
 * These are the guards whose whole value is that they REFUSE. `receptionistMode` is the
 * sharpest: assuming a receptionist buys a Twilio number and stands up a Retell agent for a
 * client who declined one, and assuming "declined" delivers a bare website to a client who
 * paid for a receptionist. Either way the mistake is billable and silent.
 *
 * Testable at all only because `fail()` now throws an OnboardError instead of calling
 * process.exit(1) — which would have taken this whole runner down with it.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { validateIntake, validateSite, OnboardError } from '../onboard.js';
import { makeIntake } from './helpers/fixtures.mjs';

/** Run validateIntake with its console noise muted, returning the thrown error or null. */
function refusalOf(intake) {
  const { log, warn, error } = console;
  console.log = console.warn = console.error = () => {};
  try {
    validateIntake(intake);
    return null;
  } catch (err) {
    return err;
  } finally {
    Object.assign(console, { log, warn, error });
  }
}

test('a well-formed intake is accepted', () => {
  assert.equal(refusalOf(makeIntake({ plan: 'growth' })), null);
  assert.equal(refusalOf(makeIntake({ plan: 'starter', receptionistMode: 'declined' })), null);
  assert.equal(refusalOf(makeIntake({ plan: 'enterprise', sites: 2 })), null);
});

/** An intake with no receptionistMode at all — what a legacy CONTENT schema produces. */
function intakeWithoutMode() {
  const intake = makeIntake();
  delete intake.receptionistMode; // not `undefined`: a default parameter would re-fill that
  return intake;
}

test('an unstated receptionistMode is refused rather than guessed', () => {
  const err = refusalOf(intakeWithoutMode());
  assert.ok(err instanceof OnboardError, 'must throw OnboardError, not exit the process');
  assert.match(err.message, /Intake validation failed/);
});

test('an invalid receptionistMode is refused', () => {
  assert.ok(refusalOf(makeIntake({ receptionistMode: 'maybe' })) instanceof OnboardError);
});

test('all three valid receptionist modes are accepted', () => {
  assert.equal(refusalOf(makeIntake({ plan: 'growth', receptionistMode: 'forwarded' })), null);
  assert.equal(refusalOf(makeIntake({ plan: 'growth', receptionistMode: 'published' })), null);
  assert.equal(refusalOf(makeIntake({ plan: 'starter', receptionistMode: 'declined' })), null);
});

test('"declined" is refused on growth and enterprise', () => {
  // Those tiers are sold on the receptionist, so declining one is a contradiction rather than
  // a configuration — silently skipping it would withhold what the client paid for.
  assert.ok(refusalOf(makeIntake({ plan: 'growth', receptionistMode: 'declined' })) instanceof OnboardError);
  assert.ok(refusalOf(makeIntake({ plan: 'enterprise', sites: 2, receptionistMode: 'declined' })) instanceof OnboardError);
});

test('plan and multi-site must agree in both directions', () => {
  // Without this the two are independent: a growth intake with 2 sites builds site-1/ and
  // site-2/ while the portal attaches only the base slug, naming a Vercel project that was
  // never created.
  assert.ok(refusalOf(makeIntake({ plan: 'growth', sites: 2 })) instanceof OnboardError);
  assert.ok(refusalOf(makeIntake({ plan: 'enterprise', sites: 1 })) instanceof OnboardError);
});

test('enterprise accepts 2 or 3 sites and refuses 4', () => {
  assert.equal(refusalOf(makeIntake({ plan: 'enterprise', sites: 2 })), null);
  assert.equal(refusalOf(makeIntake({ plan: 'enterprise', sites: 3 })), null);
  assert.ok(refusalOf(makeIntake({ plan: 'enterprise', sites: 4 })) instanceof OnboardError);
});

test('enterprise sites must have unique brand.short values', () => {
  const intake = makeIntake({ plan: 'enterprise', sites: 2 });
  intake.sites[1].brand.short = intake.sites[0].brand.short;
  assert.ok(refusalOf(intake) instanceof OnboardError);
});

test('validateSite reports missing fields as warnings, not silent defaults', () => {
  // CLAUDE.md's rule: flag, never invent. A blank renders blank; it does not get filled in.
  const site = makeIntake().sites[0];
  site.brand.established = '';
  site.brand.license = '';
  const { errors, warnings } = validateSite(site, 'site[1/1]');
  assert.deepEqual(errors, [], 'an empty optional field is not an error');
  assert.ok(warnings.some((w) => /established/.test(w)));
  assert.ok(warnings.some((w) => /license/.test(w)));
});

test('the thrown error carries the step for the CLI to render', () => {
  const err = refusalOf(intakeWithoutMode());
  assert.ok(err instanceof OnboardError);
  assert.ok('step' in err, 'reportFatal prints `[step N] FAIL: …`, which the console parser reads');
});
