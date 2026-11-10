/**
 * The pool of Cloudflare Turnstile widgets every client site's lead form uses
 * (lib/turnstile-pool.js).
 *
 * **Why it exists (2026-11-09).** A free widget holds 10 hostnames, and every client site needs its
 * `*.vercel.app` host plus each custom domain. One widget fills at about the fourth client. A host
 * missing from the widget is worse than no check: Cloudflare refuses to render it there (error
 * 110200), so the form's human check silently can't run. These tests pin the planner that keeps
 * every site's hostnames on a widget with room, and the client that applies the plan.
 *
 * The Cloudflare double follows the Turnstile widgets API as documented (list, create, update).
 * It is not yet a recorded response: no API token existed when this was written. Record one with
 * `npm run fixtures:refresh` once the token is in jdd-ops/.env.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  POOL_PREFIX,
  HOSTNAMES_PER_WIDGET,
  siteHostnames,
  planSiteHostnames,
  missingTurnstileHostnames,
  ensureSiteOnPool,
  describeTurnstilePlan,
} from '../lib/turnstile-pool.js';

const w = (n, domains, extra = {}) => ({
  sitekey: `0x4AAAAAAA${n}`,
  name: n === 1 ? POOL_PREFIX : `${POOL_PREFIX} ${n}`,
  domains,
  mode: 'managed',
  ...extra,
});
const hosts = (prefix, count) => Array.from({ length: count }, (_, i) => `${prefix}${i}.vercel.app`);

/* ── which hostnames a site needs ─────────────────────────────────────────── */

test("a site needs its vercel.app host and every domain Vercel lists, once each, lowercased", () => {
  assert.deepEqual(
    siteHostnames({ vercelHost: 'e2etestgrowth', domains: ['WWW.Acme.com', 'acme.com.', 'e2etestgrowth.vercel.app'] }),
    ['acme.com', 'e2etestgrowth.vercel.app', 'www.acme.com'],
  );
});

test('vercel.app itself is never a hostname: it would let every Vercel site in the world use our widget', () => {
  assert.deepEqual(siteHostnames({ vercelHost: 'x', domains: ['vercel.app', '.vercel.app', '*.acme.com', 'not a host'] }), [
    'x.vercel.app',
  ]);
});

/* ── the planner ──────────────────────────────────────────────────────────── */

test('a site whose hostnames are all on its widget needs nothing', () => {
  const p = planSiteHostnames({ widgets: [w(1, ['a.vercel.app'])], wanted: ['a.vercel.app'], currentSiteKey: w(1).sitekey });
  assert.equal(p.action, 'none');
  assert.equal(p.changesSiteKey, false);
});

test("a new custom domain is added to the site's own widget while it has room", () => {
  const p = planSiteHostnames({
    widgets: [w(1, ['a.vercel.app'])],
    wanted: ['a.vercel.app', 'acme.com'],
    currentSiteKey: w(1).sitekey,
  });
  assert.deepEqual([p.action, p.siteKey, p.changesSiteKey], ['add', w(1).sitekey, false]);
  assert.deepEqual(p.domains, ['a.vercel.app', 'acme.com']);
  assert.deepEqual(p.missing, ['acme.com']);
});

test('a site with no widget yet joins the first one with room, filling it before starting another', () => {
  const p = planSiteHostnames({
    widgets: [w(1, hosts('full', 10)), w(3, []), w(2, hosts('half', 5))],
    wanted: ['new.vercel.app'],
    currentSiteKey: '',
  });
  assert.deepEqual([p.action, p.siteKey, p.changesSiteKey], ['add', w(2).sitekey, true]);
});

test("when the site's widget is full, onboarding moves it to one with room", () => {
  const p = planSiteHostnames({
    widgets: [w(1, [...hosts('o', 9), 'a.vercel.app']), w(2, ['b.vercel.app'])],
    wanted: ['a.vercel.app', 'acme.com'],
    currentSiteKey: w(1).sitekey,
  });
  assert.deepEqual([p.action, p.siteKey, p.changesSiteKey], ['add', w(2).sitekey, true]);
  assert.deepEqual(p.domains, ['a.vercel.app', 'acme.com', 'b.vercel.app']);
});

test("…but attaching a domain in the console doesn't move a site: it says the widget is full", () => {
  const p = planSiteHostnames({
    widgets: [w(1, [...hosts('o', 9), 'a.vercel.app']), w(2, [])],
    wanted: ['a.vercel.app', 'acme.com'],
    currentSiteKey: w(1).sitekey,
    allowMove: false,
  });
  assert.deepEqual([p.action, p.missing], ['full', ['acme.com']]);
});

test('every widget full: a new one is created, named after the pool', () => {
  const p = planSiteHostnames({ widgets: [w(1, hosts('a', 10)), w(2, hosts('b', 10))], wanted: ['c.vercel.app'], currentSiteKey: '' });
  assert.deepEqual([p.action, p.name, p.domains, p.changesSiteKey], ['create', `${POOL_PREFIX} 3`, ['c.vercel.app'], true]);
});

test("widgets outside the pool (the agency's own quote-form widget) are never touched", () => {
  const agency = { sitekey: '0x4AAAAAAAagency', name: 'JDD production', domains: ['juneaudigitaldesigns.com'], mode: 'managed' };
  const p = planSiteHostnames({ widgets: [agency], wanted: ['a.vercel.app'], currentSiteKey: agency.sitekey });
  assert.equal(p.action, 'create', 'the agency widget is not a pool widget, so the site gets one of its own');
});

test('a site that needs more hostnames than a widget holds is refused, not split', () => {
  assert.throws(
    () => planSiteHostnames({ widgets: [], wanted: hosts('x', HOSTNAMES_PER_WIDGET + 1), currentSiteKey: '' }),
    /more hostnames than one widget holds/,
  );
});

/* ── the check ────────────────────────────────────────────────────────────── */

test('the check names every hostname missing from the widget the site actually renders', () => {
  assert.deepEqual(
    missingTurnstileHostnames({ widgets: [w(1, ['a.vercel.app'])], siteKey: w(1).sitekey, wanted: ['a.vercel.app', 'acme.com'] }),
    { ok: false, siteKeyKnown: true, missing: ['acme.com'] },
  );
  assert.deepEqual(missingTurnstileHostnames({ widgets: [w(1, ['a.vercel.app'])], siteKey: w(1).sitekey, wanted: ['a.vercel.app'] }), {
    ok: true,
    siteKeyKnown: true,
    missing: [],
  });
});

test("a site key that isn't any pool widget is itself the finding: the form can't run anywhere", () => {
  const r = missingTurnstileHostnames({ widgets: [w(1, ['a.vercel.app'])], siteKey: '0x4AAAAAAAgone', wanted: ['a.vercel.app'] });
  assert.deepEqual(r, { ok: false, siteKeyKnown: false, missing: ['a.vercel.app'] });
});

/* ── applying a plan against the API ──────────────────────────────────────── */

function fakeCloudflare(widgets, { failCreate = false } = {}) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url);
    const method = init.method ?? 'GET';
    calls.push({ method, path: u.pathname + u.search, body: init.body ? JSON.parse(init.body) : null, auth: init.headers?.authorization });
    const base = '/client/v4/accounts/acct_1/challenges/widgets';
    if (method === 'GET' && u.pathname === base) {
      const page = Number(u.searchParams.get('page') ?? 1);
      const per = Number(u.searchParams.get('per_page') ?? 25);
      const slice = widgets.slice((page - 1) * per, page * per);
      return Response.json({ success: true, result: slice, result_info: { page, per_page: per, count: slice.length, total_count: widgets.length } });
    }
    if (method === 'POST' && u.pathname === base) {
      if (failCreate) return Response.json({ success: false, errors: [{ code: 10000, message: 'widget limit reached' }] }, { status: 400 });
      const body = JSON.parse(init.body);
      const made = { ...body, sitekey: `0x4AAAAAAAnew${widgets.length}`, secret: '0x4AAAAAAA-SECRET-new' };
      widgets.push(made);
      return Response.json({ success: true, result: made });
    }
    if (method === 'PUT' && u.pathname.startsWith(`${base}/`)) {
      const key = u.pathname.slice(base.length + 1);
      const body = JSON.parse(init.body);
      const found = widgets.find((x) => x.sitekey === key);
      Object.assign(found, body);
      return Response.json({ success: true, result: found });
    }
    return Response.json({ success: false, errors: [{ code: 7003, message: 'no route' }] }, { status: 404 });
  };
  return { calls, fetchImpl };
}

const cf = (widgets, opts) => {
  const fake = fakeCloudflare(widgets, opts);
  const stored = [];
  return {
    ...fake,
    stored,
    run: (over) =>
      ensureSiteOnPool({
        accountId: 'acct_1',
        token: 'cf-token',
        storeSecret: async (siteKey, secret) => stored.push({ siteKey, secret }),
        fetchImpl: fake.fetchImpl,
        ...over,
      }),
  };
};

test('adding a hostname keeps the widget as it was otherwise: same name, mode and settings', async () => {
  const widgets = [w(1, ['a.vercel.app'], { region: 'world', bot_fight_mode: false, offlabel: false })];
  const c = cf(widgets);
  const r = await c.run({ wanted: ['a.vercel.app', 'acme.com'], currentSiteKey: w(1).sitekey });
  assert.equal(r.siteKey, w(1).sitekey);
  const put = c.calls.find((x) => x.method === 'PUT');
  assert.deepEqual(put.body, { name: POOL_PREFIX, domains: ['a.vercel.app', 'acme.com'], mode: 'managed', region: 'world', bot_fight_mode: false, offlabel: false });
  assert.equal(put.auth, 'Bearer cf-token');
});

test("a new widget's secret goes to the store and nowhere else: not returned, not logged", async (t) => {
  const lines = [];
  for (const m of ['log', 'warn', 'error']) t.mock.method(console, m, (...a) => lines.push(a.map(String).join(' ')));
  const c = cf([w(1, hosts('a', 10))]);
  const r = await c.run({ wanted: ['c.vercel.app'], currentSiteKey: '' });
  assert.deepEqual(c.stored, [{ siteKey: '0x4AAAAAAAnew1', secret: '0x4AAAAAAA-SECRET-new' }]);
  assert.equal(r.siteKey, '0x4AAAAAAAnew1');
  assert.doesNotMatch(JSON.stringify(r), /SECRET/);
  assert.doesNotMatch(describeTurnstilePlan(r.plan), /SECRET/);
  for (const l of lines) assert.doesNotMatch(l, /SECRET/);
  const create = c.calls.find((x) => x.method === 'POST');
  assert.deepEqual(create.body, { name: `${POOL_PREFIX} 2`, domains: ['c.vercel.app'], mode: 'managed' });
});

test("a secret that can't be stored stops the run before the site is pointed at that widget", async () => {
  const c = cf([]);
  await assert.rejects(
    c.run({ wanted: ['c.vercel.app'], currentSiteKey: '', storeSecret: async () => { throw new Error('KV down'); } }),
    (e) => /secret could not be saved/.test(e.message) && !/SECRET-new/.test(e.message),
  );
});

test('the pool is read across pages', async () => {
  const widgets = Array.from({ length: 30 }, (_, i) => w(i + 1, hosts(`p${i}x`, 10)));
  widgets[27].domains = ['room.vercel.app'];
  const c = cf(widgets);
  const r = await c.run({ wanted: ['site.vercel.app'], currentSiteKey: '' });
  assert.equal(r.siteKey, widgets[27].sitekey, 'the widget with room was on the second page');
});

test('a dry run reads the pool and changes nothing', async () => {
  const c = cf([w(1, ['a.vercel.app'])]);
  const r = await c.run({ wanted: ['a.vercel.app', 'acme.com'], currentSiteKey: w(1).sitekey, dryRun: true });
  assert.equal(r.plan.action, 'add');
  assert.deepEqual(c.calls.map((x) => x.method), ['GET']);
  assert.match(describeTurnstilePlan(r.plan), /add acme\.com/);
});

test("Cloudflare refusing a new widget (the free plan's 20) is reported, never swallowed", async () => {
  const c = cf([w(1, hosts('a', 10))], { failCreate: true });
  await assert.rejects(c.run({ wanted: ['c.vercel.app'], currentSiteKey: '' }), /widget limit reached/);
});

test('the console never creates or assigns a widget: a site with no key is refused, for onboarding to fix', () => {
  const p = planSiteHostnames({ widgets: [w(1, [])], wanted: ['a.vercel.app'], currentSiteKey: '', allowMove: false });
  assert.deepEqual([p.action, p.changesSiteKey], ['full', false]);
});
