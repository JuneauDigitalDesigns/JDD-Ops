// Loads the curated industry font families via next/font (self-hosted, offline, no layout
// shift). Exposes a combined className of CSS-variable classes to attach to <html> so a
// brand.typography.fontHeading / fontSans value like "var(--font-inter), …" resolves on the
// exported client site.

import {
  Inter,
  Manrope,
  Poppins,
  Sora,
  Work_Sans,
  Plus_Jakarta_Sans,
  Roboto_Slab,
  Playfair_Display,
} from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap' });
const poppins = Poppins({ subsets: ['latin'], variable: '--font-poppins', weight: ['400', '500', '600', '700', '800'], display: 'swap' });
const sora = Sora({ subsets: ['latin'], variable: '--font-sora', display: 'swap' });
const workSans = Work_Sans({ subsets: ['latin'], variable: '--font-worksans', display: 'swap' });
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta', display: 'swap' });
const slab = Roboto_Slab({ subsets: ['latin'], variable: '--font-slab', display: 'swap' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair', display: 'swap' });

export const industryFontVars = [
  inter.variable,
  manrope.variable,
  poppins.variable,
  sora.variable,
  workSans.variable,
  jakarta.variable,
  slab.variable,
  playfair.variable,
].join(' ');
