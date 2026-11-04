import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import ConsoleNav from '@/components/ConsoleNav';
import ToolBar from '@/components/shell/ToolBar';
import CommandPalette from '@/components/CommandPalette';
import { industryFontVars } from '@/lib/fonts.loader';

// JDD site fonts (mirrors juneaudigitaldesigns.com): Big Shoulders (display),
// Hanken Grotesk (body), DM Mono (labels). The console has always used the
// "Big Shoulders Display" sub-family, the one Next 14's Google font data knew;
// same typeface as the live site's "Big Shoulders".
//
// Self-hosted from ./fonts/ (vendored by jdd-ops/scripts/vendor-fonts.js), so the
// build never downloads from Google: on 2026-11-04 it failed doing exactly that.
// Faces are declared as next/font/google generated them: Big Shoulders Display and
// Hanken are one variable file listed once per weight, DM Mono is static.
const bigShoulders = localFont({
  src: [
    { path: './fonts/big-shoulders-display.woff2', weight: '500', style: 'normal' },
    { path: './fonts/big-shoulders-display.woff2', weight: '600', style: 'normal' },
    { path: './fonts/big-shoulders-display.woff2', weight: '700', style: 'normal' },
    { path: './fonts/big-shoulders-display.woff2', weight: '800', style: 'normal' },
    { path: './fonts/big-shoulders-display.woff2', weight: '900', style: 'normal' },
  ],
  variable: '--font-big-shoulders',
  display: 'swap',
});

const hanken = localFont({
  src: [
    { path: './fonts/hanken-grotesk.woff2', weight: '400', style: 'normal' },
    { path: './fonts/hanken-grotesk.woff2', weight: '500', style: 'normal' },
    { path: './fonts/hanken-grotesk.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-hanken',
  display: 'swap',
});

const dmMono = localFont({
  src: [
    { path: './fonts/dm-mono-400.woff2', weight: '400', style: 'normal' },
    { path: './fonts/dm-mono-500.woff2', weight: '500', style: 'normal' },
  ],
  variable: '--font-dm-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'JDD Console',
  description: 'Unified internal console — Studio site builder + Onboarding Runbook.',
};

// Root layout loads fonts. The console chrome is light-only — there is no theme
// provider and no toggle. The home page (/) and /onboard use the global JDD palette
// from globals.css; /build re-scopes a client-preview palette in its own nested
// layout (see app/build/layout.tsx) so client sites render true.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${bigShoulders.variable} ${hanken.variable} ${dmMono.variable} ${industryFontVars}`}
    >
      <body className="antialiased">
        <div className="flex h-[100dvh] flex-col overflow-hidden">
          <ConsoleNav />
          {/* Per-tool action strip. Self-collapses on routes with no actions, so it costs
              nothing on / and /leads. */}
          <ToolBar />
          <div className="min-h-0 flex-1">{children}</div>
        </div>
        {/* Outside the flex column and above it — an overlay, reachable from every route. */}
        <CommandPalette />
      </body>
    </html>
  );
}
