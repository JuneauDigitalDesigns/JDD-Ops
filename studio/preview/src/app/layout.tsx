import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import '../styles/globals.css';
import { CONTENT } from '@/data/site';
import { paletteVars, typographyVars } from '@/lib/palette';

export const metadata: Metadata = {
  title: 'JDD Catalog Preview',
  description: 'Internal component playground for the JDD site template.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const brandVars: CSSProperties = {
    ...paletteVars(CONTENT.brand),
    ...typographyVars(CONTENT.brand),
  };
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body style={brandVars} className="bg-zinc-50 font-chrome text-zinc-900 antialiased">
        {children}
      </body>
    </html>
  );
}
