/**
 * THE shared design tokens for every client site.
 *
 * Imported by BOTH template/tailwind.config.ts and console/tailwind.config.ts, so the studio
 * preview and the exported site resolve identical sizes. Before this file existed, the template
 * had no scale at all (only fontFamily and one backgroundImage), so every size, gutter, radius and
 * shadow in the catalog was an inline arbitrary value decided per component. That is gap G2 in
 * design/RESEARCH-local-service-visual-design.md and it is the mechanical reason components drift
 * as they are edited.
 *
 * Lives under src/styles/ so TEMPLATE_OWNED_PREFIXES refreshes it into client repos on an
 * `overwrite` export, in the same pass as the tailwind.config.ts that imports it.
 *
 * DEPENDENCY-FREE on purpose: loaded by Tailwind's jiti config loader from two different
 * directories. No imports, no types from tailwindcss.
 *
 * Numbers come from design/catalog-v2/SPEC.md §3 (type) and §5 (buttons), which are measured
 * against a 390px phone and a 1000px+ desktop, not invented here.
 */

/* ── Type scale ───────────────────────────────────────────────────────────────
   Fluid clamp() per decision 8, with negative tracking baked into the large steps so a display
   size is never set without its tracking. Tailwind fontSize entries are
   [size, { lineHeight, letterSpacing, fontWeight? }].

   Key names are deliberately NOT Tailwind's sm/base/lg/xl: the console's own chrome owns those
   keys with a 14px body floor, and these two scales must not collide.

   Explicitly typed (not `as const`) on purpose: `as const` would freeze each [size, config] pair
   into a READONLY tuple, and Tailwind's Config type wants a MUTABLE tuple there. This is a type
   annotation only, zero runtime import, so the module stays dependency-free. */
export const fontSize: Record<string, [string, { lineHeight: string; letterSpacing?: string }]> = {
  // 36px at 390 -> 58px at 1000+, capped. SPEC §3's h1. "Names the service and the city."
  'display-1': ['clamp(2.25rem, 1.42rem + 3.60vw, 3.625rem)', { lineHeight: '1.02', letterSpacing: '-0.022em' }],
  // 32px -> 42px. SPEC §3's h2.
  'display-2': ['clamp(2rem, 1.62rem + 1.65vw, 2.625rem)',    { lineHeight: '1.06', letterSpacing: '-0.018em' }],
  // 24px -> 28px. Sub-section headings, and the large half of a two-step hierarchy inside a
  // stacked-panels or editorial-index row.
  'display-3': ['clamp(1.5rem, 1.35rem + 0.65vw, 1.75rem)',   { lineHeight: '1.12', letterSpacing: '-0.014em' }],
  // 21px fixed. SPEC §3's h3. A card title does not need to grow with the viewport.
  'card-title': ['1.3125rem', { lineHeight: '1.25', letterSpacing: '-0.010em' }],
  // 19px -> 21px. One step above body: the sticky call bar's digits, a hero sub, a pull quote.
  lead:  ['clamp(1.1875rem, 1.13rem + 0.25vw, 1.3125rem)', { lineHeight: '1.42', letterSpacing: '-0.005em' }],
  // 17px fixed. SPEC §3's body. THE workhorse.
  body:  ['1.0625rem', { lineHeight: '1.55' }],
  // 15px fixed. SPEC §3's small / proof text.
  small: ['0.9375rem', { lineHeight: '1.50' }],
  // 13px. The floor. Legal lines, the assurance line under the phone digits, meta.
  // Nothing below this, ever: the next step down is unreadable on a phone in sunlight.
  fine:  ['0.8125rem', { lineHeight: '1.45', letterSpacing: '0.010em' }],
};

/* ── Tracking ─────────────────────────────────────────────────────────────────
   The old `tracking-[-0.03em]` and `tracking-[0.24em]` are both CUT (SPEC §3; the second is
   already enforced by console/test/catalog-invariants.test.mjs). These four are the whole set. */
export const letterSpacing = {
  display: '-0.022em',  // only on text already set at display-1
  tight:   '-0.015em',  // SPEC §3's heading default
  snug:    '-0.010em',
  wide:    '0.010em',   // the ONLY positive step. Not a wide-tracked uppercase eyebrow.
} as const;

/* ── Spacing ──────────────────────────────────────────────────────────────────
   Added to Tailwind's default spacing scale, not replacing it. Only the named steps a component
   should reach for; everything else stays on the stock 4px ramp.

   The `section-*` steps are consumed by rhythm.plugin.ts, which is the ONLY thing that should use
   them: section padding is decided by the page template, never by the component (decision 24). */
export const spacing = {
  gutter:        'clamp(1.25rem, 0.90rem + 1.60vw, 2rem)',  // 20px -> 32px page gutter
  'section-tight':  'clamp(1.75rem, 1.40rem + 1.60vw, 2.75rem)', // 28px -> 44px
  'section-normal': 'clamp(3rem, 2.30rem + 3.20vw, 5rem)',       // 48px -> 80px
  'section-loose':  'clamp(4.50rem, 3.30rem + 5.40vw, 8rem)',    // 72px -> 128px
} as const;

/* ── Radius ───────────────────────────────────────────────────────────────────
   SPEC §5: buttons are 8px. "Nothing is a pill; nothing is rounded-sm."
   `rounded-control` is the single radius for every button, input and tappable chip, so a client
   site cannot end up with three button shapes. */
export const borderRadius = {
  control: '8px',
  panel:   '14px',   // cards, media frames
  slab:    '2px',    // a near-square corner, for a deliberately hard-edged panel
} as const;

/* ── Elevation ────────────────────────────────────────────────────────────────
   One ladder, warm-tinted to match decision 9's warm charcoal ink. The light-surface values are
   byte-for-byte what services/ServicesGrid.tsx already inlines, so adopting the token is a visual
   no-op on that component and a correction everywhere else.

   `shadow-slab` is the card default. `shadow-slab-lift` is its hover twin. `shadow-slab-ink` is
   the inverted-surface twin, because a warm shadow is invisible on a dark panel. */
export const boxShadow = {
  slab:        '0 1px 2px rgba(28,16,9,.05), 0 14px 30px -12px rgba(28,16,9,.22)',
  'slab-lift': '0 2px 4px rgba(28,16,9,.06), 0 22px 42px -14px rgba(28,16,9,.28)',
  'slab-ink':  '0 14px 30px -12px rgba(0,0,0,.50)',
  // The offset-shadow primary CTA from DESIGN-LANGUAGE.md's editorial signature, as a token
  // rather than an inline arbitrary value. Light and inverted variants.
  offset:      '4px 4px 0 rgba(28,16,9,.85)',
  'offset-ink':'4px 4px 0 rgba(255,255,255,.12)',
} as const;

/* ── Measure ──────────────────────────────────────────────────────────────────
   Tier B's "left-aligned ragged-right text with generous margins and controlled max-widths"
   (research §5). `max-w-measure` is the one correct width for a paragraph. */
export const maxWidth = {
  measure: '46ch',
  content: '72rem',   // the page container, matching the catalog's existing max-w-6xl
} as const;
