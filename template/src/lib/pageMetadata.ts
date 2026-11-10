// A page's Next metadata, read from src/data/seo-pages.ts (SEO plan D7 and D9, 2026-11-10).
//
// BYTE-IDENTICAL in console/src/lib and template/src/lib (test/page-seo-twins.test.mjs): catalog
// SEO components import it in the console preview and in every client repo. The values are
// computed once, at export, by the console's lib/pageSeo.ts; this only maps them onto Next's
// Metadata shape. Before an export has written seo-pages.ts (a fresh template copy, the Studio
// preview), it falls back to CONTENT.seo exactly as the SEO components used to.
import type { Metadata } from 'next';
import { CONTENT } from '@/data/site';
import { PAGE_SEO } from '@/data/seo-pages';

export function pageMetadata(route: string): Metadata {
  const page = PAGE_SEO[route];
  const brand = CONTENT.brand.name;
  const title = page?.title || CONTENT.seo.title || brand;
  const description = page?.description || CONTENT.seo.description || CONTENT.brand.tagline;
  // Never inherit home's canonical on a subpage: the layout's metadata carries home's, so a
  // page without its own sets none rather than claiming to be a copy of home.
  const canonical = page ? page.canonical || undefined : route === '' ? CONTENT.seo.canonical || undefined : undefined;
  const images = page?.ogImage ? [{ url: page.ogImage, alt: title }] : undefined;
  return {
    title,
    description,
    alternates: { canonical: canonical ?? null },
    robots: { index: true, follow: true },
    openGraph: { title, description, url: canonical, siteName: brand, type: 'website', ...(images ? { images } : {}) },
    twitter: { card: 'summary_large_image', title, description, ...(images ? { images: images.map((i) => i.url) } : {}) },
  };
}
