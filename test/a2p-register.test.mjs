/**
 * The per-client A2P registration chain (`lib/a2p-register.js`).
 *
 * What each test here encodes, and where it came from:
 *
 *   - Readiness blocks every write. Phase 0 was a real, standing gap until 2026-11-02, and a
 *     profile filed without the ISV link burns an attempt days later (plan §8.3).
 *   - Submit is blocked without a current compliant evaluation (plan §8.2) — the guarantee that
 *     turns "a wrong field costs days" into "costs one click".
 *   - The attach step includes JDD's primary profile (plan §8.4).
 *   - The evaluation parser reads the shape Twilio ACTUALLY returns. The ISV guide documents
 *     `valid[]`/`invalid[]`; every recorded evaluation carries `results[].fields[]`. A parser
 *     written from the docs would have reported every noncompliant field as nothing.
 *   - The sole-proprietor path is Twilio's, not "the EIN path minus the EIN" — the agency code
 *     this replaced modelled it that way, which Twilio's recorded policies contradict.
 *   - A2P has never been filed for any client, so the retention tests (EIN, rep details, sole
 *     proprietor mobile) are preventive, as the moved agency suite was: the failure is silent,
 *     permanent and unrecoverable.
 *
 * Vendor RESPONSES served below come from `test/fixtures/trusthub/` (recorded by
 * `scripts/record-a2p-fixtures.js` and `refresh-fixtures.js`). Create calls answer with a bare
 * `{ sid, status }` from the spy — the tests assert on our OUTBOUND requests, which is
 * legitimate, and read nothing else from those bodies.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  STEPS,
  SOLE_PROP_POLICIES,
  availability,
  portalStatusFor,
  runStep,
  submitProfile,
  createBusinessEndUser,
  A2pStepRefused,
} from '../lib/a2p-register.js';
import { KNOWN_POLICIES } from '../lib/a2p-readiness.js';
import {
  buildBusinessEndUserAttributes,
  buildRepEndUserAttributes,
  buildTrustEndUser,
  findTaxIdPaths,
  repEndUserType,
  summarizeEvaluation,
} from '../lib/a2p-identity.js';
import { writeRegistration, a2pRegistrationKey } from '../lib/a2p-registration-store.js';

const FIXTURES = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'trusthub');
const read = (name) => JSON.parse(readFileSync(resolve(FIXTURES, name), 'utf8'));

const PRIMARY = read('primary-profile.json');
const PRIMARY_ASSIGNMENTS = read('primary-profile-assignments.json');
const PRIMARY_BUSINESS = read('primary-business-enduser.json');
const EVAL_PROFILE = read('evaluation-customer-profile.json');
const EVAL_TRUST = read('evaluation-trust-product.json');
const POLICIES = new Map([
  ...KNOWN_POLICIES.map((k) => [k.sid, read(`policy-${k.key}.json`)]),
  ...SOLE_PROP_POLICIES.map((k) => [k.sid, read(`policy-${k.key}.json`)]),
]);

const EIN = '47-1234567';
const EIN_BARE = '471234567';
const MASTER_MG = 'MG' + 'f'.repeat(32);
const ENV = {
  TWILIO_ACCOUNT_SID: 'AC' + '0'.repeat(32),
  TWILIO_AUTH_TOKEN: 'x'.repeat(32),
  TWILIO_PRIMARY_PROFILE_SID: PRIMARY.sid,
  TWILIO_MESSAGING_SERVICE_SID: MASTER_MG,
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/**
 * A Twilio double: readiness and evaluations replay recordings; creates record the outbound
 * request and hand back a SID. `state` lets a test set the statuses a refresh will read.
 */
function twilio({ failOn = null, evaluation = EVAL_PROFILE, trustEvaluation = EVAL_TRUST } = {}) {
  const calls = [];
  const state = { assignments: {}, statuses: {}, inService: new Set(), n: 0 };
  const sid = (prefix) => `${prefix}${String(++state.n).padStart(32, '0')}`;
  const impl = async (url, init = {}) => {
    const u = new URL(String(url));
    const method = init.method ?? 'GET';
    const body = String(init.body ?? '');
    calls.push({ url: u.href, path: u.pathname, method, body });
    if (failOn && failOn(u.pathname, method)) {
      // What Twilio does on a bad field: quotes the value straight back.
      return json({ code: 21620, message: `Invalid business_registration_number: ${EIN} is not a valid EIN` }, 400);
    }
    const p = u.pathname;
    // ── readiness, from recordings ──
    const policy = /\/v1\/Policies\/(RN[0-9a-f]+)$/.exec(p);
    if (policy) return POLICIES.has(policy[1]) ? json(POLICIES.get(policy[1])) : json({}, 404);
    if (p === `/v1/CustomerProfiles/${PRIMARY.sid}` && method === 'GET') return json(PRIMARY);
    if (p === `/v1/CustomerProfiles/${PRIMARY.sid}/EntityAssignments`) return json(PRIMARY_ASSIGNMENTS);
    if (p === `/v1/EndUsers/${PRIMARY_BUSINESS.sid}`) return json(PRIMARY_BUSINESS);
    if (/\/v1\/EndUsers\/IT/.test(p) && method === 'GET') return json({}, 404);
    if (p === '/v1/CustomerProfiles' && method === 'GET') return json({ results: [] });
    // ── the chain ──
    if (method === 'POST' && p === '/v1/CustomerProfiles') return json({ sid: sid('BU'), status: 'draft' }, 201);
    if (method === 'POST' && p === '/v1/TrustProducts') return json({ sid: sid('BU'), status: 'draft' }, 201);
    if (method === 'POST' && p === '/v1/EndUsers') return json({ sid: sid('IT') }, 201);
    if (method === 'POST' && /\/Addresses\.json$/.test(p)) return json({ sid: sid('AD') }, 201);
    if (method === 'POST' && p === '/v1/SupportingDocuments') return json({ sid: sid('RD') }, 201);
    const assign = /\/v1\/(CustomerProfiles|TrustProducts)\/(BU[0-9a-f]+)\/EntityAssignments$/.exec(p);
    if (assign) {
      const list = (state.assignments[assign[2]] ??= []);
      if (method === 'GET') return json({ results: list });
      const objectSid = new URLSearchParams(body).get('ObjectSid');
      const row = { sid: sid('BV'), object_sid: objectSid };
      list.push(row);
      return json(row, 201);
    }
    if (/\/Evaluations$/.test(p)) return json(p.includes('TrustProducts') ? trustEvaluation : evaluation, 201);
    const bundle = /\/v1\/(CustomerProfiles|TrustProducts)\/(BU[0-9a-f]+)$/.exec(p);
    if (bundle) {
      if (method === 'POST') state.statuses[bundle[2]] = new URLSearchParams(body).get('Status');
      return json({ sid: bundle[2], status: state.statuses[bundle[2]] ?? 'draft' });
    }
    if (method === 'POST' && p === '/v1/a2p/BrandRegistrations') {
      return json({ sid: sid('BN'), status: 'PENDING', brand_type: new URLSearchParams(body).get('BrandType'), mock: new URLSearchParams(body).get('Mock') === 'true' }, 201);
    }
    const brand = /\/v1\/a2p\/BrandRegistrations\/(BN[0-9a-f]+)$/.exec(p);
    if (brand) return json({ sid: brand[1], status: state.statuses.brand ?? 'PENDING', identity_status: state.statuses.identity ?? 'UNVERIFIED' });
    if (method === 'POST' && p === '/v1/Services') return json({ sid: sid('MG') }, 201);
    if (/\/Compliance\/Usa2p$/.test(p)) {
      if (method === 'POST') return json({ sid: sid('QE'), campaign_status: 'PENDING' }, 201);
      return json({ compliance: state.campaign ? [state.campaign] : [] });
    }
    if (/\/IncomingPhoneNumbers\.json$/.test(p)) return json({ incoming_phone_numbers: [{ sid: 'PN' + 'a'.repeat(32) }] });
    const member = /\/v1\/Services\/(MG[0-9a-f]+)\/PhoneNumbers(?:\/(PN[0-9a-f]+))?$/.exec(p);
    if (member) {
      const key = `${member[1]}:${member[2] ?? new URLSearchParams(body).get('PhoneNumberSid')}`;
      if (method === 'GET') return state.inService.has(key) ? json({ sid: member[2] }) : json({ message: 'not found' }, 404);
      if (method === 'DELETE') { state.inService.delete(key); return new Response(null, { status: 204 }); }
      state.inService.add(key);
      return json({ sid: member[2] }, 201);
    }
    return json({ message: `unexpected ${method} ${p}` }, 500);
  };
  impl.calls = calls;
  impl.state = state;
  return impl;
}

/** A Redis double recording every write. */
function redisSpy() {
  const writes = [];
  const store = new Map();
  return {
    writes,
    async set(key, value) { writes.push({ key, value: structuredClone(value) }); store.set(key, structuredClone(value)); return 'OK'; },
    async get(key) { return store.has(key) ? structuredClone(store.get(key)) : null; },
  };
}

const INPUTS = {
  'profile.create': { registrationPath: 'standard' },
  'business.create': {
    legalBusinessName: "Arthur's Plumbing LLC",
    businessType: 'Limited Liability Corporation',
    businessIndustry: 'CONSUMER',
    websiteUrl: 'https://arthursplumbing.com',
    ein: EIN,
  },
  'rep.create': {
    firstName: 'Arthur', lastName: 'Reyes', email: 'arthur@arthursplumbing.com', phone: '+14075550123',
    jobPosition: 'Owner', businessTitle: 'Owner',
  },
  'address.create': {
    customerName: "Arthur's Plumbing LLC", street: '1200 Main St', city: 'Orlando', region: 'FL', postalCode: '32801', country: 'US',
  },
  'trust.create': { companyType: 'private', brandContactEmail: 'ops@juneaudigitaldesigns.com' },
};

/** Drive the chain through the real `runStep` and the real store. */
function harness({ plan = 'growth', fetchImpl = twilio(), redis = redisSpy(), slug = 'arthurs-plumbing' } = {}) {
  let record = null;
  let clock = Date.parse('2026-11-02T12:00:00Z');
  const now = () => new Date((clock += 1000));
  const run = async (step, input = INPUTS[step] ?? {}) => {
    const result = await runStep({
      step, slug, plan, record, input, siteSlugs: [slug], env: ENV, fetchImpl, now,
      persist: (patch, current) => writeRegistration({ slug, patch, current, redis, now }),
    });
    record = result.record;
    return result;
  };
  return { run, fetchImpl, redis, get record() { return record; } };
}

const allStrings = (v, out = []) => {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => allStrings(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => allStrings(x, out));
  return out;
};

// ── Recorded vendor facts the chain rests on ─────────────────────────────────────────────────

test('evaluations really carry results[].fields[], not the documented valid[]/invalid[]', () => {
  for (const evaluation of [EVAL_PROFILE, EVAL_TRUST]) {
    assert.equal(evaluation.status, 'compliant', 'the recorded evaluations are passing ones');
    assert.ok(evaluation.results.length > 0);
    for (const r of evaluation.results) {
      assert.ok(Array.isArray(r.fields), 'each requirement carries fields[]');
      assert.equal('invalid' in r, false, 'the documented invalid[] does not appear');
      assert.ok(r.fields.every((f) => typeof f.passed === 'boolean' && typeof f.object_field === 'string'));
    }
  }
});

test('summarizeEvaluation reports a failing field from the recorded shape', () => {
  // Derived from the recording — one field flipped — so the shape is Twilio's, not ours.
  const failing = structuredClone(EVAL_PROFILE);
  failing.status = 'noncompliant';
  const business = failing.results.find((r) => r.object_type === 'customer_profile_business_information');
  business.passed = false;
  const field = business.fields.find((f) => f.object_field === 'business_name');
  field.passed = false;
  field.failure_reason = 'Business name does not match the registration record';

  const summary = summarizeEvaluation(failing);
  assert.equal(summary.status, 'noncompliant');
  assert.deepEqual(summary.failures.map((f) => f.field), ['business_name']);
  assert.equal(summary.failures[0].objectType, 'customer_profile_business_information');

  assert.deepEqual(summarizeEvaluation(EVAL_PROFILE), { status: 'compliant', sid: EVAL_PROFILE.sid, failures: [] });
  assert.equal(summarizeEvaluation({ status: 'weird' }).status, 'unknown', 'an unrecognised status is never a pass');
});

test('every EndUser we build uses a type and attribute keys the recorded policy lists', () => {
  const policyFields = (policyKey) => {
    const p = read(`policy-${policyKey}.json`);
    return new Map(p.requirements.end_user.map((e) => [e.type, new Set(e.fields)]));
  };
  const check = (policyKey, type, attributes) => {
    const fields = policyFields(policyKey).get(type);
    assert.ok(fields, `${policyKey} has no ${type} requirement`);
    for (const key of Object.keys(attributes)) assert.ok(fields.has(key), `${type}.${key} is not a field ${policyKey} lists`);
  };
  check('secondaryCustomerProfilePolicySid', 'customer_profile_business_information', buildBusinessEndUserAttributes(INPUTS['business.create']));
  check('secondaryCustomerProfilePolicySid', repEndUserType('standard'), buildRepEndUserAttributes(INPUTS['rep.create'], 'standard'));
  check('starterCustomerProfilePolicySid', repEndUserType('sole-proprietor'), buildRepEndUserAttributes(INPUTS['rep.create'], 'sole-proprietor'));
  const std = buildTrustEndUser(INPUTS['trust.create'], 'standard');
  check('a2pMessagingPolicySid', std.type, std.attributes);
  const sp = buildTrustEndUser({ brandName: 'Arthur Reyes', mobile: '+14075550199', vertical: 'CONSTRUCTION' }, 'sole-proprietor');
  check('soleProprietorTrustProductPolicySid', sp.type, sp.attributes);
});

test('the sole-proprietor path is the Starter profile + Sole Proprietor trust product Twilio defines', async () => {
  // The code this replaced sent a business EndUser with no EIN on a SECONDARY profile — a shape
  // none of Twilio's recorded policies describes.
  const h = harness();
  await h.run('profile.create', { registrationPath: 'sole-proprietor' });
  const profileCreate = h.fetchImpl.calls.find((c) => c.method === 'POST' && c.path === '/v1/CustomerProfiles');
  assert.equal(new URLSearchParams(profileCreate.body).get('PolicySid'), 'RN806dd6cd175f314e1f96a9727ee271f4');
  await assert.rejects(() => h.run('business.create'), /does not apply to this path|sole-proprietor path/);

  await h.run('rep.create');
  const rep = h.fetchImpl.calls.filter((c) => c.path === '/v1/EndUsers' && c.method === 'POST').at(-1);
  const params = new URLSearchParams(rep.body);
  assert.equal(params.get('Type'), 'starter_customer_profile_information');
  assert.deepEqual(Object.keys(JSON.parse(params.get('Attributes'))).sort(), ['email', 'first_name', 'last_name', 'phone_number']);
});

// ── The gates ────────────────────────────────────────────────────────────────────────────────

test('readiness blocks every write step before a single POST', async () => {
  // Phase 0 missing = the primary-profile SID absent. Each write step must refuse and touch
  // nothing — a profile filed without the reseller link is a wasted attempt.
  for (const step of STEPS.filter((s) => s.write)) {
    const fetchImpl = twilio();
    await assert.rejects(
      () => runStep({
        step: step.id, slug: 's', plan: 'growth', record: null, input: {}, env: { ...ENV, TWILIO_PRIMARY_PROFILE_SID: '' }, fetchImpl,
        persist: async () => { throw new Error('nothing may be persisted'); },
      }),
      /Phase 0 is not ready|does not apply to this path/,
      `${step.id} ran without readiness`,
    );
    assert.equal(fetchImpl.calls.filter((c) => c.method !== 'GET').length, 0, `${step.id} wrote to Twilio without readiness`);
  }
});

test('a step called directly with a non-passing readiness report refuses', async () => {
  const fetchImpl = twilio();
  const ctx = {
    slug: 's', plan: 'growth', record: { registrationPath: 'standard', profileSid: 'BU1' }, input: INPUTS['business.create'],
    ready: { ok: null, policies: {} }, auth: { accountSid: 'AC', authToken: 't' }, primaryProfileSid: PRIMARY.sid,
    env: ENV, fetchImpl, now: () => new Date(), save: async () => { throw new Error('no'); },
  };
  await assert.rejects(() => createBusinessEndUser(ctx), A2pStepRefused);
  assert.equal(fetchImpl.calls.length, 0);
});

test('submit is refused with no evaluation, a noncompliant one, or a stale one', async () => {
  const base = {
    slug: 's', plan: 'growth', input: {}, ready: { ok: true, policies: {} }, auth: { accountSid: 'AC', authToken: 't' },
    primaryProfileSid: PRIMARY.sid, env: ENV, now: () => new Date(), save: async () => { throw new Error('no'); },
  };
  const at = '2026-11-02T12:00:00.000Z';
  const cases = [
    ['absent', {}],
    ['noncompliant', { lastEvaluation: { status: 'noncompliant', sid: 'EL1', failures: [], at } }],
    ['unknown', { lastEvaluation: { status: 'unknown', sid: 'EL1', failures: [], at } }],
    ['stale', { lastEvaluation: { status: 'compliant', sid: 'EL1', failures: [], at }, profileChangedAt: '2026-11-02T12:00:05.000Z' }],
  ];
  for (const [name, extra] of cases) {
    const fetchImpl = twilio();
    await assert.rejects(
      () => submitProfile({ ...base, fetchImpl, record: { registrationPath: 'standard', profileSid: 'BU1', ...extra } }),
      A2pStepRefused,
      `submitted with a ${name} evaluation`,
    );
    assert.equal(fetchImpl.calls.length, 0, `${name}: nothing may reach Twilio`);
  }
});

test('the full standard chain: four profile assignments, primary included, then submit', async () => {
  const h = harness();
  for (const step of ['profile.create', 'business.create', 'rep.create', 'address.create', 'profile.attach']) await h.run(step);
  const profileSid = h.record.profileSid;
  const attached = h.fetchImpl.calls
    .filter((c) => c.method === 'POST' && c.path === `/v1/CustomerProfiles/${profileSid}/EntityAssignments`)
    .map((c) => new URLSearchParams(c.body).get('ObjectSid'));
  assert.equal(attached.length, 4, 'four object_sids, not three');
  assert.equal(attached.at(-1), PRIMARY.sid, "JDD's primary profile is the declaring assignment");

  assert.equal(availability(h.record, { plan: 'growth', primaryProfileSid: PRIMARY.sid })['profile.submit'].enabled, false);
  await h.run('profile.evaluate');
  assert.equal(availability(h.record, { plan: 'growth', primaryProfileSid: PRIMARY.sid })['profile.submit'].enabled, true);
  await h.run('profile.submit');
  assert.equal(h.record.statuses.profile, 'pending-review');
  assert.equal(portalStatusFor(h.record), 'profile-pending');
});

test('re-running attach after a partial failure adds only what is missing', async () => {
  // Resume, not duplicate: TrustHub has no "find my half-built bundle" query.
  let failNext = false;
  const inner = twilio();
  const fetchImpl = Object.assign(async (url, init) => {
    if (failNext && init?.method === 'POST' && String(url).endsWith('/EntityAssignments') && inner.state.assignmentsMade === 2) {
      return json({ message: 'boom' }, 500);
    }
    const res = await inner(url, init);
    if (init?.method === 'POST' && String(url).endsWith('/EntityAssignments')) inner.state.assignmentsMade = (inner.state.assignmentsMade ?? 0) + 1;
    return res;
  }, { calls: inner.calls, state: inner.state });
  const h = harness({ fetchImpl });
  for (const step of ['profile.create', 'business.create', 'rep.create', 'address.create']) await h.run(step);
  failNext = true;
  await assert.rejects(() => h.run('profile.attach'));
  assert.equal(Object.keys(h.redis.writes.at(-1).value.profileAssignments).length, 2, 'the two that landed were saved');
  failNext = false;
  // the harness only advances its record on success; resume from what the store holds
  const stored = await h.redis.get(a2pRegistrationKey('arthurs-plumbing'));
  const result = await runStep({
    step: 'profile.attach', slug: 'arthurs-plumbing', plan: 'growth', record: stored, input: {}, env: ENV, fetchImpl,
    persist: (patch, current) => writeRegistration({ slug: 'arthurs-plumbing', patch, current, redis: h.redis }),
  });
  const posts = inner.calls.filter((c) => c.method === 'POST' && c.path.endsWith('/EntityAssignments'));
  // The failed attempt never reaches `inner`, so these are the successful assignments only.
  assert.equal(posts.length, 4, '2 before the failure + the 2 still missing — nothing assigned twice');
  assert.equal(new Set(posts.map((c) => new URLSearchParams(c.body).get('ObjectSid'))).size, 4);
  assert.equal(Object.keys(result.record.profileAssignments).length, 4);
});

test('Enterprise cannot take the sole-proprietor path', async () => {
  const h = harness({ plan: 'enterprise' });
  await assert.rejects(() => h.run('profile.create', { registrationPath: 'sole-proprietor' }), /Enterprise cannot register as a sole proprietor/);
  assert.equal(h.fetchImpl.calls.filter((c) => c.method === 'POST').length, 0);
});

test('Starter and web-only never register', async () => {
  await assert.rejects(() => harness({ plan: 'starter' }).run('profile.create'), /Only Growth and Enterprise/);
});

test('a number in the master pool is not moved without an explicit confirm', async () => {
  const fetchImpl = twilio();
  const record = { version: 1, slug: 's', registrationPath: 'standard', mock: false, messagingServiceSid: 'MG' + '1'.repeat(32), createdAt: '', updatedAt: '' };
  const pn = 'PN' + 'a'.repeat(32);
  fetchImpl.state.inService.add(`${MASTER_MG}:${pn}`);
  const go = (input) => runStep({
    step: 'number.attach', slug: 's', plan: 'growth', record, input, siteSlugs: ['s'], env: ENV, fetchImpl,
    persist: async (patch, current) => ({ ...(current ?? record), ...patch }),
  });
  await assert.rejects(() => go({ siteSlug: 's', e164: '+12075693204' }), /master pool/);
  assert.equal(fetchImpl.calls.filter((c) => c.method !== 'GET').length, 0, 'nothing moved');

  const result = await go({ siteSlug: 's', e164: '+12075693204', moveFromMaster: true });
  assert.equal(result.record.numbers.s.inService, true, 'confirmed by read-back');
  assert.ok(fetchImpl.calls.some((c) => c.method === 'DELETE' && c.path.startsWith(`/v1/Services/${MASTER_MG}/`)));
});

// ── Retention ────────────────────────────────────────────────────────────────────────────────

test('the EIN reaches exactly one request, and no store, across the whole chain', async () => {
  const h = harness();
  for (const step of ['profile.create', 'business.create', 'rep.create', 'address.create', 'profile.attach', 'profile.evaluate', 'profile.submit']) {
    await h.run(step);
  }
  const carrying = h.fetchImpl.calls.filter((c) => c.body.includes(EIN) || c.body.includes(encodeURIComponent(EIN)) || c.body.includes(EIN_BARE));
  assert.equal(carrying.length, 1, 'the EIN must appear in exactly one outbound request');
  assert.equal(carrying[0].path, '/v1/EndUsers');

  assert.ok(h.redis.writes.length > 3, 'the test is worthless if nothing was written');
  const persisted = allStrings(h.redis.writes.map((w) => w.value)).join(' ');
  for (const secret of [EIN, EIN_BARE, 'arthur@arthursplumbing.com', '+14075550123', 'Reyes']) {
    assert.ok(!persisted.includes(secret), `${secret} was persisted`);
  }
  for (const { value } of h.redis.writes) assert.deepEqual(findTaxIdPaths(value), []);
});

test("the sole proprietor's mobile reaches exactly one request and no store", async () => {
  const MOBILE = '+14075550199';
  const fetchImpl = twilio();
  const h = harness({ fetchImpl });
  await h.run('profile.create', { registrationPath: 'sole-proprietor' });
  for (const step of ['rep.create', 'address.create', 'profile.attach', 'profile.evaluate', 'profile.submit']) await h.run(step);
  await h.run('trust.create', { brandName: 'Arthur Reyes', mobile: MOBILE, vertical: 'CONSTRUCTION' });
  const trustCreate = fetchImpl.calls.find((c) => c.method === 'POST' && c.path === '/v1/TrustProducts');
  assert.equal(new URLSearchParams(trustCreate.body).get('PolicySid'), 'RN670d5d2e282a6130ae063b234b6019c8');
  const carrying = fetchImpl.calls.filter((c) => c.body.includes(encodeURIComponent(MOBILE)) || c.body.includes(MOBILE));
  assert.equal(carrying.length, 1);
  assert.ok(!allStrings(h.redis.writes.map((w) => w.value)).join(' ').includes(MOBILE));
});

test('a vendor rejection cannot carry the EIN into the error', async () => {
  const h = harness({ fetchImpl: twilio({ failOn: (p, m) => m === 'POST' && p === '/v1/EndUsers' }) });
  await h.run('profile.create');
  const error = await h.run('business.create').then(() => assert.fail('expected a rejection'), (e) => e);
  assert.equal(error.status, 400);
  assert.match(error.message, /business_registration_number/, 'the field-level reason survives');
  assert.ok(!error.message.includes(EIN) && !String(error.stack).includes(EIN));
  assert.deepEqual(findTaxIdPaths(error.message), []);
});

test('the store refuses tax-ID-shaped values and keys outside the schema', async () => {
  const redis = redisSpy();
  await assert.rejects(() => writeRegistration({ slug: 's', patch: { businessEndUserSid: EIN }, current: null, redis }), /tax-ID-shaped/);
  await assert.rejects(() => writeRegistration({ slug: 's', patch: { repEmail: 'a@b.co' }, current: null, redis }), /unknown key/);
  assert.equal(redis.writes.length, 0);
});

// ── Portal status ────────────────────────────────────────────────────────────────────────────

test('a mock registration never reports verified, and neither does a campaign with no number in it', () => {
  const base = { version: 1, slug: 's', registrationPath: 'standard', createdAt: '', updatedAt: '', brandSid: 'BN1', campaignSid: 'QE1' };
  const verified = { ...base, mock: false, statuses: { brand: 'APPROVED', campaign: 'VERIFIED' }, numbers: { s: { e164: '+1', phoneNumberSid: 'PN', inService: true } } };
  assert.equal(portalStatusFor(verified), 'verified');
  assert.equal(portalStatusFor({ ...verified, mock: true }), 'campaign-pending');
  assert.equal(portalStatusFor({ ...verified, numbers: { s: { ...verified.numbers.s, inService: false } } }), 'campaign-pending');
  assert.equal(portalStatusFor({ ...verified, statuses: { brand: 'FAILED' } }), 'failed');
  assert.equal(portalStatusFor(null), 'none');
});
