// The pure guards around "close a client on a sales call".
//
// The resume step and the readiness lights are tested once, in @jdd/schema, where they live —
// the wizard, the roster and the agency all import that single implementation. What lives here
// are the two rules the console applies on its own before it ever calls the agency.
//
// Run: npm test   (node's built-in runner, via tsx for the .ts imports)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkSiteId } from '../src/lib/siteId.ts';
import { isLoopback } from '../src/lib/loopback.ts';

test('checkSiteId: an underscore is refused', () => {
  // Vercel REMOVES characters that aren't valid in a DNS label, so `rivera_plumbing` serves at
  // `riveraplumbing.vercel.app`. Three call sites once derived the host with `_ → -` and pointed
  // a client's voiceUrl at a hostname that does not resolve. A Site ID chosen on a call is locked
  // for good, so it must never be able to carry one.
  assert.ok(checkSiteId('rivera_plumbing'));
  assert.ok(checkSiteId('Rivera-Plumbing'));
  assert.ok(checkSiteId('rivera--plumbing'));
  assert.ok(checkSiteId('-rivera'));
  assert.ok(checkSiteId(''));
  assert.equal(checkSiteId('rivera-plumbing'), null);
  assert.equal(checkSiteId('rivera2'), null);
});

test('isLoopback: only this machine may drive the close routes', () => {
  // The console has no auth; these routes open payment links and create accounts through the
  // agency. A request addressed to any other host is refused even though the server only binds
  // locally — an assumption isn't a control.
  const req = (host) => new Request('http://x/api/sales/orders', { headers: { host } });
  for (const host of ['localhost:3040', '127.0.0.1:3040', '[::1]:3040', 'console.localhost']) {
    assert.equal(isLoopback(req(host)), true, host);
  }
  for (const host of ['juneaudigitaldesigns.com', 'localhost.evil.com', '10.0.0.5:3040', '']) {
    assert.equal(isLoopback(req(host)), false, host);
  }
});
