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
 * The real route, the real NextResponse. The network is the only double: one `fetch` stub
 * records what reached Retell and what reached the agency's ingest endpoint.
 */

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./helpers/next-from-console.mjs', import.meta.url);
const { POST } = await import('../../lib/site-routes/contact.route.ts');

const INGEST = 'https://www.juneaudigitaldesigns.com/api/ingest/lead';
let calls;
let retellStatus;
const realFetch = globalThis.fetch;

beforeEach(() => {
  calls = { retell: [], ingest: [] };
  retellStatus = 201;
  Object.assign(process.env, {
    LEAD_INGEST_URL: INGEST,
    LEAD_INGEST_TOKEN: 'a'.repeat(64),
    RETELL_API_KEY: 'key_test',
    TWILIO_NUMBER: '+14075550100',
    RETELL_AGENT_ID: 'agent_test',
    NEXT_PUBLIC_BRAND_NAME: 'Acme Plumbing',
  });
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    if (url.startsWith('https://api.retellai.com/')) {
      calls.retell.push(JSON.parse(init.body));
      return new Response('{}', { status: retellStatus });
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

const submit = (body) =>
  POST(new Request('https://client.example/api/contact', { method: 'POST', body: JSON.stringify(body) }));

test('a placed callback does NOT record the submission — the completed call is the portal entry', async () => {
  process.env.LEAD_CALLBACK = 'on';
  const res = await submit({ name: 'Santa Juno', phone: '(207) 318-1838' });
  assert.equal(res.status, 200);
  assert.equal(calls.retell.length, 1, 'the callback is placed');
  assert.equal(calls.ingest.length, 0, 'an unanswered callback must not leave a lead in the portal');
});

test('a callback Retell refuses is a system failure: the lead is recorded, with callbackPlaced false', async () => {
  process.env.LEAD_CALLBACK = 'on';
  retellStatus = 500;
  const res = await submit({ name: 'Santa Juno', phone: '(207) 318-1838' });
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
  await submit({ name: 'Santa Juno', phone: '2073181838' });
  assert.equal(
    calls.retell[0].agent_override.retell_llm.begin_message,
    'This call is on a recorded line. Hi, this is Acme Plumbing, calling about the request you sent on our website. Am I speaking with Santa Juno?',
  );
  assert.deepEqual(calls.retell[0].retell_llm_dynamic_variables, { lead_name: 'Santa Juno' });
});
