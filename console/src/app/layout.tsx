import type { Metadata } from 'next';
import { Big_Shoulders_Display, Hanken_Grotesk, DM_Mono } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from './components/theme/ThemeProvider';
import ConsoleNav from '@/components/ConsoleNav';
import { industryFontVars } from '@/lib/fonts.loader';

// JDD site fonts (mirrors juneaudigitaldesigns.com): Big Shoulders (display),
// Hanken Grotesk (body), DM Mono (labels). Next 14's bundled Google Fonts
// metadata only exposes the "Big Shoulders Display" sub-family, not the plain
// "Big Shoulders" variable family the live site (Next 16) uses — same typeface.
const bigShoulders = Big_Shoulders_Display({
  variable: '--font-big-shoulders',
  subsets: ['latin'],
  weight: ['500', '600', '700', '800', '900'],
  display: 'swap',
});

const hanken = Hanken_Grotesk({
  variable: '--font-hanken',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
});

const dmMono = DM_Mono({
  variable: '--font-dm-mono',
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'JDD Console',
  description: 'Unified internal console — Studio site builder + Onboarding Runbook.',
};

// Root layout loads fonts + theme provider. The home page (/) and /onboard use the
// global JDD palette from globals.css (light/dark via data-theme); /build re-scopes
// a light client-preview palette in its own nested layout (see app/build/layout.tsx).
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${bigShoulders.variable} ${hanken.variable} ${dmMono.variable} ${industryFontVars}`}
    >
      <body className="antialiased">
        <ThemeProvider>
          <div className="flex h-[100dvh] flex-col overflow-hidden">
            <ConsoleNav />
            <div className="min-h-0 flex-1">{children}</div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
