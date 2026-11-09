// The Stripe account needs a Terms of service URL before any payment link can be opened: operator
// links require the client's tick on Stripe's page, and Stripe refuses the session without one.
// The 2026-11-08 test run hit it in the sandbox, and neither the go-live wizard nor preflight
// mentioned it, so the first live call would have found out. Stripe's API doesn't expose the
// setting, so it is a wizard step plus a grey preflight line: never reported as a pass.
//
// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildGoLive } from '../src/lib/go-live-content.ts';

test('the go-live wizard has the step, before the live prices, with the URL to paste', () => {
  const steps = buildGoLive().flatMap((p) => p.steps ?? []);
  const at = steps.findIndex((s) => s.id === 'stripe-tos-url');
  assert.ok(at >= 0, 'the step exists');
  assert.ok(at < steps.findIndex((s) => s.id === 'stripe-prices'));
  const copy = steps[at].blocks.find((b) => b.t === 'copy');
  assert.match(copy.value, /\/terms$/);
  assert.ok(steps[at].blocks.some((b) => b.t === 'link' && /settings\/public/.test(b.href)));
});

test('preflight names it and never claims it passed', () => {
  const src = readFileSync(new URL('../src/lib/goLive/preflight.ts', import.meta.url), 'utf8');
  assert.match(src, /label: 'Stripe Terms of service URL set',\s*ok: null,/);
});
