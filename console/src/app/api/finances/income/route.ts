import { NextResponse } from 'next/server';
import {
  StripeNotConfiguredError,
  StripeScopeError,
  getIncomeSnapshot,
} from '@/lib/stripeIncome';
import { copyExpensesBetweenMonths, financeStoreConfigured } from '@/lib/financeStore';
import { guardLocal, isValidMonth } from '@/lib/financeGuard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET — gross income and Stripe fees for a tax year, bucketed by month.
 *
 *   ?year=2026     defaults to the current calendar year (a sole prop's tax year)
 *   ?refresh=1     bypass the cache; wired to the UI's refresh button
 *
 * A missing key or a key without `balance_transaction:read` returns 200 with an empty snapshot
 * and an actionable message, not a 5xx. The page is still useful without Stripe — expenses,
 * draws and reserve all work — so a Stripe problem should degrade that one panel rather than
 * take the screen down.
 */
export async function GET(req: Request) {
  const gate = guardLocal(req);
  if (gate) return gate;

  const url = new URL(req.url);
  const yearParam = url.searchParams.get('year');
  const taxYear = yearParam ? Number(yearParam) : new Date().getFullYear();
  if (!Number.isInteger(taxYear) || taxYear < 2000 || taxYear > 2100) {
    return NextResponse.json({ error: 'year must be a four-digit year.' }, { status: 400 });
  }
  const refresh = url.searchParams.get('refresh') === '1';

  try {
    return NextResponse.json({ snapshot: await getIncomeSnapshot(taxYear, refresh) });
  } catch (e) {
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: `${taxYear}-${String(i + 1).padStart(2, '0')}`,
      grossCents: 0,
      feesCents: 0,
    }));
    const empty = { taxYear, months, fetchedAt: Date.now(), restricted: false };

    if (e instanceof StripeScopeError || e instanceof StripeNotConfiguredError) {
      return NextResponse.json({ snapshot: empty, error: e.message }, { status: 200 });
    }
    console.error('[/api/finances/income] failed', e);
    return NextResponse.json(
      { snapshot: empty, error: 'Could not read income from Stripe. Check the server log.' },
      { status: 200 },
    );
  }
}

/**
 * POST — the "copy last month" action.
 *
 * It lives on the income route rather than the expenses route because it is a bulk operation
 * over a month, not CRUD on one entry, and giving it its own verb keeps the ledger route's POST
 * meaning exactly one thing: create one row.
 *
 * Deliberately not idempotent, and the UI confirms with a count first. Running it twice really
 * does produce two copies — which is the honest behaviour for a ledger, and recoverable with
 * delete. Silently de-duplicating would be worse: it would also swallow the legitimate case of
 * the same subscription genuinely being charged twice.
 */
export async function POST(req: Request) {
  const gate = guardLocal(req);
  if (gate) return gate;
  if (!financeStoreConfigured()) {
    return NextResponse.json({ error: 'Finances storage not configured.' }, { status: 503 });
  }

  let body: { action?: unknown; fromMonth?: unknown; toMonth?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  if (body.action !== 'copy-month') {
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  }
  if (!isValidMonth(body.fromMonth) || !isValidMonth(body.toMonth)) {
    return NextResponse.json(
      { error: 'fromMonth and toMonth must be YYYY-MM.' },
      { status: 400 },
    );
  }
  if (body.fromMonth === body.toMonth) {
    return NextResponse.json(
      { error: 'Source and destination months are the same.' },
      { status: 400 },
    );
  }

  try {
    const created = await copyExpensesBetweenMonths(body.fromMonth, body.toMonth);
    return NextResponse.json({ created, count: created.length });
  } catch (e) {
    console.error('[/api/finances/income] copy-month failed', e);
    return NextResponse.json({ error: 'Could not copy those expenses.' }, { status: 500 });
  }
}
