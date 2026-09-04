import { NextResponse } from 'next/server';
import { runStripeWebhook } from '@/lib/goLive/stripeWebhook';
import { appendAudit } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { dryRun?: boolean };
  const dryRun = body.dryRun !== false;
  const result = await runStripeWebhook(dryRun);

  if (!dryRun) {
    appendAudit({
      slug: '_go-live',
      action: 'go-live.stripe-webhook',
      ok: result.ok,
      summary: `Stripe live webhook ${result.ok ? 'created' : 'failed'}`,
      detail: { keys: result.captured?.map((c) => c.label) ?? [] },
    });
  }
  return NextResponse.json(result);
}
