// Loads the curated pairing families via next/font/local, from the SAME committed woff2 files the
// template ships (jdd-ops/template/src/lib/fonts/). Exposes a combined className of CSS-variable
// classes to attach to <html> so the families referenced by fonts.ts stacks
// (var(--font-instrument), …) resolve everywhere.
//
// WHY LOCAL, AND WHY THE TEMPLATE'S FILES (2026-11-04)
// These used to be next/font/google, which downloads every family during `next build`. A
// postinstall patch (JDD-Ops #16, now removed) fixed Next 14's crash on Google's extensionless
// `/l/font` URLs, but not a download that simply fails: the console's own build
// failed that way on 2026-11-04 (TLS disconnects from fonts.gstatic.com). Local files take the
// network out of the build. Pointing at the template's copies rather than a second set means the
// console previews exactly the bytes a client site ships, and one vendor run
// (jdd-ops/scripts/vendor-fonts.js) updates both.
//
// Each family names its one variable file once per weight, which is face for face what
// next/font/google generated. The weights are the ones each pairing uses (lib/fonts.ts).
// Instrument Sans has no 800 (it ships 400 to 700), which is why its pairing's display weight is
// 700. next/font needs literal arguments, so these cannot be generated from a list.

import localFont from 'next/font/local';

const instrument = localFont({ src: [{ path: '../../../template/src/lib/fonts/instrument-sans.woff2', weight: '400', style: 'normal' }, { path: '../../../template/src/lib/fonts/instrument-sans.woff2', weight: '700', style: 'normal' }], variable: '--font-instrument', display: 'swap' });
const schibsted  = localFont({ src: [{ path: '../../../template/src/lib/fonts/schibsted-grotesk.woff2', weight: '400', style: 'normal' }, { path: '../../../template/src/lib/fonts/schibsted-grotesk.woff2', weight: '800', style: 'normal' }], variable: '--font-schibsted', display: 'swap' });
const bricolage  = localFont({ src: [{ path: '../../../template/src/lib/fonts/bricolage-grotesque.woff2', weight: '400', style: 'normal' }, { path: '../../../template/src/lib/fonts/bricolage-grotesque.woff2', weight: '800', style: 'normal' }], variable: '--font-bricolage', display: 'swap' });
const figtree    = localFont({ src: [{ path: '../../../template/src/lib/fonts/figtree.woff2', weight: '400', style: 'normal' }, { path: '../../../template/src/lib/fonts/figtree.woff2', weight: '800', style: 'normal' }], variable: '--font-figtree', display: 'swap' });
const archivo    = localFont({ src: [{ path: '../../../template/src/lib/fonts/archivo.woff2', weight: '500', style: 'normal' }, { path: '../../../template/src/lib/fonts/archivo.woff2', weight: '800', style: 'normal' }], variable: '--font-archivo', display: 'swap' });
// Two-family 'oswald' pairing: condensed DISPLAY (Oswald, ships 200–700) + humanist BODY (Inter).
const oswald     = localFont({ src: [{ path: '../../../template/src/lib/fonts/oswald.woff2', weight: '600', style: 'normal' }, { path: '../../../template/src/lib/fonts/oswald.woff2', weight: '700', style: 'normal' }], variable: '--font-oswald', display: 'swap' });
const inter      = localFont({ src: [{ path: '../../../template/src/lib/fonts/inter.woff2', weight: '400', style: 'normal' }, { path: '../../../template/src/lib/fonts/inter.woff2', weight: '600', style: 'normal' }, { path: '../../../template/src/lib/fonts/inter.woff2', weight: '700', style: 'normal' }], variable: '--font-inter', display: 'swap' });

// The CONSOLE loads all of them unconditionally and WITHOUT preload:false, unlike the template's
// twin. It is the pairing picker and the preview surface, so every family has to be resolvable at
// once and the bytes are an operator-machine cost, not a client-site cost. Do not sync the two.
export const industryFontVars = [
  instrument.variable, schibsted.variable, bricolage.variable, figtree.variable, archivo.variable,
  oswald.variable, inter.variable,
].join(' ');
