/**
 * The .env.local a client would get — the plan-tier matrix from CLAUDE.md.
 *
 * Every tier now captures web-form leads into the portal (`LEAD_DELIVERY_MODE=portal`), so the
 * one remaining runtime difference between a Starter-with-receptionist and a Growth site is
 * `LEAD_CALLBACK` — whether `/api/contact` also dials the lead back. Easy to get wrong and
 * invisible when you do: the client simply stops receiving leads the way they were sold.
 *
 * These assert on `buildClientEnvLines`, which is the function a dry run now also runs — so a
 * green suite and a green dry run are making the same claim, not two similar-looking ones.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildClientEnvLines, isScenarioAlreadyRunning } from '../onboard.js';
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

test('every tier captures leads in the portal', () => {
  // The old email-vs-callback split is gone. A lead used to exist only as a Resend email on
  // Starter and as NOTHING on Growth — the callback path persisted no record at all, so an
  // unanswered callback (no call_analyzed → no Make run → no Airtable row) lost the lead.
  for (const plan of ['starter', 'growth', 'enterprise']) {
    assert.equal(build({ plan, webOnly: false }).env.LEAD_DELIVERY_MODE, 'portal', plan);
  }
  assert.equal(build({ plan: 'starter', webOnly: true }).env.LEAD_DELIVERY_MODE, 'portal', 'web-only');
});

test('only growth and enterprise also dial the lead back', () => {
  assert.equal(build({ plan: 'starter', webOnly: false }).env.LEAD_CALLBACK, 'off');
  assert.equal(build({ plan: 'growth', webOnly: false }).env.LEAD_CALLBACK, 'on');
  assert.equal(build({ plan: 'enterprise', webOnly: false }).env.LEAD_CALLBACK, 'on');
  // web-only is plan:"starter" + receptionistMode:"declined" — not a fourth tier, and it has no
  // agent or number to dial with.
  assert.equal(build({ plan: 'starter', webOnly: true }).env.LEAD_CALLBACK, 'off');
});

test('Resend is gone from every tier', () => {
  // It was the whole delivery mechanism for Starter and it failed OPEN: RESEND_API_KEY seeded
  // empty on a fresh client, syncVercelEnv skips empty values, so the key never reached Vercel
  // and /api/contact 502'd on every lead until someone set it by hand. $0 cost, 100% loss.
  for (const [plan, webOnly] of [['starter', false], ['starter', true], ['growth', false], ['enterprise', false]]) {
    const env = build({ plan, webOnly }).env;
    for (const k of ['RESEND_API_KEY', 'RESEND_FROM_EMAIL', 'LEAD_TO_EMAIL', 'LEAD_BRAND_NAME']) {
      assert.ok(!(k in env), `${k} must not be written for ${plan}${webOnly ? ' (web-only)' : ''}`);
    }
  }
});

test('every tier gets an ingest token and URL, on every plan shape', () => {
  // Tier-independent on purpose: web-only has no Airtable base and no number, so the portal is
  // the ONLY place its leads can land. An empty token here reproduces the Resend failure above —
  // syncVercelEnv skips empty values, so it would never reach Vercel and every lead would 401.
  for (const [plan, webOnly] of [['starter', false], ['starter', true], ['growth', false], ['enterprise', false]]) {
    const env = build({ plan, webOnly }).env;
    assert.match(env.LEAD_INGEST_TOKEN, /^[0-9a-f]{64}$/, `${plan} token`);
    assert.match(env.LEAD_INGEST_URL, /^https:\/\/\S+\/api\/ingest\/lead$/, `${plan} url`);
  }
});

test('the ingest token is never rotated on a re-run', () => {
  // Rotating it would orphan the KV token→{account,slug} record and 401 every subsequent lead,
  // with nothing failing on the ops side to say so.
  const token = 'a'.repeat(64);
  const env = build({ plan: 'growth', webOnly: false, prev: { LEAD_INGEST_TOKEN: token } }).env;
  assert.equal(env.LEAD_INGEST_TOKEN, token);
});

test('two tokens from two runs differ', () => {
  // Guards against a constant or a seeded generator sneaking in — a shared token would let any
  // client site post leads into any other client's account.
  const a = build({ plan: 'growth', webOnly: false }).env.LEAD_INGEST_TOKEN;
  const b = build({ plan: 'growth', webOnly: false }).env.LEAD_INGEST_TOKEN;
  assert.notEqual(a, b);
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
  assert.equal(env.LEAD_CALLBACK, 'off', 'the one remaining difference from growth');
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

test('an interrupted run keeps its Make hook + scenario ids, so the next run adopts', () => {
  // `cloneAndWirePostCall` already handles resumption: it reads MAKE_POST_CALL_SCENARIO_ID and
  // logs "Adopting scenario N ... (not cloning again)". The bug was never in that logic — it
  // was that step 5 rebuilt .env.local before step 11 could read it. These two keys are
  // written by patchEnvLocal mid-step-11, appear in no template above, and were absent from
  // CARRIED_KEYS, so the rebuild erased them every time.
  //
  // The cost was not a failed run, it was a silent leak. Each attempt cloned a SECOND scenario
  // and created a SECOND webhook, recorded the new pair over the old, and orphaned the
  // previous one — still active, still billing, still holding one of the account's capped
  // active-scenario slots, and no longer referenced by anything in the client's env. Two real
  // runs produced two orphans before anyone noticed.
  const prev = { MAKE_POST_CALL_HOOK_ID: '3013197', MAKE_POST_CALL_SCENARIO_ID: '6870565' };
  const { env } = build({ plan: 'growth', webOnly: false, prev });
  assert.equal(env.MAKE_POST_CALL_HOOK_ID, '3013197', 'hook id must survive the rebuild');
  assert.equal(env.MAKE_POST_CALL_SCENARIO_ID, '6870565', 'scenario id must survive the rebuild');
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

test('an adopted scenario that is already running is not a fatal start failure', () => {
  // The verbatim body a live run recorded, not a hand-written guess at one. `/start` on a
  // scenario a previous run already activated answers 422 IM306 — and that is the commonest
  // adoption case there is, because a run dying *after* activation is exactly the failure
  // adoption recovers from. `if (!res.ok) fail(...)` turned it into a dead run, so the first
  // run that successfully adopted still died, on the very next line.
  const alreadyRunning =
    '{"detail":"Scenario is already running.","message":"Scenario is already running (on start attempt)","code":"IM306"}';
  assert.equal(isScenarioAlreadyRunning(422, alreadyRunning), true);

  // Everything else must stay loudly fatal. Activating the clone is the step whose silent
  // failure is worst of all: Make accepts posts to an inactive scenario's webhook and discards
  // them, so the agent, the number and the webhook all look wired while nothing is ever logged.
  assert.equal(
    isScenarioAlreadyRunning(402, '{"message":"Maximum number of active scenarios has been exceeded","code":"IM324"}'),
    false,
    'the active-scenario cap must stay fatal — it means the clone is NOT running',
  );
  assert.equal(
    isScenarioAlreadyRunning(422, '{"detail":"The hook already has a scenario assigned.","code":"IM000"}'),
    false,
    'other 422s must stay fatal',
  );
  assert.equal(isScenarioAlreadyRunning(401, '{"code":"IM306"}'), false, 'only 422 counts');
  assert.equal(isScenarioAlreadyRunning(422, ''), false);
  assert.equal(isScenarioAlreadyRunning(422, undefined), false);
});

test('an operator-corrected forward number survives a re-run', () => {
  // CLIENT_FORWARD_PHONE used to be written straight from content.brand.phone every run, so a
  // correction made after provisioning was silently reverted to the intake number on the next
  // re-run — hop 1 then rings a line the owner has moved off, and the run reports success.
  // Observed live on _e2e_test_growth, which had to be repaired by hand twice in one session.
  const prev = { CLIENT_FORWARD_PHONE: '+12077763277' };
  const { env } = build({ plan: 'growth', webOnly: false, prev });
  assert.equal(env.CLIENT_FORWARD_PHONE, '+12077763277', 'the corrected number must win');

  // With nothing recorded yet, the intake number is still the right initial value.
  const fresh = build({ plan: 'growth', webOnly: false });
  assert.ok(fresh.env.CLIENT_FORWARD_PHONE, 'a first run still gets the intake number');

  // And it stays a voice-only key: carrying it must not leak into a web-only client, which
  // checkEnvTierMatrix rejects outright for having any voice key at all.
  const webOnly = build({ plan: 'starter', webOnly: true, prev });
  assert.equal(webOnly.env.CLIENT_FORWARD_PHONE, undefined, 'web-only must have no forward key');
});

test('a re-run writes each key exactly once', () => {
  // LEAD_INGEST_TOKEN was written by the template AND re-appended by CARRIED_KEYS, so every
  // re-run produced it on two lines — found in the live `_e2e_test_growth/.env.local` at lines
  // 4 and 18. Same value both times, so nothing failed; but readEnvLocal takes the last
  // occurrence, so a hand edit to the first copy was silently ignored.
  const prev = {
    LEAD_INGEST_TOKEN: 'lit_existing0000000000000000000000000000',
    PORTAL_ACCOUNT_EMAIL: 'owner@example.com',
    MAKE_POST_CALL_SCENARIO_ID: '1234567',
  };
  const { lines } = build({ plan: 'growth', webOnly: false, prev });
  const keys = lines.map((l) => String(l).slice(0, String(l).indexOf('='))).filter(Boolean);
  const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
  assert.deepEqual(dupes, [], `keys written more than once: ${[...new Set(dupes)].join(', ')}`);
});

test('the existing ingest token survives a re-run, once', () => {
  // The de-duplication must not cost the thing the duplication was protecting: losing the
  // registered token silently 401s every lead.
  const token = 'lit_existing0000000000000000000000000000';
  const { lines, env } = build({ plan: 'starter', webOnly: false, prev: { LEAD_INGEST_TOKEN: token } });
  assert.equal(env.LEAD_INGEST_TOKEN, token, 'the registered token must be kept, not re-minted');
  assert.equal(lines.filter((l) => String(l).startsWith('LEAD_INGEST_TOKEN=')).length, 1);
});
