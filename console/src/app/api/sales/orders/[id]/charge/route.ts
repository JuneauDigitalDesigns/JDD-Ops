import { NextResponse } from 'next/server';
import { isLoopback } from '@/lib/loopback';
import { agencyOrders } from '@/lib/salesOrders';
import { appendAudit } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The card path's charge, proxied to the agency's `/api/ops/orders/{id}/charge`. The console
 * never talks to Stripe: GET reads back the card the operator added in the Dashboard (brand and
 * last 4 only) and the order's amount; POST charges exactly that amount, which the agency
 * re-derives and refuses to change.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  if (!isLoopback(req)) return NextResponse.json({ error: 'Available on localhost only.' }, { status: 403 });
  const out = await agencyOrders(`/${encodeURIComponent(params.id)}/charge`);
  return NextResponse.json(out.body, { status: out.status });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!isLoopback(req)) return NextResponse.json({ error: 'Available on localhost only.' }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { amountCents?: unknown };
  // Only the amount travels. Nothing about the card is ever sent from here.
  const out = await agencyOrders(`/${encodeURIComponent(params.id)}/charge`, {
    method: 'POST',
    body: { amountCents: body.amountCents },
  });

  const order = out.body.order as { siteSlug?: string } | undefined;
  const outcome = String(out.body.outcome ?? (out.status < 300 ? 'paid' : 'refused'));
  appendAudit({
    slug: order?.siteSlug ?? 'unknown',
    action: 'close.order',
    ok: out.status < 300,
    summary: out.status < 300 ? 'Order: card charged' : `Order charge ${outcome}: ${String(out.body.error ?? out.status)}`,
    // The order id and outcome only. Card brand and last 4 stay out of the log.
    detail: { step: 'charge', orderId: params.id, outcome },
  });
  return NextResponse.json(out.body, { status: out.status });
}
