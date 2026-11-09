import { NextResponse } from 'next/server';
import { isLoopback } from '@/lib/loopback';
import { agencyOrders, readPaidOrdersForSite } from '@/lib/salesOrders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The operator-closed agreements on this site, with their call and recording details. */
export async function GET(req: Request) {
  if (!isLoopback(req)) return NextResponse.json({ error: 'Available on localhost only.' }, { status: 403 });
  const site = new URL(req.url).searchParams.get('site');
  if (!site) return NextResponse.json({ error: 'site is required.' }, { status: 400 });

  const orders = await readPaidOrdersForSite(site);
  const agreements = [];
  for (const order of orders) {
    const out = await agencyOrders(`/${encodeURIComponent(order.id)}`);
    if (out.status >= 300) return NextResponse.json({ error: String(out.body.error ?? 'Could not read the agreement.') }, { status: out.status });
    if (out.body.agreement) agreements.push({ orderId: order.id, agreement: out.body.agreement });
  }
  return NextResponse.json({ agreements });
}
