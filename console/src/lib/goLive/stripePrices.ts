import 'server-only';
import Stripe from 'stripe';
import { readOpsEnv } from './env';
import type { GoLiveResult } from './types';

/**
 * Recreate the test products/prices in LIVE mode, mirroring their amounts exactly.
 *
 * Two keys are involved and they are deliberately separate:
 *   - a TEST key to READ the amounts/intervals to mirror (whatever is on the test prices today)
 *   - a LIVE key to WRITE the live products/prices
 *
 * Resolution (from jdd-ops/.env):
 *   test  = STRIPE_TEST_SECRET_KEY, else STRIPE_SECRET_KEY when it's an sk_test_ key
 *   live  = STRIPE_LIVE_SECRET_KEY, else STRIPE_SECRET_KEY when it's an sk_live_ key
 *
 * So for the one-time run you add STRIPE_LIVE_SECRET_KEY alongside the existing test key, run
 * it, paste the four returned IDs, then drop STRIPE_LIVE_SECRET_KEY.
 *
 * Idempotent: a live product is matched by name (created once), and a live price is reused
 * when one already exists on that product with the same amount + interval — so a re-run
 * reports the existing IDs instead of duplicating.
 */

const API = '2025-10-29.clover' as Stripe.LatestApiVersion;

interface TierSpec {
  key: string; // the env var name to emit
  tier: 'starter' | 'growth' | 'enterprise';
  kind: 'monthly' | 'onboarding';
}

const SPECS: TierSpec[] = [
  { key: 'STRIPE_PRICE_STARTER_MONTHLY', tier: 'starter', kind: 'monthly' },
  { key: 'STRIPE_PRICE_STARTER_ONBOARDING', tier: 'starter', kind: 'onboarding' },
  { key: 'STRIPE_PRICE_GROWTH_MONTHLY', tier: 'growth', kind: 'monthly' },
  { key: 'STRIPE_PRICE_ENTERPRISE_MONTHLY', tier: 'enterprise', kind: 'monthly' },
];

function resolveKeys(ops: Record<string, string>) {
  const s = ops.STRIPE_SECRET_KEY ?? '';
  const test = ops.STRIPE_TEST_SECRET_KEY || (s.startsWith('sk_test_') ? s : '');
  const live = ops.STRIPE_LIVE_SECRET_KEY || (s.startsWith('sk_live_') ? s : '');
  return { test, live };
}

export async function runStripeGoLive(dryRun: boolean): Promise<GoLiveResult> {
  const ops = readOpsEnv();
  const { test, live } = resolveKeys(ops);

  if (!test) {
    return { ok: false, dryRun, error: 'No test key: set STRIPE_TEST_SECRET_KEY (or keep the sk_test_ key in STRIPE_SECRET_KEY) so amounts can be read.' };
  }

  const testClient = new Stripe(test, { apiVersion: API });
  const liveClient = live ? new Stripe(live, { apiVersion: API }) : null;

  const lines: string[] = [];
  const captured: { label: string; value: string }[] = [];
  let anyFailed = false;

  for (const spec of SPECS) {
    const testPriceId = ops[spec.key];
    if (!testPriceId) {
      lines.push(`✗ ${spec.key}: no test price id in jdd-ops/.env`);
      anyFailed = true;
      continue;
    }

    let price: Stripe.Price;
    try {
      price = await testClient.prices.retrieve(testPriceId, { expand: ['product'] });
    } catch {
      lines.push(`✗ ${spec.key}: could not read test price ${testPriceId} (wrong key/mode?)`);
      anyFailed = true;
      continue;
    }

    const amount = price.unit_amount ?? 0;
    const currency = price.currency;
    const interval = price.recurring?.interval ?? null;
    const product = price.product as Stripe.Product;
    const productName = product?.name ?? `JDD ${spec.tier} ${spec.kind}`;
    const human = `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}${interval ? `/${interval}` : ' one-time'}`;

    if (dryRun || !liveClient) {
      lines.push(`• ${spec.key}: would create "${productName}" — ${human}`);
      continue;
    }

    // ── Ensure the live product (matched by name, created once) ──
    let liveProduct: Stripe.Product | undefined;
    const products = await liveClient.products.list({ active: true, limit: 100 });
    liveProduct = products.data.find((p) => p.name === productName);
    if (!liveProduct) {
      liveProduct = await liveClient.products.create({
        name: productName,
        metadata: { jdd_tier: spec.tier, jdd_kind: spec.kind },
      });
    }

    // ── Ensure the live price (reused when amount+interval already match) ──
    const existing = await liveClient.prices.list({ product: liveProduct.id, active: true, limit: 100 });
    const match = existing.data.find(
      (p) => p.unit_amount === amount && p.currency === currency && (p.recurring?.interval ?? null) === interval,
    );
    const livePrice =
      match ??
      (await liveClient.prices.create({
        product: liveProduct.id,
        unit_amount: amount,
        currency,
        ...(interval ? { recurring: { interval: interval as Stripe.PriceCreateParams.Recurring.Interval } } : {}),
        metadata: { jdd_tier: spec.tier, jdd_kind: spec.kind },
      }));

    lines.push(`✓ ${spec.key}: ${livePrice.id}  (${human})${match ? ' [existing]' : ' [created]'}`);
    captured.push({ label: spec.key, value: livePrice.id });
  }

  if (dryRun) {
    return {
      ok: !anyFailed,
      dryRun: true,
      title: 'Stripe live prices — preview',
      summary: liveClient
        ? 'Preview only. Confirm to create these in live mode.'
        : 'Preview only (no live key found yet — add STRIPE_LIVE_SECRET_KEY to run for real).',
      lines,
    };
  }

  if (!liveClient) {
    return { ok: false, dryRun: false, error: 'No live key: add STRIPE_LIVE_SECRET_KEY to jdd-ops/.env for the real run.' };
  }

  return {
    ok: !anyFailed,
    dryRun: false,
    title: 'Stripe live prices',
    summary: 'Paste these into the agency env (and jdd-ops/.env via env-sync).',
    lines,
    captured,
  };
}
