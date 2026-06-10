import type { Metadata } from 'next';
import { IBM_Plex_Sans, JetBrains_Mono } from 'next/font/google';
import localFont from 'next/font/local';
import './globals.css';

// Brand-matched faces: Cabinet Grotesk (display, local woff2 copied from the
// agency repo), IBM Plex Sans (body), JetBrains Mono (IDs / commands).
const cabinet = localFont({
  src: './fonts/CabinetGrotesk-Variable.woff2',
  variable: '--font-cabinet',
  weight: '100 900',
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
  title: 'JDD · Onboarding Runbook',
  description: 'Internal provisioning console for Juneau Digital Designs.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${cabinet.variable} ${ibmPlexSans.variable} ${jetbrainsMono.variable}`}>
        <div className="dotfield" aria-hidden />
        {children}
        <div className="grain" aria-hidden />
      </body>
    </html>
  );
}
