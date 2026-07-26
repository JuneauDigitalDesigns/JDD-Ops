import type { MetadataRoute } from 'next';
import { CONTENT } from '@/data/site';

// Next 14 file convention — serves /robots.txt. No public/ directory needed.
//
// AI crawler policy is explicit rather than left to the default. These sites exist to be
// found, and for a local service business being quotable by an answer engine is upside, so
// the default is allow. `seo.aiCrawlers: 'deny'` (schema v1.5.0) flips it per client for
// anyone who'd rather not be trained on.
const AI_CRAWLERS = ['GPTBot', 'ClaudeBot', 'Claude-Web', 'PerplexityBot', 'CCBot', 'Google-Extended', 'Applebot-Extended'];

export default function robots(): MetadataRoute.Robots {
  const seo = CONTENT.seo as { canonical?: string; aiCrawlers?: string | null };
  const canonical = seo.canonical?.trim();
  const deny = seo.aiCrawlers === 'deny';

  return {
    rules: [
      { userAgent: '*', allow: '/' },
      ...(deny
        ? [{ userAgent: AI_CRAWLERS, disallow: '/' }]
        : [{ userAgent: AI_CRAWLERS, allow: '/' }]),
    ],
    ...(canonical ? { sitemap: `${canonical.replace(/\/$/, '')}/sitemap.xml` } : {}),
  };
}
