import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import dynamic from 'next/dynamic';
import { Analytics } from '@vercel/analytics/next';
import '../styles/globals.css';
import { CONTENT } from '@/data/site';
import { paletteVars, typographyVars } from '@/lib/palette';
import { fontVarsFor } from '@/lib/fonts.loader';
import { buildJsonLd } from '@/lib/structuredData';
import StickyCallBar from '@/lib/StickyCallBar';

// Lenis is dynamically imported with ssr:false so it is never in the first-paint
// critical path (decisions 25 + 54, and PERF.md on how expensive blanket byte
// additions have been here).
const SmoothScroll = dynamic(() => import('@/lib/SmoothScroll'), { ssr: false });

// SEO is driven by CONTENT.seo. A catalog SEO variant may extend this by exporting its own
// `generateMetadata` from the page.
//
// metadataBase makes Next resolve OpenGraph/Twitter image URLs absolutely. Without it those
// come out relative, which most crawlers and every social scraper reject.
const canonical = CONTENT.seo.canonical?.trim();
let metadataBase: URL | undefined;
try {
  metadataBase = canonical ? new URL(canonical) : undefined;
} catch {
  metadataBase = undefined; // a malformed canonical shouldn't fail the build
}

export const metadata: Metadata = {
  ...(metadataBase ? { metadataBase } : {}),
  title: CONTENT.seo.title,
  description: CONTENT.seo.description,
  alternates: { canonical: CONTENT.seo.canonical },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const brandVars: CSSProperties = {
    ...paletteVars(CONTENT.brand),
    ...typographyVars(CONTENT.brand),
  };
  // Structured data is emitted here rather than from a catalog SEO component, because the
  // catalog route never actually rendered (wirePage wires generateMetadata only). Emitting
  // from the layout means every client gets it with no export wiring at all.
  const jsonLd = buildJsonLd(CONTENT);
  return (
    /* Only the families this brand's stacks actually name — see fonts.loader.ts. A system
       stack yields "" and the site ships no font files at all. */
    <html lang="en" className={fontVarsFor(CONTENT.brand.typography.fontSans, CONTENT.brand.typography.fontHeading)}>
      <body style={brandVars}>
        {jsonLd && (
          <script
            type="application/ld+json"
            // Content is JSON-serialized data, never markup. Escaping "<" defends against a
            // string in the schema closing this script tag early.
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
          />
        )}
        {children}
        <SmoothScroll />
        {/* The template seed's SiteContent is the FIXED minimal schema (brand/services/faq/
            testimonials/seo/_meta), with no hero.trust or announcement field, so assurance and
            badge are null here. The console Studio passes the real values from its richer content
            (see PageStudio.tsx). Not inventing a value: a missing field stays null. */}
        <StickyCallBar
          phone={CONTENT.brand.phone}
          phoneHref={CONTENT.brand.phoneHref}
          assurance={null}
          badge={null}
        />
        <Analytics />
      </body>
    </html>
  );
}
