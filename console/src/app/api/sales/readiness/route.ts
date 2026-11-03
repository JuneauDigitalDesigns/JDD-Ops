import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { ORDERS_INDEX_KEY, isOrderPaid, resumeStepFor, type ReadinessLight } from '@jdd/schema';
import { isLoopback } from '@/lib/loopback';
import { loadKvCredentials } from '@/lib/opsSecrets';
import { a2pSummary, readOrder, readinessForOrder } from '@/lib/salesOrders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface ClientReadiness {
  orderId: string;
  leadId: string;
  lights: ReadinessLight[];
  /** Where Resume would open; null when the close is finished. */
  resumeStep: string | null;
  /** Resend invite is offered while the invite is out and the client hasn't signed in. */
  canResendInvite: boolean;
}

/**
 * Readiness for every client closed on a call, keyed by Site ID, for the roster cards.
 *
 * Read-only and local: the orders are read from KV, the portal account and the A2P record from
 * the stores the console already reads. No Stripe, Twilio or agency call per card.
 */
export async function GET(req: Request) {
  if (!isLoopback(req)) return NextResponse.json({ error: 'Available on localhost only.' }, { status: 403 });

  loadKvCredentials();
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return NextResponse.json({ readiness: {} });

  const ids = await new Redis({ url, token }).zrange<string[]>(ORDERS_INDEX_KEY, 0, -1, { rev: true });
  const out: Record<string, ClientReadiness> = {};
  for (const id of ids) {
    const order = await readOrder(id);
    // Newest first, so the first order seen for a slug is the one that counts.
    if (!order || order.status === 'cancelled' || out[order.siteSlug]) continue;
    const [lights, a2p] = await Promise.all([readinessForOrder(order), a2pSummary(order.siteSlug)]);
    const step = resumeStepFor({ order, a2pStatus: a2p.status });
    const onboarding = lights.find((l) => l.id === 'onboarding');
    out[order.siteSlug] = {
      orderId: order.id,
      leadId: order.leadId,
      lights,
      resumeStep: step === 'done' ? null : step,
      canResendInvite:
        isOrderPaid(order.status) && order.invite?.kind === 'invitation' && onboarding?.value === 'Invite sent',
    };
  }
  return NextResponse.json({ readiness: out });
}
