// The billing drift check's price rule (src/lib/planPrices.ts, used by reconcileBilling.ts).
//
// It used to know only each tier's MONTHLY price, so every annual client — billed exactly right
// on the annual price — got a red "Recorded as growth, paying for (unrecognised price)" finding
// telling the operator the portal was gating them on the wrong tier. On that code the first test
// fails: the annual price was not a price of any plan.
//
// Run: npm test   (node's built-in runner, via tsx for the .ts imports)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planForPrice, planPricesFromEnv, pricesFor } from '../src/lib/planPrices.ts';

const env = {
  STRIPE_PRICE_STARTER_MONTHLY: 'price_s_m',
  STRIPE_PRICE_STARTER_ANNUAL: 'price_s_y',
  STRIPE_PRICE_GROWTH_MONTHLY: 'price_g_m',
  STRIPE_PRICE_GROWTH_ANNUAL: 'price_g_y',
  STRIPE_PRICE_ENTERPRISE_MONTHLY: 'price_e_m',
};

test('an annual client on the annual price is not drifting', () => {
  const map = planPricesFromEnv(env);
  assert.ok(pricesFor(map, 'growth').includes('price_g_y'));
  assert.equal(planForPrice(map, 'price_g_y'), 'growth');
});

test('a client paying for another tier is still drift, monthly or annual', () => {
  const map = planPricesFromEnv(env);
  // Recorded Starter, paying the Growth annual price: still the incident the check exists for.
  assert.equal(pricesFor(map, 'starter').includes('price_g_y'), false);
  assert.equal(planForPrice(map, 'price_g_y'), 'growth');
  assert.equal(planForPrice(map, 'price_unknown'), null);
});

test('a missing annual price narrows the check instead of breaking it', () => {
  const map = planPricesFromEnv(env);
  assert.deepEqual(pricesFor(map, 'enterprise'), ['price_e_m']);
});
