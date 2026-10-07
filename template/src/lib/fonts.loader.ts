// Loads the curated pairing families via next/font (self-hosted, offline, no layout
// shift), and exposes ONLY the CSS-variable classes a given brand actually references.
//
// WHY THIS IS SELECTIVE (measured, 2026-08-18)
// This module used to export `industryFontVars`, a single string of all the families'
// variable classes, which layout.tsx attached to <html> unconditionally. next/font preloads
// by default, so every client site shipped **12 <link rel="preload" as="font"> tags and
// 292KB of woff2** — the single largest category of bytes on the page, larger than the hero
// image (153KB) and the largest script (92KB).
//
// The e2e HVAC client's brand.typography is a plain system stack
// (`-apple-system, BlinkMacSystemFont, "Segoe UI"`), so not one glyph of that 292KB was
// used. Preloads are high priority, so on throttled mobile they saturated the connection and
// starved the render path: LCP was 4.2s of which 3519ms (84%) was Render Delay, on a *text*
// element. Lighthouse Performance 84.
//
// Two changes, both needed:
//   1. `preload: false` on every family — kills the preload tags, so nothing is fetched
//      before CSS has established whether it is wanted at all.
//   2. `fontVarsFor()` attaches only the families the brand's stacks name, so an unreferenced
//      @font-face never matches an element and is therefore never downloaded.
//
// Net: a system-stack client ships ZERO font bytes, and a client on a pairing ships ONE
// family at two weights rather than all five.
//
// The CONSOLE's twin of this file deliberately still loads all five — it is the pairing picker
// and preview surface and needs every family resolvable at once. Do not "sync" the two.
//
// If a client on a real web font ever shows a swap cost worth fixing, add a targeted
// <link rel="preload"> in layout.tsx for that one family. Do not re-enable blanket preload.

import { Instrument_Sans, Schibsted_Grotesk, Bricolage_Grotesque, Figtree, Archivo }
  from 'next/font/google';

// Explicit weight arrays, not 'variable': the variable axis costs materially more bytes and each
// pairing uses exactly two weights. Instrument Sans has no 800 (it ships 400 to 700), which is why
// its pairing's display weight is 700; asking for a weight a family does not ship is a build error.
const instrument = Instrument_Sans({ subsets: ['latin'], variable: '--font-instrument', weight: ['400', '700'], display: 'swap', preload: false });
const schibsted  = Schibsted_Grotesk({ subsets: ['latin'], variable: '--font-schibsted', weight: ['400', '800'], display: 'swap', preload: false });
const bricolage  = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-bricolage', weight: ['400', '800'], display: 'swap', preload: false });
const figtree    = Figtree({ subsets: ['latin'], variable: '--font-figtree', weight: ['400', '800'], display: 'swap', preload: false });
const archivo    = Archivo({ subsets: ['latin'], variable: '--font-archivo', weight: ['500', '800'], display: 'swap', preload: false });

/**
 * CSS variable name -> the next/font class that defines it.
 *
 * Keys must stay in step with `varName` in the console's `lib/fonts.ts` FONT_PAIRINGS, which
 * is what writes `var(--font-instrument), system-ui, sans-serif` style stacks into
 * brand.typography. A key missing here means that font silently never loads.
 * console/test/fonts.test.mjs asserts the two stay in step.
 */
const VAR_TO_CLASS: Record<string, string> = {
  '--font-instrument': instrument.variable,
  '--font-schibsted': schibsted.variable,
  '--font-bricolage': bricolage.variable,
  '--font-figtree': figtree.variable,
  '--font-archivo': archivo.variable,
};

/**
 * The variable classes needed by the given font stacks, deduped.
 *
 * Pass `brand.typography.fontSans` / `.fontHeading`. A stack naming no `--font-*` variable
 * (i.e. a pure system stack) yields an empty string, and the site ships no font files.
 */
export function fontVarsFor(...stacks: (string | null | undefined)[]): string {
  const joined = stacks.filter(Boolean).join(' ');
  const needed = new Set<string>();
  for (const [varName, className] of Object.entries(VAR_TO_CLASS)) {
    // Word-boundary-ish check: `--font-archivo` must not match inside `--font-archivo-expanded`.
    if (new RegExp(`${varName}(?![\\w-])`).test(joined)) needed.add(className);
  }
  return [...needed].join(' ');
}
