// Loads the curated pairing families via next/font (self-hosted, offline, no layout shift).
// Exposes a combined className of CSS-variable classes to attach to <html> so the families
// referenced by fonts.ts stacks (var(--font-instrument), …) resolve everywhere.

import { Instrument_Sans, Schibsted_Grotesk, Bricolage_Grotesque, Figtree, Archivo }
  from 'next/font/google';

// Explicit weight arrays, not 'variable': loading the variable axis costs materially more bytes
// and the pairings use exactly two weights each. See lib/fonts.ts for which.
// Instrument Sans has no 800 (it ships 400 to 700), which is why its pairing's display weight is
// 700. Asking next/font for a weight a family does not ship is a build error.
const instrument = Instrument_Sans({ subsets: ['latin'], variable: '--font-instrument', weight: ['400', '700'], display: 'swap' });
const schibsted  = Schibsted_Grotesk({ subsets: ['latin'], variable: '--font-schibsted', weight: ['400', '800'], display: 'swap' });
const bricolage  = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-bricolage', weight: ['400', '800'], display: 'swap' });
const figtree    = Figtree({ subsets: ['latin'], variable: '--font-figtree', weight: ['400', '800'], display: 'swap' });
const archivo    = Archivo({ subsets: ['latin'], variable: '--font-archivo', weight: ['500', '800'], display: 'swap' });

// The CONSOLE loads all five unconditionally and WITHOUT preload:false, unlike the template's
// twin. It is the pairing picker and the preview surface, so every family has to be resolvable at
// once and the bytes are an operator-machine cost, not a client-site cost. Do not sync the two.
export const industryFontVars = [
  instrument.variable, schibsted.variable, bricolage.variable, figtree.variable, archivo.variable,
].join(' ');
