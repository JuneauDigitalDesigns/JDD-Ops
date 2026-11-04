import { NextResponse } from 'next/server';
import { isLoopback } from '@/lib/loopback';
import { agencyOrders } from '@/lib/salesOrders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Plan prices for the Order step, from the agency's Schedule A. The console keeps no copy. */
export async function GET(req: Request) {
  if (!isLoopback(req)) return NextResponse.json({ error: 'Available on localhost only.' }, { status: 403 });
  const out = await agencyOrders('/prices');
  return NextResponse.json(out.body, { status: out.status });
}
