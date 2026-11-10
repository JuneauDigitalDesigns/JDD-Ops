// The site-wide schema.org graph: the ONE business node, on every page (SEO plan D10, Xander
// 2026-11-10). Called from layout.tsx, which is client-owned and never refreshed, so this file
// (template-owned, refreshed on every re-export) is where the change reaches existing clients.
//
// The node itself is computed at export by the console's lib/pageSeo.ts, which knows the vertical
// (HVACBusiness, Plumber, RoofingContractor, AutoWash, HomeAndConstructionBusiness), the profile
// links (sameAs) and whether the business hides its street, and is written into
// src/data/seo-pages.ts as BUSINESS_JSONLD. Page-level nodes (breadcrumbs, a service page's
// Service, FAQPage where the FAQs are shown) render per page from lib/PageJsonLd.tsx.
//
// What this replaced: one graph on every page holding a generic LocalBusiness, every FAQ, every
// Service and a Review node per testimonial. Google makes a business's reviews of itself
// ineligible for review snippets, and on e2etestgrowth those reviews were sample quotes.
//
// Before an export has written seo-pages.ts (a fresh template copy), a minimal node is built from
// CONTENT: name, phone, URL. Never reviews, ratings, FAQs or services.
import { BUSINESS_JSONLD } from '@/data/seo-pages';

type Json = Record<string, unknown>;
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {});

export function buildJsonLd(content: unknown): Json | null {
  if (BUSINESS_JSONLD) return { '@context': 'https://schema.org', '@graph': [BUSINESS_JSONLD] };
  const c = obj(content);
  const brand = obj(c.brand);
  const name = str(brand.long) || str(brand.name);
  if (!name) return null;
  const url = str(obj(c.seo).canonical);
  const node: Json = { '@type': 'LocalBusiness', name };
  if (str(brand.phone)) node.telephone = str(brand.phone);
  if (/^https?:\/\//i.test(url)) {
    node.url = url;
    node['@id'] = `${url.replace(/\/+$/, '')}#business`;
  }
  return { '@context': 'https://schema.org', '@graph': [node] };
}
