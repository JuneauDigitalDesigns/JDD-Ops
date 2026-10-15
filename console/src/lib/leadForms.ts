/**
 * Component names (SectionRef.name, matching the CATALOG allowlist in export.ts) that render a
 * <LeadForm> and so actually capture a lead. Shared by validateComposition (pages.ts) and
 * test/lead-mode-invariants.test.mjs, so a new form component that forgets to join this set is
 * caught by the test rather than silently shipping a site that captures nothing.
 *
 * FinalCtaSimple is NOT here — it renders a phone CTA only, no form.
 */
export const LEAD_FORM_NAMES = new Set([
  'HeroFormFocus',
  'ContactCardOverlap',
  'ContactInlineStrip',
  'ContactSplit',
  'FinalCtaBanner',
  'FinalCtaSplit',
]);
