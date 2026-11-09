// Which sections rise into view as the visitor scrolls. No imports: tests load it directly.
//
// The generic catalog components bring their own entrance motion (framer-motion `whileInView`
// with the @jdd/ui `reveal` presets). The bespoke vertical sets — Hvac*, Roofing*, Lawn*,
// Plumbing*, Detail* — were built without any, so a site composed from a vertical template had no
// animate-in at all (`_e2e_test_growth`, 2026-11-09). Rather than edit sixty components, the
// exporter marks each section that needs one with REVEAL_CLASS, and the template's globals.css
// animates it with a CSS scroll-driven animation:
//   - no JavaScript and nothing hidden on first paint, so no layout shift and no LCP cost
//     ("below-fold reveals are CSS", @jdd/ui motion.ts);
//   - a browser without scroll-driven animations, or a visitor who prefers reduced motion,
//     simply sees the section, never a blank one.

export const REVEAL_CLASS = 'rv';

/**
 * Components that already animate themselves. Adding a section reveal on top would stack two
 * entrances. KEEP IN STEP with the catalog: console/test/reveal-policy.test.mjs fails when a
 * component's source gains or loses framer-motion / @/lib/motion and this list doesn't follow.
 */
export const SELF_ANIMATED: ReadonlySet<string> = new Set([
  'AboutFeature',
  'BeforeAfter',
  'ContactCardOverlap',
  'ContactSplit',
  'DifferentiatorsIndex',
  'DifferentiatorsPanels',
  'FaqAccordion',
  'FaqIndex',
  'FinalCtaSimple',
  'FinalCtaSplit',
  'HeroOverlap',
  'NavMinimal',
  'RecentJobsGrid',
  'ServicesAccordion',
  'ServicesPanel',
  'ServicesShowcase',
  'ServicesSpotlight',
  'StatsBand',
  'StatsLedger',
  'TestimonialsCarousel',
  'TestimonialsGrid',
  'TestimonialsMarquee',
  'WorkMasonry',
  'WorkSpotlight',
]);

/** What opens a page: on screen at first paint, so never animated (the motion budget's rule). */
const ABOVE_THE_FOLD = new Set(['nav', 'hero', 'pageHeader']);

/**
 * Whether one body section of a page gets the scroll reveal. `indexInPage` is its position among
 * the page's sections (nav and footer are chrome and never passed here).
 */
export function revealsOnScroll(ref: { categoryId: string; name: string }, indexInPage: number): boolean {
  if (indexInPage === 0) return false; // the first section is what the visitor lands on
  if (ABOVE_THE_FOLD.has(ref.categoryId)) return false;
  return !SELF_ANIMATED.has(ref.name);
}
