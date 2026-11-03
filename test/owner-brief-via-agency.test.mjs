/**
 * The owner's end-of-call brief goes through the agency, never through Make's own Twilio module.
 *
 * **The bug this encodes.** Each clone used to carry a Twilio module whose `to`, `from` and very
 * existence were decided at onboarding (`smsEnabled` / `toNum` in patchPostCallBlueprint) and
 * never re-read. Owner opt-in moved to the portal, so an opt-in made later never reached Make: on
 * 2026-11-03 the growth fixture's clone had no Twilio module at all, and Xander got nothing at the
 * end of a completed callback. Now the clone's HTTP module posts the call to the agency's
 * `/api/ingest/call`, which reads consent at send time.
 *
 * Asserted against the RECORDED master — whose HTTP module was built in the Make UI and captured,
 * because an http:MakeRequest saved with nothing filled in has no `mapper` at all, and a guessed
 * shape would have certified exactly that — and the real `patchPostCallBlueprint`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { patchPostCallBlueprint, CALL_LOG_FIELDS } from '../onboard.js';
import { checkOwnerBriefViaAgency, fieldMapFromSpec } from '../lib/onboard-checks.js';
import { masterBlueprint, masterFieldMap } from './helpers/fixtures.mjs';

/** Two sites' tokens: the right shape (64 hex), never real values. */
const TOKEN = '0123456789abcdef'.repeat(4);
const OTHER_SITE_TOKEN = 'fedcba9876543210'.repeat(4);

function patched(ingestToken = TOKEN, { quiet = true } = {}) {
  const bp = masterBlueprint();
  patchPostCallBlueprint(bp, {
    baseId: 'appCLIENTbase0001',
    siteTag: null,
    ingestToken,
    masterMap: masterFieldMap(),
    clientMap: fieldMapFromSpec(CALL_LOG_FIELDS, { tableId: 'tblCLIENT00000001' }),
    quiet,
  });
  return bp;
}

const httpOf = (bp) => bp.flow.find((m) => (m.module ?? '').startsWith('http'));

test('the recorded master posts form-encoded to the agency, with a placeholder token', () => {
  // The contract the patcher relies on. If someone edits the master in the UI, this says how.
  const m = httpOf(masterBlueprint())?.mapper;
  assert.ok(m, 'the master has no configured HTTP module');
  assert.equal(m.method, 'post');
  assert.match(m.url, /^https:\/\/www\.[^/]+\/api\/ingest\/call$/);
  assert.equal(m.contentType, 'urlEncoded');
  assert.equal(m.stopOnHttpError, false);
  assert.deepEqual(m.urlEncodedBodyContent.map((f) => f.name), ['call_id', 'caller_name', 'caller_priority', 'caller_number']);
  assert.deepEqual(m.headers, [{ name: 'Authorization', value: 'Bearer REPLACE_PER_CLIENT' }], 'never a real token in the master');
  assert.equal(masterBlueprint().flow.filter((x) => (x.module ?? '').startsWith('twilio')).length, 0);
});

test('a patched clone passes: no Twilio, one HTTP module carrying this site’s token', () => {
  const c = checkOwnerBriefViaAgency({ blueprint: patched(), ingestToken: TOKEN });
  assert.equal(c.ok, true, c.detail);
});

test('THE REGRESSION: a clone with no way to brief the owner fails', () => {
  // The growth fixture's shape on 2026-11-03: webhook → Airtable, nothing after it.
  const bp = patched();
  bp.flow = bp.flow.filter((m) => !(m.module ?? '').startsWith('http'));
  const c = checkOwnerBriefViaAgency({ blueprint: bp, ingestToken: TOKEN });
  assert.equal(c.ok, false);
  assert.match(c.detail, /no end-of-call text/);
});

test('a clone that still texts from Make fails — the owner would be texted twice, under stale consent', () => {
  const bp = patched();
  bp.flow.push({ id: 99, module: 'twilio:SendSMS', version: 2, mapper: {} });
  const c = checkOwnerBriefViaAgency({ blueprint: bp, ingestToken: TOKEN });
  assert.equal(c.ok, false);
  assert.match(c.detail, /Twilio/);
});

test('the patcher removes a Twilio module a master might still carry', () => {
  const bp = masterBlueprint();
  bp.flow.push({ id: 99, module: 'twilio:SendSMS', version: 2, mapper: {} });
  patchPostCallBlueprint(bp, { baseId: 'appX', ingestToken: TOKEN, quiet: true });
  assert.equal(bp.flow.filter((m) => (m.module ?? '').startsWith('twilio')).length, 0);
});

test('an unpatched clone — the master placeholder still in place — fails', () => {
  const c = checkOwnerBriefViaAgency({ blueprint: masterBlueprint(), ingestToken: TOKEN });
  assert.equal(c.ok, false);
  assert.match(c.detail, /401/);
});

test('another site’s token fails: the agency would brief the wrong owner, or none', () => {
  const c = checkOwnerBriefViaAgency({ blueprint: patched(OTHER_SITE_TOKEN), ingestToken: TOKEN });
  assert.equal(c.ok, false);
});

test('a GET fails — the module first saved as GET, and the agency only accepts POST', () => {
  const bp = patched();
  httpOf(bp).mapper.method = 'get';
  assert.equal(checkOwnerBriefViaAgency({ blueprint: bp, ingestToken: TOKEN }).ok, false);
});

test('the apex host fails — it 307-redirects and drops the bearer token', () => {
  const bp = patched();
  httpOf(bp).mapper.url = 'https://juneaudigitaldesigns.com/api/ingest/call';
  assert.equal(checkOwnerBriefViaAgency({ blueprint: bp, ingestToken: TOKEN }).ok, false);
});

test('"evaluate all states as errors" fails — repeated errors deactivate the scenario and the call log', () => {
  const bp = patched();
  httpOf(bp).mapper.stopOnHttpError = true;
  assert.equal(checkOwnerBriefViaAgency({ blueprint: bp, ingestToken: TOKEN }).ok, false);
});

test('no blueprint is "could not check", never a pass', () => {
  assert.equal(checkOwnerBriefViaAgency({ blueprint: null, ingestToken: TOKEN }).ok, null);
});

test('the token is never printed — not by the patcher, not in any check detail', () => {
  const lines = [];
  const saved = { log: console.log, warn: console.warn, error: console.error };
  console.log = console.warn = console.error = (...a) => lines.push(a.join(' '));
  try {
    patched(TOKEN, { quiet: false });
  } finally {
    Object.assign(console, saved);
  }
  const details = [
    checkOwnerBriefViaAgency({ blueprint: patched(), ingestToken: TOKEN }),
    checkOwnerBriefViaAgency({ blueprint: patched(OTHER_SITE_TOKEN), ingestToken: TOKEN }),
    checkOwnerBriefViaAgency({ blueprint: masterBlueprint(), ingestToken: TOKEN }),
  ].map((c) => c.detail);
  for (const text of [...lines, ...details]) {
    assert.ok(!text.includes(TOKEN) && !text.includes(OTHER_SITE_TOKEN), `token leaked: ${text}`);
    assert.doesNotMatch(text, /FAIL:/);
  }
});
