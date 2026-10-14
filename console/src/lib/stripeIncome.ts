import 'server-only';
import Stripe from 'stripe';
import { loadStripeKey } from './opsSecrets';
import type { IncomeSnapshot, MonthIncome } from './financeTypes';

/**
 * Gross revenue and Stripe fees for a tax year, read from Stripe and bucketed by calendar month.
 *
 * ── Why balance transactions rather than charges ────────────────────────────────────────────
 *
 * A balance transaction carries `amount`, `fee`, and `net` together, so one pass yields both
 * numbers the tax math needs: gross revenue (what gets reported as income) and Stripe's cut
 * (a deductible business expense). Reading charges would give the gross and leave the fees to a
 * second, separately-paginated pass over a different resource.
 *
 * ── Why gross, not net ──────────────────────────────────────────────────────────────────────
 *
 * The owner reports the full amount a client paid as revenue and then deducts Stripe's fee as a
 * business expense. Netting the fee out first would reach a similar bottom line by accident while
 * misstating both halves — and would bury a genuine deduction. So `grossCents` is deliberately
 * pre-fee, and the fee is surfaced as its own expense line.
 *
 * Refunds arrive as their own negative-amount transactions and subtract from the month they were
 * issued in, not the month of the original charge. That matches cash-basis reporting, which is
 * what a sole proprietor on a calendar year files.
 *
 * ── Read-only, permanently ──────────────────────────────────────────────────────────────────
 *
 * This module calls `balanceTransactions.list` and nothing else. No create, update, or cancel
 * path belongs here: the console has no authentication of any kind, and `stripe-lookup` already
 * established that a write path behind no login is a different category of risk. The key resolver
 * prefers a restricted read-only key for the same reason.
 */

/** Transaction types that represent money earned or given back. */
const INCOME_TYPES = new Set(['charge', 'payment']);
const REFUND_TYPES = new Set(['refund', 'payment_refund']);

/** Thrown when the key works but lacks `balance_transaction:read`. Carries a fixable message. */
export class StripeScopeError extends Error {
  constructor() {
    super(
      'This Stripe key cannot read balance transactions. Add the `balance_transaction:read` ' +
        'permission to STRIPE_READONLY_KEY in the Stripe dashboard (Developers → API keys → ' +
        'edit the restricted key), then refresh.',
    );
    this.name = 'StripeScopeError';
  }
}

export class StripeNotConfiguredError extends Error {
  constructor() {
    super(
      'No Stripe key configured — set STRIPE_READONLY_KEY (preferred) or STRIPE_SECRET_KEY in ' +
        'jdd-ops/.env.',
    );
    this.name = 'StripeNotConfiguredError';
  }
}

/* ── Cache ──────────────────────────────────────────────────────────────────────────────────
 *
 * A year of transactions is several paginated round-trips, and the page re-reads on every tab
 * switch. A short in-process TTL makes navigation instant while keeping the data obviously fresh;
 * the UI shows an "as of" stamp and a refresh button rather than pretending it is live.
 *
 * In-memory is the right scope here: one operator, one local process, and a cache that simply
 * disappears on restart can never serve a stale number across a code change. It is NOT in KV
 * on purpose — persisting a cache of someone's revenue buys nothing and outlives its usefulness.
 */
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<number, IncomeSnapshot>();

/** Drop a cached year (or everything). Used by the refresh button's bypass path. */
export function invalidateIncomeCache(taxYear?: number): void {
  if (taxYear === undefined) cache.clear();
  else cache.delete(taxYear);
}

function emptyMonths(taxYear: number): MonthIncome[] {
  return Array.from({ length: 12 }, (_, i) => ({
    month: `${taxYear}-${String(i + 1).padStart(2, '0')}`,
    grossCents: 0,
    feesCents: 0,
  }));
}

/**
 * Aggregate one tax year.
 *
 * @param taxYear  calendar year — a sole proprietor's tax year is the calendar year
 * @param refresh  bypass the cache (the UI's refresh button)
 */
export async function getIncomeSnapshot(
  taxYear: number,
  refresh = false,
): Promise<IncomeSnapshot> {
  if (!refresh) {
    const hit = cache.get(taxYear);
    if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) return hit;
  }

  const { key, restricted } = loadStripeKey();
  if (!key) throw new StripeNotConfiguredError();

  const stripe = new Stripe(key, { typescript: true });

  // Unix seconds, UTC. `lte` is the last instant of December so a New Year's Eve charge lands in
  // the year it was actually earned.
  const gte = Math.floor(Date.UTC(taxYear, 0, 1) / 1000);
  const lte = Math.floor(Date.UTC(taxYear + 1, 0, 1) / 1000) - 1;

  const byMonth = new Map<string, MonthIncome>();
  for (const m of emptyMonths(taxYear)) byMonth.set(m.month, m);

  try {
    for await (const bt of stripe.balanceTransactions.list({
      created: { gte, lte },
      limit: 100,
    })) {
      const isIncome = INCOME_TYPES.has(bt.type);
      const isRefund = REFUND_TYPES.has(bt.type);
      if (!isIncome && !isRefund) continue;

      const month = new Date(bt.created * 1000).toISOString().slice(0, 7);
      const bucket = byMonth.get(month);
      if (!bucket) continue; // outside the requested year — shouldn't happen, but cheap to guard

      // Refund amounts are already negative, so a plain add handles both cases.
      bucket.grossCents += bt.amount;
      // Fees on a refund are typically 0; Stripe reports any fee reversal with its own sign.
      bucket.feesCents += bt.fee;
    }
  } catch (err) {
    // A restricted key missing the permission reports a permission error. Translate it into
    // something the operator can act on instead of a generic failure.
    const e = err as { type?: string; code?: string; statusCode?: number; message?: string };
    const permissionDenied =
      e?.type === 'StripePermissionError' ||
      e?.code === 'api_key_insufficient_scope' ||
      (e?.statusCode === 403 && /permission|scope/i.test(e?.message ?? ''));
    if (permissionDenied) throw new StripeScopeError();

    // Never surface the raw Stripe error — it can embed request details. Log it, raise a
    // generic one, same posture as the stripe-lookup route.
    console.error('[finances/stripeIncome] balance transaction read failed', err);
    throw new Error('Could not read income from Stripe. Check the server log.');
  }

  const snapshot: IncomeSnapshot = {
    taxYear,
    months: [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month)),
    fetchedAt: Date.now(),
    restricted,
  };
  cache.set(taxYear, snapshot);
  return snapshot;
}

/** Year-to-date totals from a snapshot. */
export function totalIncome(snapshot: IncomeSnapshot): { grossCents: number; feesCents: number } {
  return snapshot.months.reduce(
    (acc, m) => ({
      grossCents: acc.grossCents + m.grossCents,
      feesCents: acc.feesCents + m.feesCents,
    }),
    { grossCents: 0, feesCents: 0 },
  );
}

/** One month's figures, or zeroes when that month has no activity. */
export function monthIncome(snapshot: IncomeSnapshot, month: string): MonthIncome {
  return (
    snapshot.months.find((m) => m.month === month) ?? { month, grossCents: 0, feesCents: 0 }
  );
}
