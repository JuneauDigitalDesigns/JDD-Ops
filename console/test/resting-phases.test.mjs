/**
 * What the /manage roster claims about a client that isn't currently running.
 *
 * `restingPhases` infers each phase from disk. Its `switch` ended in `default: done = false`,
 * so six nodes never resolved — `preflight`, `checks`, `deploy`, `portal`, `publishNumber` and
 * `testLogin` all read as permanently "pending", even for a fully provisioned client. Three of
 * those were genuinely knowable:
 *
 *   - `testLogin`  → CLERK_USER_ID is in .env.local
 *   - `portal`     → PORTAL_ACCOUNT_EMAIL is too, carried by onboard.js's CARRIED_KEYS. The
 *                    old comment claiming the portal record "lives in KV, not on disk" was out
 *                    of date.
 *   - `publishNumber` → needed brandPhone from site.ts, which SiteInfo did not carry.
 *
 * The publish node is the interesting one. Inferring it from TWILIO_NUMBER alone would be easy
 * and wrong: a number exists from the moment it is bought, so that would mark the step done
 * while the site still advertised the owner's line — which is the exact bug the step was added
 * to catch, re-expressed as a UI lie. It is therefore driven by `numberPublished`, a real
 * comparison of site.ts against .env.local.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { restingPhases } from '../src/lib/run-plan.ts';
import { PHASE_LABELS } from '../src/lib/onboard-parse.ts';

/** A provisioned single-site Growth client, with overridable env and published-number state. */
function ctx({ env = {}, numberPublished = false, isWebOnly = false } = {}) {
  const fullEnv = {
    RETELL_AGENT_ID: 'agent_1',
    TWILIO_NUMBER: '+14075551212',
    AIRTABLE_BASE_ID: 'appCLIENT',
    RETELL_POST_CALL_WEBHOOK_URL: 'https://hook.us2.make.com/clone',
    VERCEL_PROJECT_NAME: 'fixture',
    CLERK_USER_ID: 'user_1',
    PORTAL_ACCOUNT_EMAIL: 'owner@example.com',
    ...env,
  };
  return {
    slug: 'fixture',
    plan: 'growth',
    brandName: 'Fixture Co',
    isEnterprise: false,
    repoBuilt: true,
    detectedStatus: 'live',
    schemaPath: 'clients/fixture/site.ts',
    hasIntake: true,
    isWebOnly,
    receptionistMode: isWebOnly ? 'declined' : 'forwarded',
    sites: [
      {
        slug: 'fixture',
        brandName: 'Fixture Co',
        brandShort: 'fc',
        canonical: null,
        repoBuilt: true,
        env: fullEnv,
        missingFields: [],
        accent: '#000',
        brandPhone: numberPublished ? '(407) 555-1212' : '(207) 318-1838',
        numberPublished,
      },
    ],
  };
}

const statusOf = (phases, label) =>
  phases.find((p) => p.label.split(' · ')[0] === label)?.status;

test('a fully provisioned client shows the portal and test login as done', () => {
  const phases = restingPhases(ctx({ numberPublished: true }));
  assert.equal(statusOf(phases, PHASE_LABELS.portal), 'done');
  assert.equal(statusOf(phases, PHASE_LABELS.testLogin), 'done');
});

test('the publish step is done only when the site advertises the Twilio number', () => {
  assert.equal(statusOf(restingPhases(ctx({ numberPublished: true })), PHASE_LABELS.publishNumber), 'done');
});

test('a bought-but-unpublished number does NOT read as done', () => {
  // The whole point: TWILIO_NUMBER is set, so a naive check would call this finished while
  // every real caller still dials the owner directly and bypasses /api/voice.
  const phases = restingPhases(ctx({ numberPublished: false }));
  assert.equal(statusOf(phases, PHASE_LABELS.number), 'done', 'the number itself IS bought');
  assert.equal(statusOf(phases, PHASE_LABELS.publishNumber), 'pending', 'but it is not published');
});

test('no portal account on disk leaves the portal pending', () => {
  const phases = restingPhases(ctx({ env: { PORTAL_ACCOUNT_EMAIL: '' }, numberPublished: true }));
  assert.equal(statusOf(phases, PHASE_LABELS.portal), 'pending');
});

test('no Clerk user on disk leaves the test login pending', () => {
  const phases = restingPhases(ctx({ env: { CLERK_USER_ID: '' }, numberPublished: true }));
  assert.equal(statusOf(phases, PHASE_LABELS.testLogin), 'pending');
});

test('pre-flight and the correctness checks stay pending — they leave no artifact', () => {
  // Honest, not a gap: neither writes anything to clients/, so disk cannot answer for them.
  const phases = restingPhases(ctx({ numberPublished: true }));
  assert.equal(statusOf(phases, PHASE_LABELS.preflight), 'pending');
  assert.equal(statusOf(phases, PHASE_LABELS.checks), 'pending');
});

test('a web-only client keeps the voice stack struck through, not pending', () => {
  // expectedPhases marks these 'skipped'; restingPhases must not promote them off disk state.
  const phases = restingPhases(ctx({ isWebOnly: true, numberPublished: false }));
  for (const label of [PHASE_LABELS.number, PHASE_LABELS.agent, PHASE_LABELS.callLogging, PHASE_LABELS.publishNumber]) {
    assert.equal(statusOf(phases, label), 'skipped', `${label} should stay skipped for web-only`);
  }
});

test('nothing is reported done for a client with an empty env', () => {
  const empty = ctx({ numberPublished: false });
  empty.sites[0].env = {};
  empty.sites[0].repoBuilt = false;
  empty.repoBuilt = false;
  const phases = restingPhases(empty);
  const done = phases.filter((p) => p.status === 'done').map((p) => p.label);
  // Intake is the one thing knowable without env: the site.ts parsed.
  assert.deepEqual(done, [PHASE_LABELS.intake]);
});
