import type { MetadataRoute } from 'next';
import { CONTENT } from '@/data/site';
import { botPolicy } from '@/lib/bots';

// Next 14 file convention — serves /robots.txt. No public/ directory needed.
//
// Bot policy is centralized in src/lib/bots.ts and shared with middleware.ts (the enforced
// layer), so robots.txt and the 403 block can never drift. These sites exist to be found —
// being quotable by an AI answer engine is upside for a local service business — so AI
// *search* bots and real search engines stay allowed by default; only bulk *training*
// crawlers and useless SEO-audit tools are disallowed. The per-client `seo.aiCrawlers`
// setting ('deny' = no AI at all, 'allow' = permit training too) overrides this. See
// botPolicy() for the exact rules.
export default function robots(): MetadataRoute.Robots {
  const seo = CONTENT.seo as { canonical?: string; aiCrawlers?: string | null };
  const canonical = seo.canonical?.trim();
  const policy = botPolicy(seo);

  return {
    rules: [
      // `crawlDelay` nudges the crawlers that honor it (Bing, Yandex) to self-pace; the ones
      // that ignore it are capped by the Vercel Firewall rate-limit rules applied at onboard.
      { userAgent: '*', allow: '/', crawlDelay: 10 },
      { userAgent: policy.robotsDisallow, disallow: '/' },
    ],
    ...(canonical ? { sitemap: `${canonical.replace(/\/$/, '')}/sitemap.xml` } : {}),
  };
}
