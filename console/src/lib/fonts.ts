// Curated TYPE PAIRINGS, replacing the old loose FONT_OPTIONS list (decision 6 of
// console/design/DECISIONS-template-fidelity-v2.md).
//
// WHY A PAIRING AND NOT TWO DROPDOWNS. The old registry offered eight families across two
// independent selects, which is 64 combinations, of which roughly four were any good and most
// read as the statistically-average web (gap G1: six of the eight were Inter / Manrope / Poppins /
// Sora / Work Sans / Plus Jakarta Sans). An operator cannot be expected to know which pairing is
// premium. So the operator picks ONE pairing and gets a whole typographic position.
//
// THE MODEL (decision 7): a single high-quality grotesque carries the whole site. Display and body
// are the SAME family, differentiated by weight, size and tracking. This is Haven Constructions'
// move (Suisse Intl alone) rather than Spence's (a paid display serif over a paid grotesque), and
// it is the one of the two that is reachable with open faces.
//
// LICENSING (decision 5): every family here is open-licensed and served by next/font/google, which
// SELF-HOSTS the woff2 at build time. No Typekit, no paid regime, no runtime third-party request.
//
// CLIENT-SAFE: no next/font import here, so the Brand drawer can use it. The families are loaded
// in fonts.loader.ts (console) and template/src/lib/fonts.loader.ts (template). A `varName` that
// no loader defines means that font silently never loads, so the two loaders' VAR_TO_CLASS keys
// must stay in step with `varName` below. console/test/fonts.test.mjs asserts that they do.
//
// Availability and weights verified 2026-10-06 against
// node_modules/next/dist/compiled/@next/font/dist/google/font-data.json on Next 14.2.35.

/** One curated typographic position. `display` and `body` are treatments of ONE family. */
export interface FontPairing {
  id: string;
  label: string;
  /** The CSS variable both loaders define via next/font. */
  varName: string;
  /** The full font-family stack written into brand.typography. */
  stack: string;
  /** Display treatment. `weight` must be a weight the family actually ships. */
  display: { weight: number; tracking: string; lineHeight: number };
  body: { weight: number };
  /** One sentence for the operator, shown under the specimen. No em-dashes. */
  note: string;
}

export const FONT_PAIRINGS: FontPairing[] = [
  {
    id: 'instrument',
    label: 'Instrument',
    varName: '--font-instrument',
    stack: 'var(--font-instrument), system-ui, sans-serif',
    // Instrument Sans ships 400/500/600/700 ONLY (verified in font-data.json). SPEC §3 asks for
    // 800 headings; this family has no 800, and requesting one from next/font is a build error.
    // 700 at display-1 with -0.022em tracking reads as heavy as an 800 at a looser track.
    display: { weight: 700, tracking: '-0.022em', lineHeight: 1.02 },
    body: { weight: 400 },
    note: 'Neutral and modern. The quietest of the five, and the one that gets out of the way of photography.',
  },
  {
    id: 'schibsted',
    label: 'Schibsted Grotesk',
    varName: '--font-schibsted',
    stack: 'var(--font-schibsted), system-ui, sans-serif',
    display: { weight: 800, tracking: '-0.020em', lineHeight: 1.02 },
    body: { weight: 400 },
    note: 'Editorial. Built for a newspaper, so it holds a heavy weight without looking generic.',
  },
  {
    id: 'bricolage',
    label: 'Bricolage Grotesque',
    varName: '--font-bricolage',
    stack: 'var(--font-bricolage), system-ui, sans-serif',
    display: { weight: 800, tracking: '-0.018em', lineHeight: 1.00 },
    body: { weight: 400 },
    note: 'Has a voice. Pick it when the business has one too.',
  },
  {
    id: 'figtree',
    label: 'Figtree',
    varName: '--font-figtree',
    stack: 'var(--font-figtree), system-ui, sans-serif',
    display: { weight: 800, tracking: '-0.020em', lineHeight: 1.04 },
    body: { weight: 400 },
    note: 'Warm and humanist. The friendliest of the five without being soft.',
  },
  {
    id: 'archivo',
    label: 'Archivo',
    varName: '--font-archivo',
    stack: 'var(--font-archivo), system-ui, sans-serif',
    display: { weight: 800, tracking: '-0.024em', lineHeight: 0.98 },
    // Archivo's 400 is slightly light at 17px, so its body steps up one notch.
    body: { weight: 500 },
    note: 'Tight and industrial. The closest to a trade condensed face without the 2016 register.',
  },
];

export const DEFAULT_PAIRING_ID = 'instrument';

const BY_ID = new Map(FONT_PAIRINGS.map((p) => [p.id, p]));

/** The pairing for an id, falling back to the default. Guarded because a draft or a client record
 *  can carry an id from a registry revision that no longer exists, and a missing pairing must not
 *  crash the Brand drawer. */
export function pairingFor(id: string | null | undefined): FontPairing {
  return (id ? BY_ID.get(id) : undefined) ?? BY_ID.get(DEFAULT_PAIRING_ID)!;
}

/**
 * A pairing as `brand.typography`. Exactly the six fields the schema's typography object carries,
 * so a caller can splat it: `brand.typography = typographyFor('instrument')`.
 *
 * This is what makes a pairing ONE choice: the operator picks an id and all six fields move
 * together, instead of two font strings moving independently of three numeric treatments.
 */
export function typographyFor(id: string | null | undefined) {
  const p = pairingFor(id);
  return {
    fontSans: p.stack,
    fontHeading: p.stack,
    headingWeight: p.display.weight,
    bodyWeight: p.body.weight,
    headingTracking: p.display.tracking,
    headingLineHeight: p.display.lineHeight,
  };
}

/** The pairing whose `stack` matches an authored brand.typography value, or null for a system
 *  stack or a stack from the retired FONT_OPTIONS registry. The Brand drawer uses this to show
 *  which pairing is selected without storing a separate id in the schema. */
export function pairingIdFromStack(stack: string | null | undefined): string | null {
  if (!stack) return null;
  return FONT_PAIRINGS.find((p) => p.stack === stack)?.id ?? null;
}
