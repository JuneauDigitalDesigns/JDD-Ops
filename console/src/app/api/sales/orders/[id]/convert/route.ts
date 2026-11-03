import { NextResponse } from 'next/server';
import { isLoopback } from '@/lib/loopback';
import { agencyOrders } from '@/lib/salesOrders';
import { convertPaidOrder } from '@/lib/closeConvert';
import { zOperatorOrder } from '@jdd/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The Setup step: once the agency reports the order paid, create the client folder and mark the
 * lead won. The order is fetched from the agency (not taken from the browser), so a request can
 * only ever convert what was actually paid for.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!isLoopback(req)) return NextResponse.json({ error: 'Available on localhost only.' }, { status: 403 });

  const got = await agencyOrders(`/${encodeURIComponent(params.id)}`);
  const parsed = zOperatorOrder.safeParse(got.body.order);
  if (got.status >= 300 || !parsed.success) {
    return NextResponse.json({ error: String(got.body.error ?? 'Could not read the order.') }, { status: got.status >= 300 ? got.status : 502 });
  }
  const result = await convertPaidOrder(parsed.data);
  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
