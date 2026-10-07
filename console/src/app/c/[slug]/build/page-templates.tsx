/**
 * The page-template registry: for each kind of page, one or more ready-made compositions of the
 * existing section catalog. A "page template" is just an ordered list of SectionRef (into the
 * catalog); the Studio's page picker applies one to a page. Non-home templates open with a
 * `pageHeader`; Home stays lean (5 sections) per the locked design decisions.
 *
 * Every seed template uses an ADAPTING finalCta (Banner/Split) — those read _meta.selectedPlan
 * at render to pick email vs phone lead capture, so no plan-gating logic is needed here.
 */
import type { PageInstance, PageTemplate, PageTypeId, SiteComposition } from '@/lib/pages';
import { newSectionId } from '@/lib/pages';
import type { SkinId } from '@/lib/skins';

const S = (categoryId: string, name: string, skin?: SkinId) => (skin ? { categoryId, name, skin } : { categoryId, name });

export const PAGE_TEMPLATES: PageTemplate[] = [
  {
    id: 'home-standard', pageType: 'home', label: 'Home — Standard',
    sections: [S('hero', 'HeroSplit'), S('trust', 'TrustBadges'), S('services', 'ServicesGrid'), S('testimonials', 'TestimonialsGrid'), S('finalCta', 'FinalCtaBanner')],
  },
  {
    id: 'home-bold', pageType: 'home', label: 'Home — Bold',
    sections: [S('hero', 'HeroOverlap'), S('trust', 'TrustReviewsAggregate'), S('services', 'ServicesPanel'), S('testimonials', 'TestimonialsCarousel'), S('finalCta', 'FinalCtaSplit')],
  },
  {
    id: 'services-standard', pageType: 'services', label: 'Services — Standard',
    sections: [S('pageHeader', 'PageHeaderSimple'), S('services', 'ServicesGrid'), S('faq', 'FaqAccordion'), S('finalCta', 'FinalCtaBanner')],
  },
  {
    // Bolder, more scannable: feature panels + sticky-aside FAQ + split CTA. Differs from
    // services-standard in both variants and order-feel. Skins left at each component's default.
    id: 'services-panel', pageType: 'services', label: 'Services — Panel',
    sections: [S('pageHeader', 'PageHeaderSimple'), S('services', 'ServicesPanel'), S('trust', 'TrustBadges'), S('faq', 'FaqStickyAside'), S('finalCta', 'FinalCtaSplit')],
  },
  {
    id: 'about-standard', pageType: 'about', label: 'About — Standard',
    sections: [S('pageHeader', 'PageHeaderSimple'), S('about', 'AboutStory'), S('trust', 'ServiceArea'), S('testimonials', 'TestimonialsGrid'), S('finalCta', 'FinalCtaSplit')],
  },
  {
    // Proof-forward: the testimonial carousel moves ABOVE the trust band, and trust badges replace
    // the service-area block. Carousel + banner CTA distinguish it from about-standard.
    id: 'about-proof', pageType: 'about', label: 'About — Proof',
    sections: [S('pageHeader', 'PageHeaderSimple'), S('about', 'AboutStory'), S('testimonials', 'TestimonialsCarousel'), S('trust', 'TrustBadges'), S('finalCta', 'FinalCtaBanner')],
  },
  {
    id: 'contact-standard', pageType: 'contact', label: 'Contact — Standard',
    sections: [S('pageHeader', 'PageHeaderSimple'), S('contact', 'ContactSplit'), S('faq', 'FaqStickyAside'), S('finalCta', 'FinalCtaBanner')],
  },
  {
    // Contact-first with coverage: an overlap contact card + a service-area statement, lean CTA.
    // Drops the FAQ that contact-standard carries.
    id: 'contact-overlap', pageType: 'contact', label: 'Contact — Coverage',
    sections: [S('pageHeader', 'PageHeaderSimple'), S('contact', 'ContactCardOverlap'), S('trust', 'ServiceArea'), S('finalCta', 'FinalCtaSimple')],
  },
  // Optional 5th-page candidates — one template each for v1.
  {
    id: 'reviews-standard', pageType: 'reviews', label: 'Reviews — Standard',
    sections: [S('pageHeader', 'PageHeaderSimple'), S('testimonials', 'TestimonialsGrid'), S('trust', 'TrustReviewsAggregate'), S('finalCta', 'FinalCtaBanner')],
  },
  {
    id: 'gallery-standard', pageType: 'gallery', label: 'Gallery — Standard',
    sections: [S('pageHeader', 'PageHeaderSimple'), S('work', 'BeforeAfter'), S('finalCta', 'FinalCtaBanner')],
  },
  {
    id: 'areas-standard', pageType: 'areas', label: 'Service Areas — Standard',
    sections: [S('pageHeader', 'PageHeaderSimple'), S('trust', 'ServiceArea'), S('finalCta', 'FinalCtaBanner')],
  },
];

/** Templates available for a given page type (one or more; home + core pages have two). */
export function templatesFor(pageType: PageTypeId): PageTemplate[] {
  return PAGE_TEMPLATES.filter((t) => t.pageType === pageType);
}

/** Route + default nav label per page type. */
const PAGE_META: Record<PageTypeId, { route: string; label: string }> = {
  home:     { route: '',         label: 'Home' },
  services: { route: 'services', label: 'Services' },
  about:    { route: 'about',    label: 'About' },
  contact:  { route: 'contact',  label: 'Contact' },
  reviews:  { route: 'reviews',  label: 'Reviews' },
  gallery:  { route: 'gallery',  label: 'Gallery' },
  areas:    { route: 'areas',    label: 'Service Areas' },
};

export function pageMetaFor(pageType: PageTypeId): { route: string; label: string } {
  return PAGE_META[pageType];
}

/** The page types an operator can ADD as the optional extra page. */
export const OPTIONAL_PAGE_TYPES: PageTypeId[] = ['reviews', 'gallery', 'areas'];

/** The default non-home pages, shown as fixed add-slots so a legacy one-page client can build
 *  out to them and a removed default can be added back. `addPage` already accepts these. */
export const CORE_ADD_PAGE_TYPES: PageTypeId[] = ['services', 'about', 'contact'];

/** Build a fresh PageInstance for a page type, seeded from its first (default) template. */
export function pageFromType(pageType: PageTypeId): PageInstance {
  const tmpl = templatesFor(pageType)[0];
  const meta = PAGE_META[pageType];
  return {
    route: meta.route,
    pageType,
    label: meta.label,
    templateId: tmpl.id,
    navVisible: true,
    sections: tmpl.sections.map((s) => ({ ...s, id: newSectionId() })),
  };
}

/** Apply a template to an existing page — replaces its sections + records provenance. Mints a
 *  fresh id per section, so re-applying a template is a structural reset (per-section styles on the
 *  replaced sections are intentionally dropped). */
export function applyTemplate(page: PageInstance, tmpl: PageTemplate): PageInstance {
  return { ...page, templateId: tmpl.id, sections: tmpl.sections.map((s) => ({ ...s, id: newSectionId() })) };
}

/** The default 4-page site (Home, Services, About, Contact) + standard chrome. */
export function defaultCompositionFor(): SiteComposition {
  return {
    chrome: {
      nav: { categoryId: 'nav', name: 'NavMinimal' },
      footer: { categoryId: 'footer', name: 'FooterColumns' },
      seo: { categoryId: 'seo', name: 'SeoLocalBusiness' },
    },
    pages: (['home', 'services', 'about', 'contact'] as PageTypeId[]).map(pageFromType),
  };
}
