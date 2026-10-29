/**
 * probeMakeScenario — the console's "is this client's post-call scenario alive?" check.
 *
 * This probe had NEVER executed successfully for any client. It called `GET /scenarios`,
 * which 400s with `"teamId" or "organizationId" has to be set`, so it bailed at the first
 * request and returned `checked: false` forever. Reconcile reported "Make not checked" for
 * every client and nobody noticed, because an unchecked probe looks like a quiet one.
 *
 * It then also called `GET /scenarios/{id}/hooks`, which does not exist in Make API v2 (404) —
 * the same dead endpoint that made onboard.js step 8c fail on every run.
 *
 * The fake fetch below replays RECORDED payloads. It also records every URL requested, which
 * is what makes the drift guard at the bottom possible: a mock that happily answers a dead
 * endpoint is how the original bug survived review.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { probeMakeScenario } from '../lib/reconcile-probes.js';
import { loadFixture } from './helpers/fixtures.mjs';

const ZONE = 'https://us2.make.com/api/v2';

const orgs = loadFixture('make/organizations.json');
const teams = loadFixture('make/teams.json');
const hooks = loadFixture('make/hooks-list.json');
const scenario = loadFixture('make/scenario.json');

// Derived from the recording rather than hardcoded, so re-running fixtures:refresh can't
// quietly decouple the test from the data it replays.
const LINKED_HOOK = hooks.hooks.find((h) => h.scenarioId);
const LINKED = LINKED_HOOK?.scenarioId;
const LIVE_HOOK = LINKED_HOOK?.url;

/**
 * Replay the recorded org → team → hooks walk. Anything not explicitly recorded 404s, the
 * way the real API does — a fake that answers everything proves nothing.
 */
function fakeFetch({ hooksOverride } = {}) {
  const urls = [];
  const json = (body, status = 200) =>
    Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) });

  const fn = (url) => {
    urls.push(String(url));
    const u = String(url);
    if (u === `${ZONE}/organizations`) return json(orgs);
    if (u.startsWith(`${ZONE}/teams?organizationId=`)) return json(teams);
    if (u.startsWith(`${ZONE}/hooks?teamId=`)) return json(hooksOverride ?? hooks);
    if (u === `${ZONE}/scenarios/${LINKED}`) return json(scenario);
    // Faithfully reproduce the two failures the old implementation relied on.
    if (u === `${ZONE}/scenarios`) {
      return json({ detail: '"teamId" or "organizationId" has to be set.', code: 'SC400' }, 400);
    }
    if (/\/scenarios\/\d+\/hooks$/.test(u)) return json({ message: 'Not found' }, 404);
    return json({ message: 'Not found' }, 404);
  };
  fn.urls = urls;
  return fn;
}

async function probe(args, fetchImpl) {
  const original = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  try {
    return await probeMakeScenario({ apiKey: 'tok', zone: ZONE, webhookUrl: null, ...args });
  } finally {
    globalThis.fetch = original;
  }
}

test('a live hook resolves to its scenario, with the active flag', () => {
  assert.ok(LINKED, 'precondition: the recorded hook list links at least one scenario');
});

test('a hook that owns a scenario is found and reported active', async () => {
  const r = await probe({ webhookUrl: LIVE_HOOK }, fakeFetch());
  assert.equal(r.checked, true);
  assert.equal(r.scenarioId, LINKED);
  assert.equal(r.isActive, scenario.scenario.isActive);
  assert.equal(r.name, scenario.scenario.name);
});

test('an orphaned hook — present but owning no scenario — reads as gone, not inactive', async () => {
  // The clone was deleted and left its hook behind. There is nothing left to switch on, so
  // calling it "deactivated" would send someone to the Make UI to flip a toggle that is absent.
  const orphan = hooks.hooks.find((h) => !h.scenarioId);
  assert.ok(orphan, 'precondition: the recording contains an unlinked hook');
  const r = await probe({ webhookUrl: orphan.url }, fakeFetch());
  assert.equal(r.checked, true);
  assert.equal(r.scenarioId, null);
  assert.equal(r.isActive, false);
});

test('a webhook URL nobody owns reads as gone', async () => {
  const r = await probe({ webhookUrl: 'https://hook.us2.make.com/doesnotexist' }, fakeFetch());
  assert.equal(r.checked, true);
  assert.equal(r.scenarioId, null);
});

test('no credentials reports unchecked — never a pass, never a failure', async () => {
  const r = await probe({ apiKey: null, webhookUrl: LIVE_HOOK }, fakeFetch());
  assert.equal(r.checked, false);
  assert.equal(r.isActive, null, 'null is "we did not look", which must not render as healthy');
});

test('a partial view reports unchecked rather than accusing a clone of being gone', async () => {
  // If the hooks list fails we have not looked everywhere, so "gone" would be a false alarm
  // on a perfectly healthy client.
  const failing = (url) => {
    const u = String(url);
    const json = (b, s = 200) => Promise.resolve({ ok: s < 300, status: s, json: () => Promise.resolve(b) });
    if (u === `${ZONE}/organizations`) return json(orgs);
    if (u.startsWith(`${ZONE}/teams?`)) return json(teams);
    return json({ message: 'rate limited' }, 429);
  };
  const r = await probe({ webhookUrl: LIVE_HOOK }, failing);
  assert.equal(r.checked, false);
});

test('DRIFT GUARD: the probe never calls the two endpoints that do not work', async () => {
  // This is the assertion that would have caught the original bug. `GET /scenarios` 400s
  // without a teamId and `GET /scenarios/{id}/hooks` does not exist — if either reappears,
  // the probe silently stops checking anything, exactly as it did before.
  const f = fakeFetch();
  await probe({ webhookUrl: LIVE_HOOK }, f);
  assert.ok(f.urls.length > 0, 'the probe must actually make requests');
  for (const u of f.urls) {
    assert.ok(
      !/\/scenarios(\?.*)?$/.test(u) || /[?&](teamId|organizationId)=/.test(u),
      `bare GET /scenarios 400s without a teamId: ${u}`,
    );
    assert.ok(!/\/scenarios\/\d+\/hooks$/.test(u), `GET /scenarios/{id}/hooks is a 404 endpoint: ${u}`);
  }
});

test('the probe resolves a hook in at most a handful of requests', async () => {
  // The old implementation swept every scenario asking for its hooks (N+1). `GET /hooks` returns
  // url AND scenarioId together, so one list locates the clone.
  const f = fakeFetch();
  await probe({ webhookUrl: LIVE_HOOK }, f);
  assert.ok(f.urls.length <= 6, `expected a small fixed number of requests, got ${f.urls.length}`);
});
