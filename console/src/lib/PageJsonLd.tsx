// A page's own structured data (SEO plan D10, 2026-11-10): its BreadcrumbList, its Service node
// on a service page, and FAQPage only where those FAQs are on the page. The business node is
// site-wide and comes from the layout (lib/structuredData.ts); these reference it by @id.
//
// BYTE-IDENTICAL in console/src/lib and template/src/lib (test/page-seo-twins.test.mjs). The data
// is written at export by the console's lib/pageSeo.ts into src/data/seo-pages.ts, already
// escaped so no value can close the script tag; the replace below is the same guard again.
import { PAGE_SEO } from '@/data/seo-pages';

export default function PageJsonLd({ route }: { route: string }) {
  const nodes = PAGE_SEO[route]?.jsonLd;
  if (!nodes || nodes.length === 0) return null;
  const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes }).replace(/</g, '\\u003c');
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
