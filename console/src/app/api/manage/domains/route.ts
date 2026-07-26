import { NextResponse } from 'next/server';
import { loadVercelCredentials } from '@/lib/opsSecrets';
import { loadVercelSync } from '@/lib/vercelSync';
import { loadManageTarget } from '@/lib/manageSites';

/**
 * Domains attached to a site's Vercel project, with verification state.
 *
 * Feeds the Overview health block. This is the difference between "site.ts claims a
 * canonical" and "that domain is actually attached and verified" — the usual post-launch
 * loose end.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const target = await loadManageTarget(url.searchParams.get('slug'), url.searchParams.get('site'));
  if (!target.ok) return NextResponse.json({ error: target.error }, { status: target.status });

  if (!loadVercelCredentials()) {
    return NextResponse.json({
      ok: false,
      reason: 'VERCEL_TOKEN is not set in jdd-ops/.env',
      domains: [],
      canonical: target.resolved.site.canonical ?? null,
    });
  }

  const { listProjectDomains } = await loadVercelSync();
  const result = await listProjectDomains(target.resolved.site.slug);
  // Pair it with what site.ts claims, so the UI can flag "canonical set but not attached".
  return NextResponse.json({ ...result, canonical: target.resolved.site.canonical ?? null });
}
