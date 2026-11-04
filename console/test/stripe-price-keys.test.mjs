// Every Stripe price, in one list (src/lib/stripePriceKeys.ts).
//
// The go-live price copier carried its own hand-written list of 4: Starter, Growth and
// Enterprise monthly plus Starter onboarding. The agency sells on 9 (each plan × monthly,
// annual and onboarding), so a go-live run would have left annual checkout and the Growth and
// Enterprise onboarding fees on test-mode price ids. Env sync, preflight and the go-live
// wizard's env rows had their own copies too, each a different length. On that code the first
// two tests fail (no shared list, 4 rows in the wizard) and the third finds the literals.
//
// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STRIPE_PRICE_KEYS, STRIPE_PRICE_SPECS } from '../src/lib/stripePriceKeys.ts';
import { buildGoLive } from '../src/lib/go-live-content.ts';

const NINE = [
  'STRIPE_PRICE_STARTER_MONTHLY',
  'STRIPE_PRICE_STARTER_ANNUAL',
  'STRIPE_PRICE_STARTER_ONBOARDING',
  'STRIPE_PRICE_GROWTH_MONTHLY',
  'STRIPE_PRICE_GROWTH_ANNUAL',
  'STRIPE_PRICE_GROWTH_ONBOARDING',
  'STRIPE_PRICE_ENTERPRISE_MONTHLY',
  'STRIPE_PRICE_ENTERPRISE_ANNUAL',
  'STRIPE_PRICE_ENTERPRISE_ONBOARDING',
];

test('every plan has a monthly, an annual and an onboarding price', () => {
  assert.deepEqual([...STRIPE_PRICE_KEYS].sort(), [...NINE].sort());
  for (const s of STRIPE_PRICE_SPECS) {
    assert.equal(s.key, `STRIPE_PRICE_${s.tier.toUpperCase()}_${s.kind.toUpperCase()}`);
  }
});

test('the go-live wizard asks for all nine live price ids', () => {
  const step = buildGoLive()
    .flatMap((p) => p.steps ?? [])
    .find((s) => s.id === 'stripe-prices');
  assert.ok(step, 'the stripe-prices step exists');
  const env = step.blocks.find((b) => b.t === 'env');
  assert.deepEqual(env.vars.map((v) => v.key).sort(), [...NINE].sort());
});

test('the copier, env sync and preflight take the list from one place', () => {
  for (const file of ['goLive/stripePrices.ts', 'goLive/envSync.ts', 'goLive/preflight.ts', 'go-live-content.ts']) {
    const src = readFileSync(new URL(`../src/lib/${file}`, import.meta.url), 'utf8');
    assert.match(src, /from '\.\.?\/stripePriceKeys'/, `${file} imports the shared list`);
    assert.doesNotMatch(src, /'STRIPE_PRICE_[A-Z]+_[A-Z]+'/, `${file} has no hand-written price key`);
  }
});
