import { NextResponse } from 'next/server';
import { tenureMonths, type ClientRecord } from '@jdd/schema';
import { getClientContext } from '@/lib/clients';
import { clientRecordsConfigured, getClientRecordBySlug } from '@/lib/clientRecord';
import { accountStoreConfigured, getAccount } from '@/lib/accountStore';
import { reconcileStoreConfigured, getReconcileResult } from '@/lib/reconcileStore';
import { fetchCallLog, type CallRow } from '@/lib/callLog';
import type { SiteMoney } from '@/lib/reconcile';

/**
 * Everything the Account phase shows, in one request.
 *
 * ── Money is READ FROM THE SWEEP, never re-queried here ─────────────────────
 *
 * MRR, renewal date and payment state come out of the reconcile cache, with the sweep's
 * `checkedAt` attached so the UI can say how old they are. This route does not call Stripe.
 *
 * That is deliberate. Querying Stripe on page load would give a fresher number that
 * disagrees with the findings list rendered beside it — the same screen would show
 * "payment failing" from a sweep and a healthy status from a live call, and there would be
 * no way to tell which was true. One source, one timestamp, one story.
 *
 * The ledger is the opposite case: it lives on the client record because no vendor will
 * report it retroactively.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface AccountPayload {
  slug: string;
  stage: string | null;
  stageUpdatedAt: number | null;
  /** Money, as of the last sweep. Null when the client has never been swept. */
  money: SiteMoney[];
  checkedAt: number | null;
  ledger: ClientRecord['ledger'] | null;
  tenureMonths: number | null;
  /** Portal account email, so the Account view can say who signs in. */
  email: string | null;
  calls: CallRow[];
  callsReason: string | null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get('slug');
  const siteParam = url.searchParams.get('site');
  if (!slug) return NextResponse.json({ error: 'slug is required.' }, { status: 400 });

  const ctx = await getClientContext(slug);
  if (!ctx) return NextResponse.json({ error: `No such client: ${slug}` }, { status: 404 });

  const site = ctx.sites.find((s) => s.slug === siteParam) ?? ctx.sites[0] ?? null;

  const record = clientRecordsConfigured()
    ? await getClientRecordBySlug(slug).catch(() => null)
    : null;

  const sweep = reconcileStoreConfigured() ? await getReconcileResult(slug).catch(() => null) : null;

  // The sweep result carries `money`, which is not part of the shared ReconcileResult
  // shape — it is added by the console's own reconcileClient. Read defensively so a
  // snapshot written before that existed doesn't break the page.
  const money = ((sweep as { money?: SiteMoney[] } | null)?.money ?? []) as SiteMoney[];

  // Prefer the record's email; fall back to disk, matching how reconcile resolves it.
  const email =
    record?.email ?? ctx.sites[0]?.env.PORTAL_ACCOUNT_EMAIL ?? null;

  const account =
    email && accountStoreConfigured() ? await getAccount(email).catch(() => null) : null;

  // Enterprise sites share one base and are separated by the Site column; onboard.js writes
  // the tag into each site's env. Passing it keeps one site's view to its own calls.
  const calls = site
    ? await fetchCallLog({
        baseId: site.env.AIRTABLE_BASE_ID,
        siteTag: ctx.isEnterprise ? (site.env.AIRTABLE_SITE_TAG ?? null) : null,
      })
    : ({ ok: false, reason: 'This client has no sites.' } as const);

  const payload: AccountPayload = {
    slug,
    stage: record?.stage ?? null,
    stageUpdatedAt: record?.stageUpdatedAt ?? null,
    money,
    checkedAt: sweep?.checkedAt ?? null,
    ledger: record?.ledger ?? null,
    tenureMonths: record ? tenureMonths(record) : null,
    email: account?.email ?? email,
    calls: calls.ok ? calls.calls : [],
    callsReason: calls.ok ? null : calls.reason,
  };

  return NextResponse.json(payload);
}
