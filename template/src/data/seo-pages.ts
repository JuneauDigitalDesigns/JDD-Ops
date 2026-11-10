// Written by the JDD console on every export (lib/pageSeo.ts). Do not edit: it is regenerated.
// Each page's title, description, canonical, social image and structured data, and the
// business node. Read by lib/pageMetadata.ts, lib/PageJsonLd.tsx, lib/structuredData.ts and
// app/sitemap.ts.
//
// This is the empty starting point (the console preview and a fresh template copy): every reader
// falls back to CONTENT until an export writes the real values.

export interface PageSeo {
  title: string;
  description: string;
  canonical: string;
  ogImage: string | null;
  jsonLd: Record<string, unknown>[];
}

export const PAGE_SEO: Record<string, PageSeo> = {};

export const BUSINESS_JSONLD: Record<string, unknown> | null = null;
