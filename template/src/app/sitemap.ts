import type { MetadataRoute } from 'next';
import { CONTENT } from '@/data/site';
import { PAGE_SEO } from '@/data/seo-pages';

// Next 14 file convention: serves /sitemap.xml.
//
// Every page the site has (SEO plan D9, 2026-11-10): home, the core pages, the optional page, and
// each service that earned its own page. A service without one has no URL and is not listed. The
// list comes from src/data/seo-pages.ts, which the console writes on every export from the page
// composition, so the sitemap can never name a page that doesn't exist. It used to list home only.
//
// The console's export rewrites THIS file on every export too (lib/export.ts writePageSeo), since
// app/ files are not refreshed for existing repos any other way.
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date(CONTENT._meta?.generated_at || Date.now());
  const urls = Object.values(PAGE_SEO).map((p) => p.canonical).filter((u) => /^https?:\/\//i.test(u));
  if (urls.length) {
    return urls.map((url) => ({ url, lastModified, changeFrequency: 'monthly', priority: url === urls[0] ? 1 : 0.8 }));
  }
  // Before an export has written seo-pages.ts: home only, as before.
  const canonical = CONTENT.seo.canonical?.trim();
  if (!canonical) return [];
  try {
    return [{ url: new URL(canonical).toString(), lastModified, changeFrequency: 'monthly', priority: 1 }];
  } catch {
    return []; // malformed canonical: emit nothing rather than an invalid sitemap
  }
}
