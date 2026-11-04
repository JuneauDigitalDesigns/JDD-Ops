// Loads the curated pairing families via next/font/local from files COMMITTED in ./fonts/,
// and exposes ONLY the CSS-variable classes a given brand actually references.
//
// WHY LOCAL FILES, NOT next/font/google (2026-11-04)
// next/font/google downloads every family declared here during `next build`, on Vercel, for
// every client deploy, even a system-stack client that ships none of them. That made every
// client build depend on Google answering correctly:
//   - ~5% of Google Fonts CSS responses list a file as `fonts.gstatic.com/l/font?kit=…` with no
//     extension, and Next 14.2's google loader crashes on those ("Cannot read properties of null
//     (reading '1')"). Seven families per build made that a frequent random failure. JDD-Ops #16
//     patched the console's Next for it; the console now self-hosts too, and the patch is gone.
//   - A download that fails or times out fails the build outright. That broke an agency
//     production build, and a console build, on 2026-11-04. No patch can fix it.
// Local files remove the network from the build entirely. The woff2 files are exactly what
// next/font/google was downloading (latin subset, Chrome user agent), fetched once by
// jdd-ops/scripts/vendor-fonts.js. To add a family or weight, edit that script's
// TARGETS, run it, and add the entry below. Never import next/font/google in a client repo:
// jdd-ops/test/template-fonts.test.mjs fails if anything under template/src does.
//
// Google serves each of these families as ONE variable file and lists it once per requested
// weight, so each family below names the same file once per weight. That reproduces the
// @font-face rules next/font/google generated, face for face, so rendering is unchanged.
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
// The CONSOLE's twin of this file (console/src/lib/fonts.loader.ts) loads these same files, but
// deliberately still loads all of them — it is the pairing picker
// and preview surface and needs every family resolvable at once. Do not "sync" the two.
//
// If a client on a real web font ever shows a swap cost worth fixing, add a targeted
// <link rel="preload"> in layout.tsx for that one family. Do not re-enable blanket preload.

import localFont from 'next/font/local';

// The weights are the ones each pairing uses (console/src/lib/fonts.ts). Instrument Sans has no
// 800 (it ships 400 to 700), which is why its pairing's display weight is 700. A pairing weight
// with no face here renders as the nearest declared face, not as an error, so
// console/test/fonts.test.mjs checks every pairing weight against the faces declared below.
// next/font needs literal arguments, so these cannot be generated from a list.
const instrument = localFont({ src: [{ path: './fonts/instrument-sans.woff2', weight: '400', style: 'normal' }, { path: './fonts/instrument-sans.woff2', weight: '700', style: 'normal' }], variable: '--font-instrument', display: 'swap', preload: false });
const schibsted  = localFont({ src: [{ path: './fonts/schibsted-grotesk.woff2', weight: '400', style: 'normal' }, { path: './fonts/schibsted-grotesk.woff2', weight: '800', style: 'normal' }], variable: '--font-schibsted', display: 'swap', preload: false });
const bricolage  = localFont({ src: [{ path: './fonts/bricolage-grotesque.woff2', weight: '400', style: 'normal' }, { path: './fonts/bricolage-grotesque.woff2', weight: '800', style: 'normal' }], variable: '--font-bricolage', display: 'swap', preload: false });
const figtree    = localFont({ src: [{ path: './fonts/figtree.woff2', weight: '400', style: 'normal' }, { path: './fonts/figtree.woff2', weight: '800', style: 'normal' }], variable: '--font-figtree', display: 'swap', preload: false });
const archivo    = localFont({ src: [{ path: './fonts/archivo.woff2', weight: '500', style: 'normal' }, { path: './fonts/archivo.woff2', weight: '800', style: 'normal' }], variable: '--font-archivo', display: 'swap', preload: false });
// Two-family 'oswald' pairing: condensed DISPLAY (Oswald, ships 200–700) + humanist BODY (Inter).
const oswald     = localFont({ src: [{ path: './fonts/oswald.woff2', weight: '600', style: 'normal' }, { path: './fonts/oswald.woff2', weight: '700', style: 'normal' }], variable: '--font-oswald', display: 'swap', preload: false });
const inter      = localFont({ src: [{ path: './fonts/inter.woff2', weight: '400', style: 'normal' }, { path: './fonts/inter.woff2', weight: '600', style: 'normal' }, { path: './fonts/inter.woff2', weight: '700', style: 'normal' }], variable: '--font-inter', display: 'swap', preload: false });

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
  '--font-oswald': oswald.variable,
  '--font-inter': inter.variable,
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
