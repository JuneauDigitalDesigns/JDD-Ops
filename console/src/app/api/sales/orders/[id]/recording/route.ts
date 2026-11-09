import { NextResponse } from 'next/server';
import { isLoopback } from '@/lib/loopback';
import { loadPortalOpsConfig } from '@/lib/opsSecrets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The attached call recording, streamed through from the agency so it is never held in memory. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  if (!isLoopback(req)) return NextResponse.json({ error: 'Available on localhost only.' }, { status: 403 });
  const { baseUrl, ordersSecret } = loadPortalOpsConfig();
  if (!baseUrl || !ordersSecret) return NextResponse.json({ error: 'The agency connection is not configured.' }, { status: 500 });
  try {
    const res = await fetch(`${baseUrl}/api/ops/orders/${encodeURIComponent(params.id)}/recording/file`, {
      headers: { 'x-ops-secret': ordersSecret },
      cache: 'no-store',
    });
    if (!res.ok || !res.body) return NextResponse.json({ error: 'Could not load the recording.' }, { status: res.status });
    const headers = new Headers({ 'cache-control': 'no-store' });
    for (const h of ['content-type', 'content-length', 'content-disposition']) {
      const v = res.headers.get(h);
      if (v) headers.set(h, v);
    }
    return new Response(res.body, { headers });
  } catch {
    return NextResponse.json({ error: 'Could not reach the agency app.' }, { status: 502 });
  }
}
