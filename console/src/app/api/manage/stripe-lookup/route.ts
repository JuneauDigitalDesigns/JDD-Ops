import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { loadStripeKey } from '@/lib/opsSecrets';

/**
 * Find a client's Stripe subscriptions by account email, so /manage → Portal can repair a
 * lost `stripeSubscriptionId` without an operator hand-copying ids out of the dashboard.
 *
 * **Read-only, permanently.** This route calls `customers.list` and `subscriptions.list`
 * and nothing else. There is no create, update, or cancel path here and none should ever
 * be added: the console has no authentication whatsoever, and a write path to Stripe
 * behind no login is a different category of risk from a read path.
 *
 * Two guards make that stance real rather than aspirational:
 *
 *   1. A loopback check on every request. `CLAUDE.md` records a "localhost-only
 *      assumption" for /api/manage/env/reveal with no code enforcing it; an assumption is
 *      not a control, so this one is checked.
 *   2. A preference for a restricted read-only key (`STRIPE_READONLY_KEY`) over the live
 *      secret, surfaced to the UI so an operator can see which one is in play.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * True only when the request came from this machine.
 *
 * Host is attacker-controllable in general, but that cuts the safe way here: a forged Host
 * can only ever cause a *rejection*, never an acceptance of a genuinely remote request that
 * arrived with a loopback Host — and if the console is ever exposed, the operator's own
 * browser will be sending the public hostname and get a 403, which is the intent.
 */
function isLoopback(req: Request): boolean {
  const host = (req.headers.get('host') ?? '').toLowerCase();
  const hostname = host.startsWith('[')
    ? host.slice(0, host.indexOf(']') + 1) // bracketed IPv6
    : host.split(':')[0];
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname === '::1' ||
    hostname.endsWith('.localhost')
  );
}

export async function GET(req: Request) {
  if (!isLoopback(req)) {
    return NextResponse.json(
      { error: 'Stripe lookup is available on localhost only.' },
      { status: 403 },
    );
  }

  const email = (new URL(req.url).searchParams.get('email') ?? '').trim();
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 });
  }

  const { key, restricted } = loadStripeKey();
  if (!key) {
    return NextResponse.json(
      {
        error:
          'No Stripe key configured — set STRIPE_READONLY_KEY (preferred) or STRIPE_SECRET_KEY in jdd-ops/.env.',
      },
      { status: 500 },
    );
  }

  const stripe = new Stripe(key, { typescript: true });

  try {
    const customers = await stripe.customers.list({ email, limit: 5 });
    if (customers.data.length === 0) {
      return NextResponse.json({ ok: true, restricted, customers: [] });
    }

    const results = [];
    for (const customer of customers.data) {
      const subs = await stripe.subscriptions.list({
        customer: customer.id,
        status: 'all',
        limit: 10,
      });
      results.push({
        customerId: customer.id,
        customerName: customer.name ?? null,
        subscriptions: subs.data.map((s) => {
          const price = s.items.data[0]?.price;
          const periods = s as unknown as { current_period_end: number };
          return {
            id: s.id,
            status: s.status,
            nickname: price?.nickname ?? null,
            amount: price?.unit_amount ?? null,
            currency: price?.currency ?? null,
            interval: price?.recurring?.interval ?? null,
            currentPeriodEnd: periods.current_period_end * 1000,
          };
        }),
      });
    }

    return NextResponse.json({ ok: true, restricted, customers: results });
  } catch (err) {
    // Never echo the Stripe error verbatim — it can embed request details we'd rather not
    // surface. The real one goes to the server log.
    console.error('[manage/stripe-lookup]', err);
    return NextResponse.json({ error: 'Stripe lookup failed. Check the server log.' }, { status: 502 });
  }
}
