import { NextResponse } from 'next/server';
import { isLoopback } from '@/lib/loopback';
import { agencyOrders } from '@/lib/salesOrders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * One order, as the Payment step polls it. Goes to the agency rather than KV on purpose: the
 * agency's GET also checks Stripe when the webhook is late, and fulfils a paid session there.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  if (!isLoopback(req)) return NextResponse.json({ error: 'Available on localhost only.' }, { status: 403 });
  const out = await agencyOrders(`/${encodeURIComponent(params.id)}`);
  return NextResponse.json(out.body, { status: out.status });
}
