import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/pageMetadata';

export const meta = {
  id: 'seo-default',
  category: 'seo',
  label: 'SEO / Default (title + description + canonical)',
  consumes: ['seo.title', 'seo.description', 'seo.canonical', 'brand.name'],
  sharedDeps: [],
  /** Structural archetype, from src/lib/archetypes.ts. Unique within the category. */
  archetype: 'none',
  /** True if this component owns a SIGNATURE motion moment (a scroll-linked transform, a pin,
   *  a count-up). Decision 26 budgets these per PAGE, not per section: at most two on a page,
   *  enforced by console/test/page-rhythm.test.mjs. Micro-reveals are free and do not count. */
  signature: false,
} as const;

export function generateMetadata(): Metadata {
  // Home's metadata, computed at export with every other page's (lib/pageSeo.ts writes
  // src/data/seo-pages.ts), so one rule sets every title, description and canonical (SEO plan
  // D7, D9). Falls back to CONTENT.seo before an export has written seo-pages.ts.
  return pageMetadata('');
}

// No default export by design.
//
// This file previously default-exported a component that injected gtag.js and the Facebook
// pixel from seo.googleAnalyticsId / seo.facebookPixelId. It never ran: wirePage() injects
// only `export { generateMetadata }` at the @studio:metadata anchor, and `seo` is not in
// BODY_SLOTS, so nothing ever imported the default. The console collected both IDs in three
// separate forms and they reached no client site.
//
// Removed rather than wired up, because Vercel Analytics is already in the template layout
// and adding two more trackers isn't a decision this cleanup should make silently. If GA or
// Pixel is wanted later, add it in template/src/app/layout.tsx where it will actually load.
