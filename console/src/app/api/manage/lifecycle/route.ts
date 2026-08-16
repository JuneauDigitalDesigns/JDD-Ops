import { NextResponse } from 'next/server';
import { deriveStage } from '@jdd/schema';
import { getClientContext } from '@/lib/clients';
import { clientRecordsConfigured, getClientRecordBySlug } from '@/lib/clientRecord';
import { accountStoreConfigured, getAccount } from '@/lib/accountStore';
import { reconcileStoreConfigured, getBreakageCount } from '@/lib/reconcileStore';

/**
 * The stage the lifecycle spine renders, and why.
 *
 * Reads the STORED stage from the client record rather than re-deriving from scratch: the
 * record is what a sweep wrote, and the spine showing a different answer from the sweep
 * that produced it would be a contradiction on the same screen.
 *
 * `reason` is re-derived, because it isn't persisted — only the stage is. That is a
 * deliberate asymmetry: the stage is a fact worth keeping, whereas the reason is an
 * explanation of the evidence *as it stands now*, and a stale one would be worse than
 * none. When the two disagree, the stored stage wins and the reason is dropped, because
 * an explanation that doesn't match the thing it's explaining is actively misleading.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get('slug');
  if (!slug) return NextResponse.json({ error: 'slug is required.' }, { status: 400 });
  if (!clientRecordsConfigured()) return NextResponse.json({ stage: null, reason: null, leadId: null });

  const record = await getClientRecordBySlug(slug).catch(() => null);
  if (!record) return NextResponse.json({ stage: null, reason: null, leadId: null });

  const ctx = await getClientContext(slug);
  let reason: string | null = null;

  if (ctx) {
    const account =
      record.email && accountStoreConfigured() ? await getAccount(record.email).catch(() => null) : null;
    const portalSite = account?.sites.find((s) => s.slug === ctx.sites[0]?.slug) ?? null;

    const derived = deriveStage({
      stageOverride: record.stageOverride,
      // Subscription health is not re-queried here — this route makes no Stripe call, and
      // the sweep already resolved it. Passing null means the derivation falls through to
      // the disk/portal rules, which is why a mismatch with the stored stage is expected
      // rather than alarming, and why the stored stage wins below.
      subscription: null,
      disk: ctx.detectedStatus,
      portal: portalSite?.status ?? null,
      hasClientFolder: true,
      hasPaid: Boolean(portalSite?.stripeSubscriptionId || portalSite?.sessionId),
      cancel: portalSite?.cancelRequestedAt
        ? {
            requestedAt: portalSite.cancelRequestedAt,
            effectiveAt: portalSite.cancelEffectiveAt ?? Number.MAX_SAFE_INTEGER,
          }
        : null,
      breakages30d: reconcileStoreConfigured() ? await getBreakageCount(slug).catch(() => 0) : 0,
    });

    if (derived.stage === record.stage) reason = derived.reason;
  }

  return NextResponse.json({ stage: record.stage, reason, leadId: record.leadId ?? null });
}
