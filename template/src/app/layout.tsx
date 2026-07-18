import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { Analytics } from '@vercel/analytics/next';
import '../styles/globals.css';
import { CONTENT } from '@/data/site';
import { paletteVars, typographyVars } from '@/lib/palette';
import { industryFontVars } from '@/lib/fonts.loader';

// SEO is driven by CONTENT.seo. A catalog SEO variant may extend this (e.g. JSON-LD)
// by exporting its own `generateMetadata` from the page.
export const metadata: Metadata = {
  title: CONTENT.seo.title,
  description: CONTENT.seo.description,
  alternates: { canonical: CONTENT.seo.canonical },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const brandVars: CSSProperties = {
    ...paletteVars(CONTENT.brand),
    ...typographyVars(CONTENT.brand),
  };
  return (
    <html lang="en" className={industryFontVars}>
      <body style={brandVars}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
