import { NextResponse } from 'next/server';
import { runStripeGoLive } from '@/lib/goLive/stripePrices';
import { appendAudit } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { dryRun?: boolean };
  const dryRun = body.dryRun !== false;
  const result = await runStripeGoLive(dryRun);

  if (!dryRun) {
    appendAudit({
      slug: '_go-live',
      action: 'go-live.stripe-prices',
      ok: result.ok,
      summary: `Stripe live prices ${result.ok ? 'created' : 'failed'}`,
      detail: { priceIds: result.captured?.map((c) => c.value) ?? [] },
    });
  }
  return NextResponse.json(result);
}
