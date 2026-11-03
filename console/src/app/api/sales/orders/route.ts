import { NextResponse } from 'next/server';
import { isLoopback } from '@/lib/loopback';
import { agencyOrders } from '@/lib/salesOrders';
import { appendAudit } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Create or update the draft order for a lead (the wizard's Order step).
 *
 * A proxy: the order is the agency's record, written by the agency. This route exists so the
 * browser never holds `OPS_ORDERS_SECRET`, and so every write lands in the console's audit log.
 */
export async function POST(req: Request) {
  if (!isLoopback(req)) return NextResponse.json({ error: 'Available on localhost only.' }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });

  const out = await agencyOrders('', { method: 'POST', body });
  const slug = typeof body.siteSlug === 'string' ? body.siteSlug : 'unknown';
  appendAudit({
    slug,
    action: 'close.order',
    ok: out.status < 300,
    summary: out.status < 300 ? 'Order saved' : `Order save failed: ${String(out.body.error ?? out.status)}`,
    detail: { step: 'order', plan: String(body.plan ?? '') },
  });
  return NextResponse.json(out.body, { status: out.status });
}

/** `?leadId=` — the lead's order, straight from the agency. */
export async function GET(req: Request) {
  if (!isLoopback(req)) return NextResponse.json({ error: 'Available on localhost only.' }, { status: 403 });
  const leadId = new URL(req.url).searchParams.get('leadId')?.trim();
  if (!leadId) return NextResponse.json({ error: 'leadId is required.' }, { status: 400 });
  const out = await agencyOrders(`?leadId=${encodeURIComponent(leadId)}`);
  return NextResponse.json(out.body, { status: out.status });
}
