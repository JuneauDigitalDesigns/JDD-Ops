import type { Metadata } from 'next';
import { IBM_Plex_Sans, JetBrains_Mono } from 'next/font/google';
import localFont from 'next/font/local';
import './globals.css';

// JDD "Aurora Glass" chrome fonts (mirrors juneau-digital-designs):
// Cabinet Grotesk (display), IBM Plex Sans (body), JetBrains Mono (labels).
const cabinetGrotesk = localFont({
  src: './fonts/CabinetGrotesk-Variable.woff2',
  variable: '--font-cabinet',
  weight: '100 900',
  style: 'normal',
  display: 'swap',
});

const ibmPlexSans = IBM_Plex_Sans({
  variable: '--font-ibm-plex-sans',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  title: 'JDD Console',
  description: 'Unified internal console — Studio site builder + Onboarding Runbook.',
};

// Root layout only loads fonts + base chrome. The home page (/) and /onboard use the
// global Aurora-Glass dark palette from globals.css; /build re-scopes a light client
// preview palette in its own nested layout (see app/build/layout.tsx).
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${cabinetGrotesk.variable} ${ibmPlexSans.variable} ${jetbrainsMono.variable}`}
    >
      <body className="antialiased">{children}</body>
    </html>
  );
}
