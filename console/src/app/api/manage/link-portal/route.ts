import { NextResponse } from 'next/server';
import type { PortalPlan, PortalSiteInput, PortalSiteStatus } from '@jdd/schema';
import { getClientContext } from '@/lib/clients';
import { accountStoreConfigured, attachSiteToAccount } from '@/lib/accountStore';
import type { ClientContext } from '@/lib/types';

/**
 * Repair a client's portal link: attach one or more client sites to a portal account.
 *
 * Writes the account record (`jdd:account:{email}`) directly — no onboard.js subprocess,
 * because the account record (not Clerk metadata) is the source of truth now. Each write
 * is an upsert, so attaching site B never disturbs site A.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = { slugs?: string[]; slug?: string; email?: string; dryRun?: boolean };

const SLUG_RE = /^[A-Za-z0-9_-]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A client that hasn't been built/provisioned yet should land in the portal's "building" state. */
function statusFor(ctx: ClientContext): PortalSiteStatus {
  return ctx.detectedStatus === 'needs-build' || ctx.detectedStatus === 'ready'
    ? 'building'
    : 'live';
}

/**
 * Site entries for one client. Single-site clients yield one; enterprise yields one per
 * site (sharing the Airtable base, as onboard.js does).
 *
 * `vercelProjectId` is deliberately omitted: resolving it needs a Vercel API call the
 * console isn't credentialed for. Because upsert merges only *defined* fields, omitting
 * it preserves whatever is already stored — and a never-provisioned site simply shows
 * "analytics not connected yet" until a normal onboard/sync run fills it in.
 */
function siteEntriesFor(ctx: ClientContext): PortalSiteInput[] {
  const status = statusFor(ctx);
  const plan = ctx.plan as PortalPlan;
  const sharedBase = ctx.sites[0]?.env?.AIRTABLE_BASE_ID ?? null;

  return ctx.sites.map((s) => ({
    slug: s.slug,
    name: s.brandName,
    canonical: s.canonical ?? undefined,
    plan,
    status,
    airtableBaseId: plan === 'starter' ? null : (s.env?.AIRTABLE_BASE_ID ?? sharedBase),
  }));
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  // Accept `slugs: []`, or a single `slug` for convenience.
  const slugs = (body.slugs ?? (body.slug ? [body.slug] : []))
    .map((s) => s.trim())
    .filter(Boolean);
  const email = (body.email ?? '').trim();
  const dryRun = body.dryRun === true;

  if (slugs.length === 0) {
    return NextResponse.json({ error: 'Select at least one client site.' }, { status: 400 });
  }
  if (slugs.some((s) => !SLUG_RE.test(s))) {
    return NextResponse.json({ error: 'Invalid client slug.' }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    // Required even for a single site: it names the account being written to.
    return NextResponse.json({ error: 'A valid account email is required.' }, { status: 400 });
  }
  if (!accountStoreConfigured()) {
    return NextResponse.json(
      { error: 'KV not configured — set KV_REST_API_URL / KV_REST_API_TOKEN.' },
      { status: 500 },
    );
  }

  const results: Array<{
    slug: string;
    ok: boolean;
    sites?: string[];
    attached?: string[];
    sitesOnAccount?: number;
    error?: string;
  }> = [];

  for (const slug of slugs) {
    try {
      const ctx = await getClientContext(slug);
      if (!ctx || !ctx.hasIntake) {
        results.push({ slug, ok: false, error: `No intake at clients/${slug}/site.ts` });
        continue;
      }

      const entries = siteEntriesFor(ctx);
      if (dryRun) {
        results.push({ slug, ok: true, attached: entries.map((e) => e.slug) });
        continue;
      }

      let sitesOnAccount = 0;
      for (const entry of entries) {
        const account = await attachSiteToAccount(email, entry);
        sitesOnAccount = account.sites.length;
      }
      results.push({
        slug,
        ok: true,
        attached: entries.map((e) => e.slug),
        sitesOnAccount,
      });
    } catch (err) {
      results.push({
        slug,
        ok: false,
        error: err instanceof Error ? err.message : 'Attach failed.',
      });
    }
  }

  const failed = results.filter((r) => !r.ok).length;
  return NextResponse.json({
    ok: failed === 0,
    dryRun,
    email,
    results,
  });
}
