import type { MetadataRoute } from 'next';
import { CONTENT } from '@/data/site';

// Next 14 file convention — serves /sitemap.xml.
//
// These are single-page sites (page.tsx is the whole thing; sections are anchors, not
// routes), so this lists exactly one URL. It exists because a sitemap is what robots.txt
// points at and what Search Console expects, not because there's much to enumerate.
export default function sitemap(): MetadataRoute.Sitemap {
  const canonical = CONTENT.seo.canonical?.trim();
  if (!canonical) return [];
  try {
    return [{
      url: new URL(canonical).toString(),
      lastModified: new Date(CONTENT._meta.generated_at || Date.now()),
      changeFrequency: 'monthly',
      priority: 1,
    }];
  } catch {
    return []; // malformed canonical — emit nothing rather than an invalid sitemap
  }
}
