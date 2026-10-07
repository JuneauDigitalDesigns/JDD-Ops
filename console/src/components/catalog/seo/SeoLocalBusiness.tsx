import type { Metadata } from 'next';
import { CONTENT } from '@/data/site';

export const meta = {
  id: 'seo-local-business',
  category: 'seo',
  label: 'SEO / Local Business (metadata + JSON-LD)',
  consumes: ['seo', 'brand.name', 'brand.long', 'brand.phone', 'brand.email', 'brand.address', 'brand.established', 'extensions.reviewBadge', 'extensions.hours', 'extensions.contactDetails'],
  sharedDeps: [],
  /** Structural archetype, from src/lib/archetypes.ts. Unique within the category. */
  archetype: 'none',
  /** True if this component owns a SIGNATURE motion moment (a scroll-linked transform, a pin,
   *  a count-up). Decision 26 budgets these per PAGE, not per section: at most two on a page,
   *  enforced by console/test/page-rhythm.test.mjs. Micro-reveals are free and do not count. */
  signature: false,
} as const;

export function generateMetadata(): Metadata {
  const { seo, brand } = CONTENT;
  return {
    title: seo.title || brand.name,
    description: seo.description || brand.tagline,
    alternates: { canonical: seo.canonical },
    robots: { index: true, follow: true },
    openGraph: {
      title: seo.title || brand.name,
      description: seo.description || brand.tagline,
      url: seo.canonical,
      siteName: brand.name,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: seo.title || brand.name,
      description: seo.description || brand.tagline,
    },
  };
}

// No default export by design — this variant contributes metadata only.
//
// It used to default-export a <script type="application/ld+json">, but that never reached a
// client site: wirePage() injects only `export { generateMetadata }`, and `seo` is not a
// BODY_SLOT, so the default was never imported. The markup existed solely in the console's
// own preview.
//
// Structured data now comes from template/src/lib/structuredData.ts, emitted by the template
// layout, which reaches every client regardless of the SEO variant chosen. That version also
// fixes this one's openingHoursSpecification (it split the range on "-" and passed "9:00 AM"
// through where Google requires 24-hour HH:MM, and turned "Closed" into a bogus range) and
// adds the FAQPage / Review / Service nodes this never had.
