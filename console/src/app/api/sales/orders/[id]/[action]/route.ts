import { NextResponse } from 'next/server';
import { isLoopback } from '@/lib/loopback';
import { agencyOrders } from '@/lib/salesOrders';
import { appendAudit } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The order's write actions, each a one-to-one proxy of the agency route of the same name.
 * An allowlist, not a pass-through: this path can only reach the actions named here.
 */
const ACTIONS = new Set(['accept-terms', 'agreement-link', 'payment', 'resend-link', 'resend-invite', 'cancel']);

export async function POST(req: Request, { params }: { params: { id: string; action: string } }) {
  if (!isLoopback(req)) return NextResponse.json({ error: 'Available on localhost only.' }, { status: 403 });
  if (!ACTIONS.has(params.action)) return NextResponse.json({ error: 'Unknown action.' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const out = await agencyOrders(`/${encodeURIComponent(params.id)}/${params.action}`, { method: 'POST', body });

  const order = out.body.order as { siteSlug?: string } | undefined;
  appendAudit({
    slug: order?.siteSlug ?? 'unknown',
    action: 'close.order',
    ok: out.status < 300,
    summary: out.status < 300 ? `Order: ${params.action}` : `Order ${params.action} failed: ${String(out.body.error ?? out.status)}`,
    // The action and order id only. The terms hashes, email and phone stay out of the log.
    detail: { step: params.action, orderId: params.id },
  });
  return NextResponse.json(out.body, { status: out.status });
}
