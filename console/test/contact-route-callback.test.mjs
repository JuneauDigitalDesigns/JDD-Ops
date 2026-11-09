/**
 * `/api/contact` (jdd-ops/lib/site-routes/contact.route.ts), the route every client site runs.
 *
 * **The rule this encodes (operator decision, 2026-11-03): an unanswered callback is a lost
 * lead.** A PLACED callback must not record the web-form submission in the portal: an answered
 * one reaches the portal through the completed call, and an unanswered one reaches nothing. The
 * route used to record every submission, so an answered callback landed twice and an unanswered
 * one sat in the inbox as a "new lead" nobody had spoken to. A callback that could NOT be placed
 * is a system failure and is still recorded, exactly as before — as is every Starter lead.
 *
 * **And a callback needs consent (operator decision, 2026-11-09).** The audit found the form's
 * consent covered texts only, and the route dialed on any phone number. It now dials only with a
 * consent it can verify, after the proof is saved outside the client's inbox.
 *
 * The real route, the real NextResponse. The network is the only double: one `fetch` stub
 * records what reached Retell, the agency's lead ingest and the agency's consent log.
 */

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { register } from 'node:module';

register('./helpers/next-from-console.mjs', import.meta.url);
const { POST } = await import('../../lib/site-routes/contact.route.ts');

const INGEST = 'https://www.juneaudigitaldesigns.com/api/ingest/lead';
const CONSENT_LOG = 'https://www.juneaudigitaldesigns.com/api/ingest/call-consent';
const TOKEN = 'a'.repeat(64);
let calls;
let retellStatus;
let consentLogStatus;
const order = [];
const realFetch = globalThis.fetch;

beforeEach(() => {
  calls = { retell: [], ingest: [], consent: [] };
  retellStatus = 201;
  consentLogStatus = 200;
  order.length = 0;
  Object.assign(process.env, {
    LEAD_INGEST_URL: INGEST,
    LEAD_INGEST_TOKEN: TOKEN,
    RETELL_API_KEY: 'key_test',
    TWILIO_NUMBER: '+14075550100',
    RETELL_AGENT_ID: 'agent_test',
    NEXT_PUBLIC_BRAND_NAME: 'Acme Plumbing',
  });
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    if (url.startsWith('https://api.retellai.com/')) {
      order.push('retell');
      calls.retell.push(JSON.parse(init.body));
      return new Response('{}', { status: retellStatus });
    }
    if (url === CONSENT_LOG) {
      order.push('consent');
      calls.consent.push({ body: JSON.parse(init.body), auth: init.headers.authorization });
      return Response.json({ ok: true }, { status: consentLogStatus });
    }
    if (url === INGEST) {
      calls.ingest.push(JSON.parse(init.body));
      return Response.json({ ok: true, leadId: 'lead_1' });
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
});

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.LEAD_CALLBACK;
});

// The sentence as Xander approved it, typed out here rather than read from the route, so a change
// to the route's copy can't pass by changing the expected value with it.
const APPROVED =
  "I agree that Acme Plumbing may call me back at the number I entered, about this request, using an automated system and an AI-generated voice. The call may be recorded. I don't have to agree in order to buy anything, and I can phone instead.";

const validConsent = (over = {}) => ({
  basis: 'web-form-checkbox',
  textVersion: 'lead-call-consent-v1',
  textHash: createHash('sha256').update(APPROVED).digest('hex'),
  capturedAt: '2026-11-09T15:00:00.000Z',
  pageUrl: 'https://acme.example/contact',
  ...over,
});

const submit = (body, headers = {}) =>
  POST(
    new Request('https://client.example/api/contact', {
      method: 'POST',
      body: JSON.stringify(body),
      headers,
    }),
  );

test('a placed callback does NOT record the submission — the completed call is the portal entry', async () => {
  process.env.LEAD_CALLBACK = 'on';
  const res = await submit({ name: 'Santa Juno', phone: '(207) 318-1838', callConsent: validConsent() });
  assert.equal(res.status, 200);
  assert.equal(calls.retell.length, 1, 'the callback is placed');
  assert.equal(calls.ingest.length, 0, 'an unanswered callback must not leave a lead in the portal');
});

test('a callback Retell refuses is a system failure: the lead is recorded, with callbackPlaced false', async () => {
  process.env.LEAD_CALLBACK = 'on';
  retellStatus = 500;
  const res = await submit({ name: 'Santa Juno', phone: '(207) 318-1838', callConsent: validConsent() });
  assert.equal(res.status, 200);
  assert.equal(calls.ingest.length, 1);
  assert.equal(calls.ingest[0].callbackPlaced, false, 'so the agency texts the owner at once');
});

test('callback on but no dialable number: recorded, no call attempted', async () => {
  process.env.LEAD_CALLBACK = 'on';
  await submit({ name: 'Dana', email: 'dana@example.com' });
  assert.equal(calls.retell.length, 0);
  assert.equal(calls.ingest.length, 1);
});

test('Starter (callback off) records every lead and never dials — unchanged', async () => {
  process.env.LEAD_CALLBACK = 'off';
  await submit({ name: 'Dana', phone: '4075550188' });
  assert.equal(calls.retell.length, 0);
  assert.equal(calls.consent.length, 0, 'a Starter site keeps no call-consent record');
  assert.equal(calls.ingest.length, 1);
});

test('nothing stored and no callback: the form is told it failed', async () => {
  process.env.LEAD_CALLBACK = 'off';
  globalThis.fetch = async () => new Response('down', { status: 503 });
  const res = await submit({ name: 'Dana', phone: '4075550188' });
  assert.equal(res.status, 502);
});

test('the placed callback opens with the approved outbound line, naming the lead', async () => {
  process.env.LEAD_CALLBACK = 'on';
  await submit({ name: 'Santa Juno', phone: '2073181838', callConsent: validConsent() });
  assert.equal(
    calls.retell[0].agent_override.retell_llm.begin_message,
    'This call is on a recorded line. Hi, this is Acme Plumbing, calling about the request you sent on our website. Am I speaking with Santa Juno?',
  );
  // The number goes to the agent already in words. Read as raw digits on live calls, 207 came
  // out "four oh seven" and then "seven oh seven" (2026-11-04) — so never digits here.
  assert.deepEqual(calls.retell[0].retell_llm_dynamic_variables, {
    lead_name: 'Santa Juno',
    callback_number_spoken: 'two zero seven, three one eight, one eight three eight',
  });
  assert.doesNotMatch(calls.retell[0].retell_llm_dynamic_variables.callback_number_spoken, /\d/);
});

/* ── the AI call couldn't go out: the form offers a message box ─────────────── */

const LEAD_ID = '11111111-2222-4333-8444-555555555555';
const MESSAGE_URL = 'https://www.juneaudigitaldesigns.com/api/ingest/lead/message';

test('a call that could not go out tells the form, with the lead to attach a message to', async () => {
  process.env.LEAD_CALLBACK = 'on';
  retellStatus = 500;
  const stub = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    if (String(input) === INGEST) {
      calls.ingest.push(JSON.parse(init.body));
      return Response.json({ ok: true, leadId: LEAD_ID });
    }
    return stub(input, init);
  };
  const res = await submit({ name: 'Dana', phone: '4075550188', callConsent: validConsent() });
  assert.deepEqual(await res.json(), { ok: true, callback: 'unavailable', followUpId: LEAD_ID });
});

test('a placed callback does not offer the message box', async () => {
  process.env.LEAD_CALLBACK = 'on';
  const res = await submit({ name: 'Dana', phone: '4075550188', callConsent: validConsent() });
  assert.deepEqual(await res.json(), { ok: true });
});

test('a Starter response is unchanged, and it has no follow-up path', async () => {
  process.env.LEAD_CALLBACK = 'off';
  const res = await submit({ name: 'Dana', phone: '4075550188' });
  assert.deepEqual(await res.json(), { ok: true });

  const followUp = await submit({ followUp: { leadId: LEAD_ID, message: 'hello' } });
  assert.equal(followUp.status, 400, 'an off site treats it as a submission with no contact');
});

function stubMessageEndpoint(status = 200) {
  const sent = [];
  const stub = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    if (String(input) === MESSAGE_URL) {
      sent.push({ body: JSON.parse(init.body), auth: init.headers.authorization });
      return Response.json({ ok: status === 200 }, { status });
    }
    return stub(input, init);
  };
  return sent;
}

test('a follow-up message goes to the existing lead, not a new one, and places no call', async () => {
  process.env.LEAD_CALLBACK = 'on';
  const sent = stubMessageEndpoint();
  const res = await submit({ followUp: { leadId: LEAD_ID, message: '  Leak under the sink ' } });
  assert.equal(res.status, 200);
  assert.deepEqual(sent, [
    { body: { leadId: LEAD_ID, message: 'Leak under the sink' }, auth: `Bearer ${TOKEN}` },
  ]);
  assert.equal(calls.ingest.length, 0, 'no second lead');
  assert.equal(calls.retell.length, 0);
});

test('a follow-up that fails to save tells the form', async () => {
  process.env.LEAD_CALLBACK = 'on';
  stubMessageEndpoint(503);
  const res = await submit({ followUp: { leadId: LEAD_ID, message: 'hello' } });
  assert.equal(res.status, 502);
});

for (const [label, followUp] of Object.entries({
  'an empty message': { leadId: LEAD_ID, message: '   ' },
  'a lead id that is not an id': { leadId: '../other', message: 'hello' },
})) {
  test(`${label} is refused before reaching the agency`, async () => {
    process.env.LEAD_CALLBACK = 'on';
    const sent = stubMessageEndpoint();
    const res = await submit({ followUp });
    assert.equal(res.status, 400);
    assert.equal(sent.length, 0);
  });
}

/* ── consent to the AI callback ─────────────────────────────────────────────── */

const notConsent = {
  'no consent at all': undefined,
  'consent to texts only': {
    basis: 'web-form',
    textVersion: 'lead-sms-consent-v1',
    textHash: '049b68b1a2e396a1d237fdb57198a885e75b14675336357c418591f6801b4726',
    capturedAt: '2026-11-09T15:00:00.000Z',
  },
  'an unknown wording version': validConsent({ textVersion: 'lead-call-consent-v0' }),
  'a version name found on every object': validConsent({ textVersion: 'constructor' }),
  'a hash of other words': validConsent({ textHash: 'f'.repeat(64) }),
};

for (const [label, callConsent] of Object.entries(notConsent)) {
  test(`${label}: no call, and the lead still reaches the inbox`, async () => {
    process.env.LEAD_CALLBACK = 'on';
    const res = await submit({ name: 'Dana', phone: '4075550188', callConsent });
    assert.equal(calls.retell.length, 0, 'never dial without valid consent');
    assert.equal(calls.consent.length, 0, 'nothing to keep as proof');
    assert.equal(calls.ingest.length, 1, 'a submission without consent must not be dropped');
    assert.equal(calls.ingest[0].callbackPlaced, false);
    assert.equal(res.status, 200);
  });
}

test('a site with no business name cannot call: the approved words name the business', async () => {
  process.env.LEAD_CALLBACK = 'on';
  delete process.env.NEXT_PUBLIC_BRAND_NAME;
  // The sentence with the name left blank: the only hash that would match if a missing name were
  // allowed through.
  const blank = APPROVED.replace('Acme Plumbing ', '');
  const textHash = createHash('sha256').update(blank).digest('hex');
  await submit({ name: 'Dana', phone: '4075550188', callConsent: validConsent({ textHash }) });
  assert.equal(calls.retell.length, 0);
  assert.equal(calls.ingest.length, 1);
});

test('the proof is saved before the call, and survives an unanswered one', async () => {
  process.env.LEAD_CALLBACK = 'on';
  await submit(
    { name: 'Santa Juno', phone: '(207) 318-1838', callConsent: validConsent() },
    { 'x-forwarded-for': '203.0.113.9, 10.0.0.1', 'user-agent': 'TestBrowser/1.0' },
  );

  assert.deepEqual(order, ['consent', 'retell'], 'no proof may be written after a call is made');
  assert.equal(calls.ingest.length, 0, 'the proof is not a lead');
  assert.equal(calls.consent[0].auth, `Bearer ${TOKEN}`, "authenticated with this site's own token");
  assert.deepEqual(calls.consent[0].body, {
    textVersion: 'lead-call-consent-v1',
    textHash: createHash('sha256').update(APPROVED).digest('hex'),
    text: APPROVED,
    businessName: 'Acme Plumbing',
    capturedAt: '2026-11-09T15:00:00.000Z',
    pageUrl: 'https://acme.example/contact',
    phone: '+12073181838',
    name: 'Santa Juno',
    ip: '203.0.113.9',
    userAgent: 'TestBrowser/1.0',
  });
});

test('no proof saved means no call: the lead goes to the inbox instead', async () => {
  process.env.LEAD_CALLBACK = 'on';
  consentLogStatus = 503;
  const res = await submit({ name: 'Dana', phone: '4075550188', callConsent: validConsent() });
  assert.equal(calls.retell.length, 0, 'a call nobody can later prove consent for');
  assert.equal(calls.ingest.length, 1);
  assert.equal(calls.ingest[0].callbackPlaced, false);
  assert.equal(res.status, 200);
});
