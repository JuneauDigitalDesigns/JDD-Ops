import { NextResponse, type NextRequest } from 'next/server';
import { CONTENT } from '@/data/site';
import { botPolicy } from '@/lib/bots';

// Enforcement layer for the bot policy in src/lib/bots.ts. robots.txt only *asks* crawlers to
// stay away — many ignore it — so we hard-block the disallowed training / SEO-audit bots with
// a 403. (Next 14 `middleware` convention; runs on the Edge runtime.)
//
// Blocking only, by design: rate-limiting the bots we KEEP (search engines + AI-search bots)
// is handled by Vercel Firewall rules applied at provisioning, which run at the edge without a
// shared-state store — so this file needs no Redis and stays a cheap string check.
//
// The block list is computed once at module load from the site's own `seo.aiCrawlers` setting,
// so it matches robots.txt exactly.
const BLOCKED = botPolicy(CONTENT.seo as { aiCrawlers?: string | null }).blockedUaPatterns;

export function middleware(req: NextRequest) {
  const ua = req.headers.get('user-agent')?.toLowerCase() ?? '';
  if (ua && BLOCKED.some((pattern) => ua.includes(pattern))) {
    return new NextResponse(null, { status: 403 });
  }
  return NextResponse.next();
}

// Skip immutable static assets and the crawl-control files: robots.txt and the sitemap must
// stay readable by allowed crawlers, and `_next/static` chunks shouldn't each pay a middleware
// invocation. Pages and the image optimizer are covered.
export const config = {
  matcher: ['/((?!_next/static|favicon.ico|robots.txt|sitemap.xml|sitemap-0.xml).*)'],
};
