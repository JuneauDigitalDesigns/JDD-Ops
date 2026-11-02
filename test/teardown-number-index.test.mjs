/**
 * Releasing a Twilio number must clear the portal's number→site index first.
 *
 * The bug this encodes is live in shipped code, not hypothetical.
 * `portal:number-owner:v1:{e164}` is how the agency site's inbound-SMS webhook decides whose
 * conversation a reply belongs to. The key has no account scope and no TTL, and Twilio
 * **recycles released numbers** — so a number released from one client and later reassigned
 * to an unrelated business routes that stranger's inbound SMS into the former client's
 * thread. The webhook finds an owner and believes it; nothing errors anywhere.
 *
 * The ordering is the fix: clear the index, and refuse to release if that fails. Keeping a
 * number costs ~$2/month and shows up on an invoice. Releasing one whose index survives
 * leaks a stranger's messages indefinitely and cannot be undone, because the number is gone
 * and cannot be re-acquired to discover who holds it now.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { releaseTwilioNumber } from '../lib/teardown-ops.js';

const NUMBER = '+14075550123';

test('no KV credentials means the number is NOT released', async () => {
  // Twilio credentials are present and valid-looking, so the only thing stopping the release
  // is the inability to clear the index. It must stop it.
  const res = await releaseTwilioNumber({
    accountSid: 'AC' + '0'.repeat(32),
    authToken: 'x'.repeat(32),
    phoneNumber: NUMBER,
    kvUrl: undefined,
    kvToken: undefined,
  });
  assert.equal(res.outcome, 'skipped', 'must not report the number as deleted');
  assert.match(res.message ?? '', /number-owner|KV/i, 'and must say why');
});

test('a failing index delete stops the release rather than proceeding', async () => {
  // A KV that answers 500. The release must not be attempted, and the step must come back as
  // a failure the operator can see — silently carrying on is what leaks the messages.
  const realFetch = globalThis.fetch;
  let kvCalls = 0;
  globalThis.fetch = async () => {
    kvCalls++;
    return new Response('upstream boom', { status: 500 });
  };
  try {
    const res = await releaseTwilioNumber({
      accountSid: 'AC' + '0'.repeat(32),
      authToken: 'x'.repeat(32),
      phoneNumber: NUMBER,
      kvUrl: 'https://kv.example.com',
      kvToken: 'token',
    });
    assert.equal(kvCalls, 1, 'the index delete must be attempted');
    assert.equal(res.outcome, 'failed');
    assert.match(res.message ?? '', /NOT released/, 'the operator must be told the number was kept');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('the index delete targets the number-owner key for that exact number', async () => {
  const realFetch = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    // Fail after recording, so the Twilio SDK is never reached from a unit test.
    return new Response('stop here', { status: 500 });
  };
  try {
    await releaseTwilioNumber({
      accountSid: 'AC' + '0'.repeat(32),
      authToken: 'x'.repeat(32),
      phoneNumber: NUMBER,
      kvUrl: 'https://kv.example.com/',
      kvToken: 'token',
    });
    assert.equal(urls.length, 1);
    assert.match(urls[0], /\/del\//, 'must be a delete');
    assert.ok(
      urls[0].includes(encodeURIComponent(NUMBER)) || urls[0].includes(NUMBER),
      `the key must name the number being released, got ${urls[0]}`,
    );
    assert.match(urls[0], /portal:number-owner:v1:/, 'and must be the index the webhook reads');
    // The trailing slash on kvUrl must not produce a double slash in the path.
    assert.ok(!urls[0].includes('com//'), `no double slash, got ${urls[0]}`);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('a missing phone number is still a skip, not an index delete', async () => {
  const realFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return new Response('', { status: 200 });
  };
  try {
    const res = await releaseTwilioNumber({
      accountSid: 'AC' + '0'.repeat(32),
      authToken: 'x'.repeat(32),
      phoneNumber: undefined,
      kvUrl: 'https://kv.example.com',
      kvToken: 'token',
    });
    assert.equal(res.outcome, 'skipped');
    assert.equal(called, false, 'nothing to un-index when there was no number');
  } finally {
    globalThis.fetch = realFetch;
  }
});
