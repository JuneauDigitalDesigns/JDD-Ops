// Loads the curated industry font families via next/font (self-hosted, offline, no layout
// shift), and exposes ONLY the CSS-variable classes a given brand actually references.
//
// WHY THIS IS SELECTIVE (measured, 2026-08-18)
// This module used to export `industryFontVars`, a single string of all eight families'
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
// Net: a system-stack client (most of them) now ships ZERO font bytes.
//
// The CONSOLE's twin of this file deliberately still loads all eight — it is the font picker
// and preview surface and needs every family resolvable at once. Do not "sync" the two.
//
// If a client on a real web font ever shows a swap cost worth fixing, add a targeted
// <link rel="preload"> in layout.tsx for that one family. Do not re-enable blanket preload.

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

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap', preload: false });
const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap', preload: false });
const poppins = Poppins({ subsets: ['latin'], variable: '--font-poppins', weight: ['400', '500', '600', '700', '800'], display: 'swap', preload: false });
const sora = Sora({ subsets: ['latin'], variable: '--font-sora', display: 'swap', preload: false });
const workSans = Work_Sans({ subsets: ['latin'], variable: '--font-worksans', display: 'swap', preload: false });
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta', display: 'swap', preload: false });
const slab = Roboto_Slab({ subsets: ['latin'], variable: '--font-slab', display: 'swap', preload: false });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair', display: 'swap', preload: false });

/**
 * CSS variable name -> the next/font class that defines it.
 *
 * Keys must stay in step with `varName` in the console's `lib/fonts.ts` FONT_OPTIONS, which
 * is what writes `var(--font-inter), system-ui, sans-serif` style stacks into
 * brand.typography. A key missing here means that font silently never loads.
 */
const VAR_TO_CLASS: Record<string, string> = {
  '--font-inter': inter.variable,
  '--font-manrope': manrope.variable,
  '--font-poppins': poppins.variable,
  '--font-sora': sora.variable,
  '--font-worksans': workSans.variable,
  '--font-jakarta': jakarta.variable,
  '--font-slab': slab.variable,
  '--font-playfair': playfair.variable,
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
    // Word-boundary-ish check: `--font-slab` must not match inside `--font-slabby`.
    if (new RegExp(`${varName}(?![\\w-])`).test(joined)) needed.add(className);
  }
  return [...needed].join(' ');
}
