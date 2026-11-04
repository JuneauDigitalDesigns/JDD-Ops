import { NextResponse } from 'next/server';
import { zOperatorOrder } from '@jdd/schema';
import { isLoopback } from '@/lib/loopback';
import { agencyOrders } from '@/lib/salesOrders';
import { convertPaidOrder } from '@/lib/closeConvert';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Finish any close a client paid for after the call, from the link.
 *
 * The agency fulfils the payment on its own (portal site, invite, welcome email) whether or not
 * the console is open, but only the console can create `clients/<slug>/` on this disk. The Leads
 * page calls this on load, so a client who paid overnight is a client by the time you look.
 */
export async function POST(req: Request) {
  if (!isLoopback(req)) return NextResponse.json({ error: 'Available on localhost only.' }, { status: 403 });

  const listed = await agencyOrders('?status=paid,fulfilled&unconverted=1');
  if (listed.status >= 300) return NextResponse.json(listed.body, { status: listed.status });

  const orders = Array.isArray(listed.body.orders) ? listed.body.orders : [];
  const converted: string[] = [];
  const failed: string[] = [];
  for (const raw of orders) {
    const parsed = zOperatorOrder.safeParse(raw);
    if (!parsed.success) continue;
    const result = await convertPaidOrder(parsed.data);
    (result.ok ? converted : failed).push(parsed.data.siteSlug);
  }
  return NextResponse.json({ ok: true, converted, failed });
}
