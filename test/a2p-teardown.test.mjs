/**
 * The A2P half of teardown (`lib/a2p-teardown.js`).
 *
 * What it encodes:
 *   - Teardown knew nothing about A2P. A torn-down client left its Trust Hub objects on Twilio
 *     and `jdd:a2p-registration:{slug}` in KV, with nothing left on our side to find them by —
 *     the `_e2e_test_growth` drafts are exactly that, live today.
 *   - The rule from HANDOFF-a2p-sid-store-correction.md §5: delete only a registration that
 *     never completed. A live brand or campaign is kept, with its record, and reported — an
 *     approved campaign bills monthly until someone removes it.
 *   - A number leaves the client's Messaging Service before it is released.
 *
 * Every vendor RESPONSE here is a recording (`test/fixtures/trusthub/teardown/`, written by
 * `npm run fixtures:a2p`): the e2e drafts for the deletable case, JDD's own approved brand and
 * verified campaign for the live case, a real Twilio 404, and Upstash's REST shapes. DELETE
 * answers are bare status codes from the spy — the tests assert on our outbound calls.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { planA2pTeardown, teardownA2pRegistration, detachA2pNumber } from '../lib/a2p-teardown.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (name) => JSON.parse(readFileSync(resolve(HERE, 'fixtures', 'trusthub', 'teardown', name), 'utf8'));
const source = (rel) => readFileSync(resolve(HERE, '..', rel), 'utf8');

const KV_E2E = read('kv-registration-e2e.json');
const KV_MISS = read('kv-miss.json');
const NOT_FOUND = read('twilio-404.json');
const BRAND_APPROVED = read('brand-approved.json');
const CAMPAIGNS_VERIFIED = read('campaign-list-verified.json');
const E2E = {
  profile: read('e2e-profile.json'),
  doc: read('e2e-supporting-document.json'),
  business: read('e2e-enduser-business.json'),
  rep: read('e2e-enduser-rep.json'),
  address: read('e2e-address.json'),
};

const CREDS = { accountSid: 'AC' + '0'.repeat(32), authToken: 't', kvUrl: 'https://kv.example', kvToken: 'k' };
const SLUG = '_e2e_test_growth';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/**
 * A recorded account: KV answers with the e2e record (or a patched copy of it), Twilio GETs with
 * the recorded objects, everything else a real 404. DELETEs answer `deleteStatus`.
 */
function account({ kv = KV_E2E, patch = null, deleteStatus = () => 204, brand = BRAND_APPROVED, failBrand = false } = {}) {
  const calls = [];
  const kvBody = patch ? { result: JSON.stringify({ ...JSON.parse(kv.result), ...patch }) } : kv;
  const bySid = Object.fromEntries(Object.values(E2E).map((o) => [o.sid, o]));
  const impl = async (url, init = {}) => {
    const u = new URL(String(url));
    const method = init.method ?? 'GET';
    calls.push({ method, path: u.pathname + u.search });
    if (u.host === 'kv.example') return u.pathname.startsWith('/get/') ? json(kvBody) : json({ result: 1 });
    if (method === 'DELETE') {
      const status = deleteStatus(u.pathname);
      return status === 204 ? new Response(null, { status }) : json(NOT_FOUND.body, status);
    }
    if (/\/a2p\/BrandRegistrations\//.test(u.pathname)) return failBrand ? json({ message: 'boom' }, 503) : json(brand);
    if (/\/Compliance\/Usa2p$/.test(u.pathname)) return json(CAMPAIGNS_VERIFIED);
    const sid = (u.pathname.match(/(BU|IT|RD|AD|MG|QE)[0-9a-f]{32}/) ?? [])[0];
    if (sid && bySid[sid]) return json(bySid[sid]);
    return json(NOT_FOUND.body, NOT_FOUND.httpStatus);
  };
  impl.calls = calls;
  return impl;
}

const deletes = (impl) => impl.calls.filter((c) => c.method === 'DELETE' || (c.method === 'POST' && c.path.startsWith('/del/')));

test('the e2e drafts plan as never-completed: five Twilio objects and the record go', async () => {
  const fetchImpl = account();
  const out = await planA2pTeardown({ slug: SLUG, ...CREDS, fetchImpl });
  assert.equal(out.ok, true);
  assert.equal(out.plan.state, 'never-completed');
  assert.deepEqual(
    out.plan.toDelete.map((o) => [o.kind, o.exists]),
    [
      ['customer profile', true],
      ['business EndUser', true],
      ['representative EndUser', true],
      ['address document', true],
      ['address', true],
    ],
  );
  assert.equal(deletes(fetchImpl).length, 0, 'planning is read-only');
});

test('a dry run touches nothing', async () => {
  const fetchImpl = account();
  const out = await teardownA2pRegistration({ slug: SLUG, ...CREDS, dryRun: true, fetchImpl });
  assert.ok(out.steps.every((s) => s.outcome === 'skipped'));
  assert.equal(deletes(fetchImpl).length, 0);
});

test('a never-completed registration is deleted in order, then its record', async () => {
  const fetchImpl = account();
  const out = await teardownA2pRegistration({ slug: SLUG, ...CREDS, fetchImpl });
  const order = deletes(fetchImpl).map((c) => c.path.split('/').slice(-2).join('/'));
  assert.deepEqual(order, [
    'CustomerProfiles/BU3782f82c2f2f0c8fce2850d86ed2e932',
    'EndUsers/ITd979f6114c919fe4c1bdbf797ed3e7e2',
    'EndUsers/ITc341e12902d045d8a090218d07652d3a',
    'SupportingDocuments/RD45150bfae738a5fc79746a2415e9502e',
    'Addresses/ADaa688365e86e41c5d6d4a1326733b3ed.json',
    `del/${encodeURIComponent('jdd:a2p-registration:_e2e_test_growth')}`,
  ]);
  assert.ok(out.steps.every((s) => s.outcome === 'deleted'));
});

test('a failed delete keeps the record — it is the only pointer to what is left', async () => {
  const fetchImpl = account({ deleteStatus: (p) => (p.includes('/SupportingDocuments/') ? 400 : 204) });
  const out = await teardownA2pRegistration({ slug: SLUG, ...CREDS, fetchImpl });
  assert.ok(out.steps.some((s) => s.outcome === 'failed'));
  assert.equal(fetchImpl.calls.filter((c) => c.path.startsWith('/del/')).length, 0, 'the record must survive');
  assert.match(out.steps.at(-1).message, /only pointer/);
});

test('a live brand is never deleted, and neither is anything it rests on', async () => {
  // JDD's own approved brand and verified campaign, recorded — the shape of a paying client.
  const fetchImpl = account({
    patch: { brandSid: BRAND_APPROVED.sid, campaignSid: CAMPAIGNS_VERIFIED.compliance[0].sid, messagingServiceSid: 'MGd65c80f165d080f5d6d5b451ac4f431c' },
  });
  const out = await teardownA2pRegistration({ slug: SLUG, ...CREDS, fetchImpl });
  assert.equal(out.plan.state, 'live');
  assert.equal(deletes(fetchImpl).length, 0, 'nothing may be deleted');
  assert.ok(out.steps.every((s) => s.outcome === 'skipped'));
  assert.ok(out.plan.kept.some((k) => /bills monthly/.test(k.reason)), 'the cost must be said out loud');
  assert.ok(out.plan.kept.some((k) => k.kind === 'A2P record'));
});

test('an approved brand alone — no campaign yet — is already live', async () => {
  // The window between brand approval and campaign creation is days long, and the brand fee is
  // already paid. Deleting its bundles there breaks a registration that is one click from done.
  const fetchImpl = account({ patch: { brandSid: BRAND_APPROVED.sid } });
  const out = await teardownA2pRegistration({ slug: SLUG, ...CREDS, fetchImpl });
  assert.equal(out.plan.state, 'live');
  assert.equal(deletes(fetchImpl).length, 0);
});

test('a brand whose status cannot be read is treated as live', async () => {
  const fetchImpl = account({ patch: { brandSid: BRAND_APPROVED.sid }, failBrand: true });
  const out = await teardownA2pRegistration({ slug: SLUG, ...CREDS, fetchImpl });
  assert.equal(out.plan.state, 'unknown');
  assert.equal(deletes(fetchImpl).length, 0);
});

test('a mock brand does not make a registration live', async () => {
  const fetchImpl = account({ patch: { brandSid: BRAND_APPROVED.sid }, brand: { ...BRAND_APPROVED, mock: true } });
  const out = await planA2pTeardown({ slug: SLUG, ...CREDS, fetchImpl });
  assert.equal(out.plan.state, 'never-completed');
  assert.ok(out.plan.kept.some((k) => k.kind === 'brand' && /mock/.test(k.reason)), 'the brand itself is reported, not deleted');
});

test('no record is already-gone, not a failure', async () => {
  const out = await teardownA2pRegistration({ slug: SLUG, ...CREDS, fetchImpl: account({ kv: KV_MISS }) });
  assert.deepEqual(out.steps.map((s) => s.outcome), ['already-gone']);
});

test('detaching a number with no client service on record calls Twilio for nothing', async () => {
  const fetchImpl = account();
  const r = await detachA2pNumber({ slug: SLUG, phoneNumber: '+12075693204', ...CREDS, fetchImpl });
  assert.equal(r.outcome, 'already-gone');
  assert.equal(fetchImpl.calls.filter((c) => !c.path.startsWith('/get/')).length, 0);
});

test('both teardown paths take the number out of the client service BEFORE releasing it', () => {
  // A released number left as a sender on the client's campaign is the failure; order is the fix.
  for (const [file, detach, release] of [
    ['scripts/teardown.js', 'detachA2pNumber(', 'releaseTwilioNumber({'],
    ['console/src/app/api/manage/teardown/route.ts', 'detachA2pNumber(', 'ops.releaseTwilioNumber('],
  ]) {
    const src = source(file);
    assert.ok(src.includes(detach), `${file} never detaches the number`);
    assert.ok(src.indexOf(detach) < src.indexOf(release), `${file} releases before detaching`);
  }
  for (const file of ['scripts/teardown.js', 'console/src/app/api/manage/teardown/route.ts']) {
    assert.ok(source(file).includes('teardownA2pRegistration('), `${file} never tears down the A2P registration`);
  }
});
