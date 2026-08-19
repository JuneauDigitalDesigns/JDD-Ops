// Palette shim + the console's own typography vars.
//
// `paletteVars` and the contrast helpers come from @jdd/ui, shared with the template and
// every client repo. That unification fixed a real divergence: this file used to carry an
// older `paletteVars` with no dark-palette handling —
//
//     const inkPanel = shade(ink, 0.08);          // console (old)
//     const inkPanel = dark ? shade(bg, 0.25) : shade(ink, 0.08);   // template
//
// — so on a client with a dark brand palette the studio preview built a LIGHT contrast panel
// and resolved `--on-ink` to white-on-white, while the exported site rendered it correctly.
// The preview was lying about what would ship, and nothing caught it because both files
// typechecked and neither was ever diffed.
//
// `typographyVars` is NOT shared, deliberately. The console's version applies the body font
// and weight to the preview subtree so the brand drawer's font picker does something
// visible; a real site must not have that, because it would override the catalog's own
// typography. This is the same class of intentional seam as editable.tsx.
export { paletteVars, contrast, readableOn } from '@jdd/ui/palette';

import type { CSSProperties } from 'react';
import type { Brand } from '@jdd/schema';

export function typographyVars(brand: Brand): CSSProperties {
  const t = brand.typography;
  return {
    '--font-sans': t.fontSans,
    '--font-heading': t.fontHeading,
    '--heading-weight': String(t.headingWeight),
    '--body-weight': String(t.bodyWeight),
    '--heading-tracking': t.headingTracking ?? 'normal',
    '--heading-line-height': String(t.headingLineHeight ?? 1.15),
    // Actually APPLY the body font to the preview subtree.
    //
    // globals.css gives headings `font-family: var(--font-heading)` inside .studio-chrome,
    // but nothing claimed body text — so it inherited the console's own chrome font from
    // <body> and picking a body font in the drawer did nothing visible. Setting it here
    // scopes it exactly to the elements that receive these vars (the finalize <main>, the
    // build-step preview cards) instead of leaking into the wizard/drawer chrome.
    //
    // Headings are unaffected: the .studio-chrome :where(h1..h6) rule matches those
    // elements directly, which beats an inherited value from this ancestor.
    fontFamily: 'var(--font-sans)',
    fontWeight: 'var(--body-weight)',
  } as CSSProperties;
}
