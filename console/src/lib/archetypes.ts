/**
 * The structural-archetype vocabulary. Decision 23 of
 * console/design/DECISIONS-template-fidelity-v2.md: every component DECLARES its archetype in
 * `meta.archetype`, and console/test/catalog-invariants.test.mjs fails when two variants in one
 * category share one. The variety rule becomes mechanical instead of prose.
 *
 * WHY THIS MATTERS. Research §6 item 7 names "identical navigation patterns across every section
 * and page" and item 8 names "uniform section rhythm" as two of the eight things that make a site
 * read as AI-made. Gap G6 is that with two variants in six categories there is not enough catalog
 * for two sites built from it to look like different sites: two clients in the same vertical land
 * on the same composition. The collision lint is what stops a THIRD variant being added as a
 * decorated copy of an existing one, which is the cheap way to grow a count without growing
 * variety.
 *
 * DEPENDENCY-FREE on purpose: imported by relative path from a .mjs test.
 * Keep in step with the archetype table in console/DESIGN-LANGUAGE.md.
 */
export const ARCHETYPES = [
  'accordion',
  'aggregate-badge',
  'asymmetric-split',
  'before-after',
  'card-grid',
  'centered-statement',
  'column-grid',
  'count-up-centerpiece',
  'dense-mosaic',
  'editorial-index',
  'feature-rail',
  'form-led-split',
  'full-bleed-band',
  'full-bleed-overlay',
  'hero-first-grid',
  'horizontal-pin',
  'inline-strip',
  'map-list',
  'marquee',
  'numbered-ledger',
  'overlap-split',
  'snap-carousel',
  'stacked-bars',
  'stacked-panels',
  'sticky-bar',
  'sticky-swap',
  /** Non-visual. SEO variants emit metadata or JSON-LD and render nothing, so they have no
   *  structure to vary and are exempt from the collision rule. */
  'none',
] as const;

export type Archetype = typeof ARCHETYPES[number];

/** Categories exempt from the collision rule, because their members have no structure. */
export const COLLISION_EXEMPT_CATEGORIES = ['seo'] as const;
