/**
 * Vertical whole-site templates — the Studio's new unit of choice.
 *
 * Instead of many per-page templates (see the archived PAGE_TEMPLATES in page-templates.tsx),
 * each industry vertical gets ONE bespoke template whose layout/spacing/colors/icons apply
 * across all four core pages at once. The operator picks the template for the vertical chosen
 * in intake, and `applyVerticalTemplate` replaces the entire composition (chrome + pages) in a
 * single action. Content is still the client's own, filled/edited in the Studio.
 *
 * A template is a builder that returns a fresh SiteComposition with minted section ids. Section
 * `rhythm` is left UNSET on purpose: the bespoke Hvac* components encode the mockup's own
 * vertical padding, and an rh-* wrapper would override it with the token band (rhythm.plugin.ts
 * forces `padding-block !important`). Unset also means validateComposition's uniform-rhythm ban
 * (decision 30d) is not triggered, since it only fires when every rhythm is set.
 *
 * HVAC is the first vertical built. Home, Services, About, and Contact all use the Northstar
 * Standard sections (Hvac*). Verticals with no entry here fall back to the generic
 * defaultCompositionFor() and are offered no template card yet.
 */
import { newSectionId, type PageInstance, type PageTypeId, type SectionRef, type SiteComposition } from '@/lib/pages';
import type { VerticalId } from '@/lib/verticals';

/** A section ref with a freshly minted stable id and no rhythm (see file header). */
const S = (categoryId: string, name: string): SectionRef => ({ id: newSectionId(), categoryId, name });

const PAGE_META: Record<'home' | 'services' | 'about' | 'contact', { route: string; label: string }> = {
  home:     { route: '',         label: 'Home' },
  services: { route: 'services', label: 'Services' },
  about:    { route: 'about',    label: 'About' },
  contact:  { route: 'contact',  label: 'Contact' },
};

function page(
  pageType: 'home' | 'services' | 'about' | 'contact',
  templateId: string,
  sections: SectionRef[],
): PageInstance {
  const meta = PAGE_META[pageType];
  return {
    route: meta.route,
    pageType: pageType as PageTypeId,
    label: meta.label,
    templateId,
    navVisible: true,
    sections,
  };
}

/**
 * HVAC — the Northstar "Home — Standard" mockup, applied to all four pages.
 * Home follows the mockup section order. Services, About, and Contact open with HvacPageHeader
 * (validateComposition requires a pageHeader on every non-home page) and reuse the same sections.
 */
function hvacTemplate(): SiteComposition {
  return {
    chrome: {
      nav:    { id: newSectionId(), categoryId: 'nav', name: 'HvacNav' },
      footer: { id: newSectionId(), categoryId: 'footer', name: 'HvacFooter' },
      seo:    { id: newSectionId(), categoryId: 'seo', name: 'SeoLocalBusiness' },
    },
    pages: [
      // Home — the Standard tab, in order. No pageHeader (uses the hero).
      page('home', 'hvac:home', [
        S('hero', 'HvacHero'),
        S('stats', 'HvacStatBand'),
        S('services', 'HvacServices'),
        S('trust', 'HvacServiceArea'),
        S('testimonials', 'HvacReviews'),
        S('faq', 'HvacFaq'),
        S('finalCta', 'HvacFinalCta'),
      ]),
      page('services', 'hvac:services', [
        S('pageHeader', 'HvacPageHeader'),
        S('services', 'HvacServices'),
        S('faq', 'HvacFaq'),
        S('finalCta', 'HvacFinalCta'),
      ]),
      page('about', 'hvac:about', [
        S('pageHeader', 'HvacPageHeader'),
        S('about', 'HvacAbout'),
        S('trust', 'HvacServiceArea'),
        S('testimonials', 'HvacReviews'),
        S('finalCta', 'HvacFinalCta'),
      ]),
      page('contact', 'hvac:contact', [
        S('pageHeader', 'HvacPageHeader'),
        S('contact', 'HvacContact'),
        S('faq', 'HvacFaq'),
        S('finalCta', 'HvacFinalCta'),
      ]),
    ],
  };
}

export type VerticalTemplate = {
  /** Operator-facing name shown on the Studio's single template card. */
  label: string;
  /** Builds a fresh 4-page composition with minted section ids. */
  build: () => SiteComposition;
};

export const VERTICAL_TEMPLATES: Partial<Record<VerticalId, VerticalTemplate>> = {
  hvac: { label: 'HVAC — Standard', build: hvacTemplate },
};

/** The template for a vertical, or null when none is built yet. */
export function verticalTemplateFor(vertical: VerticalId): VerticalTemplate | null {
  return VERTICAL_TEMPLATES[vertical] ?? null;
}

/** Build the whole-site composition for a vertical, or null when it has no template. */
export function applyVerticalTemplate(vertical: VerticalId): SiteComposition | null {
  return verticalTemplateFor(vertical)?.build() ?? null;
}
