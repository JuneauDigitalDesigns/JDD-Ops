import { NextResponse } from 'next/server';
import { getClientContext, listClientContexts } from '@/lib/clients';
import { reconcileClient } from '@/lib/reconcile';
import {
  reconcileStoreConfigured,
  saveReconcileResult,
  getReconcileResult,
  getReconcileResults,
  acquireSweepLock,
  releaseSweepLock,
  getBreakageCount,
} from '@/lib/reconcileStore';
import { clientRecordsConfigured, getClientRecordBySlug, refreshStage } from '@/lib/clientRecord';
import { getAccount, accountStoreConfigured } from '@/lib/accountStore';
import type { ClientContext } from '@/lib/types';
import type { SubscriptionHealth } from '@/lib/reconcileBilling';
import type { Stage } from '@jdd/schema';

/**
 * Re-derive and persist one client's stage from the evidence a sweep just gathered.
 *
 * Non-fatal throughout: a sweep that found real problems must still report them even if
 * the record is missing or KV is unreachable. The stage is a convenience layered on the
 * findings, not a precondition for them.
 */
async function refreshStageFor(
  ctx: ClientContext,
  health: SubscriptionHealth,
): Promise<{ stage: Stage; reason: string } | null> {
  if (!clientRecordsConfigured()) return null;
  try {
    const record = await getClientRecordBySlug(ctx.slug);
    if (!record) return null;

    const portalEmail = ctx.sites[0]?.env.PORTAL_ACCOUNT_EMAIL ?? null;
    const account =
      portalEmail && accountStoreConfigured() ? await getAccount(portalEmail).catch(() => null) : null;
    const portalSite = account?.sites.find((s) => s.slug === ctx.sites[0]?.slug) ?? null;

    const { result } = await refreshStage(record, {
      subscription: health,
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
      // Counted from the history this same sweep just appended to, so a breakage that
      // opened moments ago is already reflected.
      breakages30d: await getBreakageCount(ctx.slug),
    });
    return { stage: result.stage, reason: result.reason };
  } catch (err) {
    console.error('[reconcile] stage refresh failed', ctx.slug, err);
    return null;
  }
}

/**
 * Run or read a reconcile sweep.
 *
 *   GET  /api/manage/reconcile?slug=x        cached result for one client
 *   GET  /api/manage/reconcile               cached results for the whole roster
 *   POST /api/manage/reconcile { slug }      sweep one client and cache it
 *   POST /api/manage/reconcile { all: true } sweep everyone
 *
 * GET never sweeps. Reading is what the roster and the client shell do on every render, and
 * a read path that could spend six vendor API calls per client would make opening a screen
 * expensive in a way nobody would predict. Sweeping is always an explicit POST — on console
 * launch, or from "Check now".
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The console has no auth; every write path is localhost-only, same as env/reveal. */
function isLoopback(req: Request): boolean {
  const host = (req.headers.get('host') ?? '').toLowerCase();
  const hostname = host.startsWith('[') ? host.slice(0, host.indexOf(']') + 1) : host.split(':')[0];
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname === '::1' ||
    hostname.endsWith('.localhost')
  );
}

export async function GET(req: Request) {
  if (!reconcileStoreConfigured()) {
    return NextResponse.json({ configured: false, results: {} });
  }

  const slug = new URL(req.url).searchParams.get('slug');
  if (slug) {
    return NextResponse.json({ configured: true, result: await getReconcileResult(slug) });
  }

  const clients = await listClientContexts({ includeFixtures: false }).catch(() => []);
  const results = await getReconcileResults(clients.map((c) => c.slug));
  return NextResponse.json({ configured: true, results });
}

export async function POST(req: Request) {
  if (!isLoopback(req)) {
    return NextResponse.json({ error: 'Available on localhost only.' }, { status: 403 });
  }
  if (!reconcileStoreConfigured()) {
    return NextResponse.json(
      { error: 'KV not configured — set KV_REST_API_URL / KV_REST_API_TOKEN in console/.env.local.' },
      { status: 500 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const slug: string | undefined = body?.slug;
  const all = body?.all === true;
  const includeFixtures = body?.fixtures === true;

  if (!slug && !all) {
    return NextResponse.json({ error: 'Pass a slug, or all: true.' }, { status: 400 });
  }

  // One lock for the whole sweep rather than one per client: the point is to stop the
  // launch sweep and a "Check now" press from running together, and they overlap at the
  // level of the run, not the client.
  const scope = all ? 'all' : `client:${slug}`;
  if (!(await acquireSweepLock(scope))) {
    return NextResponse.json(
      { error: 'A sweep is already running. Try again in a moment.', busy: true },
      { status: 409 },
    );
  }

  try {
    const targets = all
      ? await listClientContexts({ includeFixtures })
      : [await getClientContext(slug!)].filter((c): c is NonNullable<typeof c> => Boolean(c));

    if (!targets.length) {
      return NextResponse.json({ error: `No such client: ${slug}` }, { status: 404 });
    }

    const swept = [];
    for (const ctx of targets) {
      // Sequential, not Promise.all. A roster-wide sweep is already 6–10 vendor calls per
      // client; firing them all at once is the reliable way to get rate-limited by Retell
      // and Twilio at the same moment, which would turn a healthy roster into a screen full
      // of `unknown`.
      const result = await reconcileClient(ctx);
      const transitions = await saveReconcileResult(result);

      // Close the loop: a sweep is the only moment we hold live evidence from every
      // vendor at once, so it is the right moment to re-derive the stage. Doing it
      // anywhere else would mean re-querying Stripe to answer a question we just asked.
      const stage = await refreshStageFor(ctx, result.subscriptionHealth);

      swept.push({
        slug: ctx.slug,
        checkedAt: result.checkedAt,
        findings: result.findings.length,
        unreachable: result.unreachable,
        opened: transitions.filter((t) => t.event === 'opened').length,
        closed: transitions.filter((t) => t.event === 'closed').length,
        stage: stage?.stage ?? null,
        stageReason: stage?.reason ?? null,
      });
    }

    return NextResponse.json({ ok: true, swept });
  } catch (err) {
    console.error('[reconcile] sweep failed', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  } finally {
    await releaseSweepLock(scope);
  }
}
