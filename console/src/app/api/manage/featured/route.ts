import { NextResponse } from 'next/server';
import { loadManageTarget } from '@/lib/manageSites';
import {
  cancelKvConfigured,
  getFeaturedRequestRecord,
  getPublishedFeaturedSite,
} from '@/lib/cancelKv';

/**
 * What the portal knows about this site's featured-listing opt-in, and whether it's
 * already live on the homepage. The publish form reads this to prefill the credited/
 * anonymous state and warn before overwriting an existing listing.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const target = await loadManageTarget(url.searchParams.get('slug'), url.searchParams.get('site'));
  if (!target.ok) return NextResponse.json({ error: target.error }, { status: target.status });

  if (!cancelKvConfigured()) {
    return NextResponse.json({
      configured: false,
      note: 'KV is not configured — featured-request signals are unavailable.',
      request: null,
      published: null,
    });
  }

  const siteSlug = target.resolved.site.slug;
  const [request, published] = await Promise.all([
    getFeaturedRequestRecord(siteSlug).catch(() => null),
    getPublishedFeaturedSite(siteSlug).catch(() => null),
  ]);

  return NextResponse.json({ configured: true, request, published });
}
