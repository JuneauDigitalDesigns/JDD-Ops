/**
 * The .env.local a client would get — the plan-tier matrix from CLAUDE.md.
 *
 * `LEAD_DELIVERY_MODE` is the ONLY intended runtime difference between a
 * Starter-with-receptionist and a Growth site, which makes it both easy to get wrong and
 * invisible when you do: the client simply stops receiving leads the way they were sold.
 *
 * These assert on `buildClientEnvLines`, which is the function a dry run now also runs — so a
 * green suite and a green dry run are making the same claim, not two similar-looking ones.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildClientEnvLines } from '../onboard.js';
import { checkEnvTierMatrix, checkForwardNotSelf, envLinesToObject } from '../lib/onboard-checks.js';
import { makeIntake } from './helpers/fixtures.mjs';

const build = ({ plan, webOnly, prev = {}, env = {} }) => {
  const intake = makeIntake({ plan });
  const { lines } = buildClientEnvLines({
    siteSlug: 'test-co',
    plan,
    content: intake.sites[0],
    webOnly,
    prev,
    env,
  });
  return { lines, env: envLinesToObject(lines) };
};

test('starter emails leads; growth and enterprise call them back', () => {
  assert.equal(build({ plan: 'starter', webOnly: false }).env.LEAD_DELIVERY_MODE, 'email');
  assert.equal(build({ plan: 'growth', webOnly: false }).env.LEAD_DELIVERY_MODE, 'callback');
  assert.equal(build({ plan: 'enterprise', webOnly: false }).env.LEAD_DELIVERY_MODE, 'callback');
});

test('a web-only client is still priced as starter, so it still emails leads', () => {
  // web-only is plan:"starter" + receptionistMode:"declined" — not a fourth tier.
  assert.equal(build({ plan: 'starter', webOnly: true }).env.LEAD_DELIVERY_MODE, 'email');
});

test('starter gets the Resend keys; growth does not', () => {
  const starter = build({ plan: 'starter', webOnly: false }).env;
  assert.equal(starter.LEAD_TO_EMAIL, 'owner@example.com');
  assert.ok('RESEND_FROM_EMAIL' in starter);
  assert.ok(!('RESEND_FROM_EMAIL' in build({ plan: 'growth', webOnly: false }).env));
});

test('a web-only client gets NO voice keys at all', () => {
  // Writing them would stand up a number, an agent and a call log the client declined.
  const env = build({ plan: 'starter', webOnly: true }).env;
  for (const k of ['RETELL_AGENT_ID', 'RETELL_API_KEY', 'TWILIO_NUMBER', 'CLIENT_FORWARD_PHONE', 'AIRTABLE_BASE_ID']) {
    assert.ok(!(k in env), `${k} must not be written for a web-only client`);
  }
});

test('a starter WITH a receptionist gets the full voice stack, like growth', () => {
  // The 2026-10-12 reprice: every tier includes the receptionist. Gating on plan rather than
  // on web-only is what used to withhold the stack from a paying starter client.
  const env = build({ plan: 'starter', webOnly: false }).env;
  for (const k of ['RETELL_AGENT_ID', 'TWILIO_NUMBER', 'CLIENT_FORWARD_PHONE', 'AIRTABLE_BASE_ID']) {
    assert.ok(k in env, `${k} must be written for a starter with a receptionist`);
  }
  assert.equal(env.LEAD_DELIVERY_MODE, 'email', 'the one difference from growth stays');
});

test("CLIENT_FORWARD_PHONE is the owner's line, never the Twilio number", () => {
  // Hop 1 dials this from the Twilio number. If they match, /api/voice dials itself.
  const env = build({ plan: 'growth', webOnly: false, prev: { TWILIO_NUMBER: '+14075551212' } }).env;
  assert.equal(env.CLIENT_FORWARD_PHONE, '(207) 318-1838');
  assert.notEqual(env.CLIENT_FORWARD_PHONE, env.TWILIO_NUMBER);
});

test('already-provisioned ids survive a re-run', () => {
  const prev = {
    RETELL_AGENT_ID: 'agent_keep',
    TWILIO_NUMBER: '+14075551212',
    AIRTABLE_BASE_ID: 'appKEEP',
    CLIENT_FORWARD_RING_SECONDS: '12',
  };
  const env = build({ plan: 'growth', webOnly: false, prev }).env;
  assert.equal(env.RETELL_AGENT_ID, 'agent_keep');
  assert.equal(env.TWILIO_NUMBER, '+14075551212');
  assert.equal(env.AIRTABLE_BASE_ID, 'appKEEP');
  assert.equal(env.CLIENT_FORWARD_RING_SECONDS, '12', 'a tuned ring window must not be reset');
});

test('the ring window defaults to 15s, safely under carrier voicemail', () => {
  // Above ~20s the owner's voicemail answers, Twilio scores the call completed, the no-answer
  // branch never fires, and the caller never reaches the agent.
  const env = build({ plan: 'growth', webOnly: false }).env;
  assert.equal(env.CLIENT_FORWARD_RING_SECONDS, '15');
  assert.ok(Number(env.CLIENT_FORWARD_RING_SECONDS) < 20);
});

test('keys written later in the run are carried forward, not dropped', () => {
  // PORTAL_ACCOUNT_EMAIL in particular is what a later `--link-portal --email` reads.
  const prev = { AIRTABLE_SITE_TAG: 'acme-2', CLERK_USER_ID: 'user_1', PORTAL_ACCOUNT_EMAIL: 'o@example.com' };
  const { lines, env } = build({ plan: 'enterprise', webOnly: false, prev });
  assert.equal(env.AIRTABLE_SITE_TAG, 'acme-2');
  assert.equal(env.CLERK_USER_ID, 'user_1');
  assert.equal(env.PORTAL_ACCOUNT_EMAIL, 'o@example.com');
  assert.ok(lines[0].startsWith('#'), 'the generated-by header stays first');
});

test('the tier-matrix predicate passes every legitimate shape', () => {
  for (const [plan, webOnly] of [['starter', false], ['starter', true], ['growth', false], ['enterprise', false]]) {
    const { lines } = build({ plan, webOnly });
    const c = checkEnvTierMatrix({ lines, plan, webOnly });
    assert.equal(c.ok, true, `${plan}${webOnly ? ' web-only' : ''} should pass: ${c.detail}`);
  }
});

test('the tier-matrix predicate catches a mismatched delivery mode', () => {
  const { lines } = build({ plan: 'growth', webOnly: false });
  // Claim it's a starter: callback is then the wrong mode.
  assert.equal(checkEnvTierMatrix({ lines, plan: 'starter', webOnly: false }).ok, false);
});

test('the tier-matrix predicate catches voice keys leaking into a web-only client', () => {
  const { lines } = build({ plan: 'starter', webOnly: false });
  assert.equal(checkEnvTierMatrix({ lines, plan: 'starter', webOnly: true }).ok, false);
});

test('the forward-loop predicate catches a self-dial across number formats', () => {
  // The case that defeats a digits-only comparison: 11-digit E.164 vs 10-digit local.
  const lines = ['CLIENT_FORWARD_PHONE=(407) 555-1212'];
  assert.equal(checkForwardNotSelf({ lines, twilioNumber: '+14075551212' }).ok, false);
  assert.equal(checkForwardNotSelf({ lines, twilioNumber: '+12073181838' }).ok, true);
});

test('the forward-loop predicate declines to judge an unparseable number', () => {
  const c = checkForwardNotSelf({ lines: ['CLIENT_FORWARD_PHONE=(207) 318-1838'], twilioNumber: '<dry-run-number>' });
  assert.equal(c.ok, null, '"looks different" is not evidence of being different');
});

test('an empty forward target is a failure, not a skip', () => {
  const c = checkForwardNotSelf({ lines: ['CLIENT_FORWARD_PHONE='], twilioNumber: '+14075551212' });
  assert.equal(c.ok, false);
});
