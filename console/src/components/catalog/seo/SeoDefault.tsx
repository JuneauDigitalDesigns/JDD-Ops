import type { Metadata } from 'next';
import { CONTENT } from '@/data/site';

export const meta = {
  id: 'seo-default',
  category: 'seo',
  label: 'SEO / Default (title + description + canonical)',
  consumes: ['seo.title', 'seo.description', 'seo.canonical', 'brand.name'],
  sharedDeps: [],
} as const;

export function generateMetadata(): Metadata {
  const { seo, brand } = CONTENT;
  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical: seo.canonical },
    robots: { index: true, follow: true },
    openGraph: {
      title: seo.title,
      description: seo.description,
      url: seo.canonical,
      siteName: brand.name,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: seo.title,
      description: seo.description,
    },
  };
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
