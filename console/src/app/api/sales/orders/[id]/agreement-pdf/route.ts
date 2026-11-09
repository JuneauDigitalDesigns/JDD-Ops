import { NextResponse } from 'next/server';
import { isLoopback } from '@/lib/loopback';
import { loadPortalOpsConfig } from '@/lib/opsSecrets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The accepted agreement as the client's own copy, for the close wizard's confirmation. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  if (!isLoopback(req)) return NextResponse.json({ error: 'Available on localhost only.' }, { status: 403 });
  const { baseUrl, ordersSecret } = loadPortalOpsConfig();
  if (!baseUrl || !ordersSecret) return NextResponse.json({ error: 'The agency connection is not configured.' }, { status: 500 });
  try {
    const res = await fetch(`${baseUrl}/api/ops/orders/${encodeURIComponent(params.id)}/agreement-pdf`, {
      headers: { 'x-ops-secret': ordersSecret },
      cache: 'no-store',
    });
    if (!res.ok) return NextResponse.json({ error: 'Could not load the agreement.' }, { status: res.status });
    return new NextResponse(await res.arrayBuffer(), {
      headers: { 'content-type': 'application/pdf', 'content-disposition': 'inline', 'cache-control': 'no-store' },
    });
  } catch {
    return NextResponse.json({ error: 'Could not reach the agency app.' }, { status: 502 });
  }
}
