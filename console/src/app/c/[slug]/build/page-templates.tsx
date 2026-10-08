/**
 * The page-template registry: for each kind of page, one or more ready-made compositions of the
 * existing section catalog. A "page template" is just an ordered list of SectionRef (into the
 * catalog); the Studio's page picker applies one to a page. Non-home templates open with a
 * `pageHeader`; home stays header-less (it uses the hero).
 *
 * Phase 9 (decision 24): every section carries an explicit `rhythm`, decided here at the page
 * level, never inside a component. Each template keeps at least three distinct rhythms with no
 * three consecutive repeats (decision 30d), at most one inverted section (decision 12), and at
 * most two signature components (decision 26) — all enforced by console/test/page-rhythm.test.mjs.
 */
import type { PageInstance, PageTemplate, PageTypeId, SectionRhythm, SiteComposition } from '@/lib/pages';
import { newSectionId } from '@/lib/pages';
import type { SkinId } from '@/lib/skins';

const S = (categoryId: string, name: string, rhythm?: SectionRhythm, skin?: SkinId) => ({
  categoryId,
  name,
  ...(rhythm ? { rhythm } : {}),
  ...(skin ? { skin } : {}),
});

export const PAGE_TEMPLATES: PageTemplate[] = [
  // ── Home (header-less; researched order hero > differentiators > services > areas > proof > work > faq > contact) ──
  {
    id: 'home-standard', pageType: 'home', label: 'Home — Standard',
    sections: [
      S('hero', 'HeroSplit', 'bleed'),
      S('differentiators', 'DifferentiatorsIndex', 'normal'),
      S('services', 'ServicesGrid', 'loose'),
      S('trust', 'ServiceArea', 'tight'),
      S('testimonials', 'TestimonialsGrid', 'normal'),
      S('work', 'RecentJobsGrid', 'bleed'),
      S('faq', 'FaqAccordion', 'loose'),
      S('finalCta', 'FinalCtaBanner', 'tight', 'inverted'),
    ],
  },
  {
    id: 'home-bold', pageType: 'home', label: 'Home — Bold',
    sections: [
      S('hero', 'HeroOverlap', 'bleed'),
      S('stats', 'StatsBand', 'tight', 'inverted'),
      S('differentiators', 'DifferentiatorsPanels', 'loose'),
      S('services', 'ServicesShowcase', 'normal'),
      S('trust', 'TrustReviewsAggregate', 'tight'),
      S('work', 'WorkSpotlight', 'bleed'),
      S('testimonials', 'TestimonialsMarquee', 'normal'),
      S('finalCta', 'FinalCtaSplit', 'loose'),
    ],
  },
  {
    id: 'home-quiet', pageType: 'home', label: 'Home — Quiet',
    sections: [
      S('hero', 'HeroFormFocus', 'normal'),
      S('trust', 'TrustBadges', 'tight'),
      S('differentiators', 'DifferentiatorsRail', 'text'),
      S('services', 'ServicesSpotlight', 'loose'),
      S('testimonials', 'TestimonialsCarousel', 'normal'),
      S('faq', 'FaqIndex', 'text'),
      S('contact', 'ContactSplit', 'loose', 'inverted'),
    ],
  },

  // ── Services (listing page) — three templates; 2nd/3rd swap the page-header archetype (decision 19) ──
  {
    id: 'services-standard', pageType: 'services', label: 'Services — Standard',
    sections: [
      S('pageHeader', 'PageHeaderSimple', 'bleed'),
      S('services', 'ServicesGrid', 'normal'),
      S('faq', 'FaqAccordion', 'loose'),
      S('finalCta', 'FinalCtaBanner', 'tight'),
    ],
  },
  {
    id: 'services-panel', pageType: 'services', label: 'Services — Panel',
    sections: [
      S('pageHeader', 'PageHeaderOverlap', 'bleed'),
      S('services', 'ServicesPanel', 'normal'),
      S('trust', 'TrustBadges', 'loose'),
      S('faq', 'FaqStickyAside', 'tight'),
      S('finalCta', 'FinalCtaSplit', 'normal'),
    ],
  },
  {
    id: 'services-showcase', pageType: 'services', label: 'Services — Showcase',
    sections: [
      S('pageHeader', 'PageHeaderEditorial', 'bleed'),
      S('services', 'ServicesShowcase', 'normal'),
      S('differentiators', 'DifferentiatorsIndex', 'loose'),
      S('faq', 'FaqIndex', 'tight'),
      S('finalCta', 'FinalCtaSimple', 'normal'),
    ],
  },

  // ── About — three templates ──
  {
    id: 'about-standard', pageType: 'about', label: 'About — Standard',
    sections: [
      S('pageHeader', 'PageHeaderSimple', 'bleed'),
      S('about', 'AboutStory', 'normal'),
      S('trust', 'ServiceArea', 'loose'),
      S('testimonials', 'TestimonialsGrid', 'tight'),
      S('finalCta', 'FinalCtaSplit', 'normal'),
    ],
  },
  {
    id: 'about-proof', pageType: 'about', label: 'About — Proof',
    sections: [
      S('pageHeader', 'PageHeaderEditorial', 'bleed'),
      S('about', 'AboutStory', 'normal'),
      S('testimonials', 'TestimonialsCarousel', 'loose'),
      S('trust', 'TrustBadges', 'tight'),
      S('finalCta', 'FinalCtaBanner', 'normal'),
    ],
  },
  {
    id: 'about-sticky', pageType: 'about', label: 'About — Sticky',
    sections: [
      S('pageHeader', 'PageHeaderMinimal', 'bleed'),
      S('about', 'AboutSticky', 'normal'),
      S('stats', 'StatsBand', 'loose'),
      S('testimonials', 'TestimonialsMarquee', 'tight'),
      S('finalCta', 'FinalCtaBanner', 'normal'),
    ],
  },

  // ── Contact — three templates ──
  {
    id: 'contact-standard', pageType: 'contact', label: 'Contact — Standard',
    sections: [
      S('pageHeader', 'PageHeaderSimple', 'bleed'),
      S('contact', 'ContactSplit', 'normal'),
      S('faq', 'FaqStickyAside', 'loose'),
      S('finalCta', 'FinalCtaBanner', 'tight'),
    ],
  },
  {
    id: 'contact-overlap', pageType: 'contact', label: 'Contact — Coverage',
    sections: [
      S('pageHeader', 'PageHeaderMinimal', 'bleed'),
      S('contact', 'ContactCardOverlap', 'normal'),
      S('trust', 'ServiceArea', 'loose'),
      S('finalCta', 'FinalCtaSimple', 'tight'),
    ],
  },
  {
    id: 'contact-direct', pageType: 'contact', label: 'Contact — Direct',
    sections: [
      S('pageHeader', 'PageHeaderOverlap', 'bleed'),
      S('contact', 'ContactInlineStrip', 'normal'),
      S('faq', 'FaqIndex', 'loose'),
      S('finalCta', 'FinalCtaSplit', 'tight'),
    ],
  },

  // ── Optional 5th-page candidates — one template each ──
  {
    id: 'reviews-standard', pageType: 'reviews', label: 'Reviews — Standard',
    sections: [
      S('pageHeader', 'PageHeaderSimple', 'bleed'),
      S('testimonials', 'TestimonialsGrid', 'normal'),
      S('trust', 'TrustReviewsAggregate', 'loose'),
      S('finalCta', 'FinalCtaBanner', 'tight'),
    ],
  },
  {
    id: 'gallery-standard', pageType: 'gallery', label: 'Gallery — Standard',
    sections: [
      S('pageHeader', 'PageHeaderSimple', 'bleed'),
      S('work', 'BeforeAfter', 'normal'),
      S('finalCta', 'FinalCtaBanner', 'loose'),
    ],
  },
  {
    id: 'areas-standard', pageType: 'areas', label: 'Service Areas — Standard',
    sections: [
      S('pageHeader', 'PageHeaderSimple', 'bleed'),
      S('trust', 'ServiceArea', 'normal'),
      S('finalCta', 'FinalCtaBanner', 'loose'),
    ],
  },

  // ── Per-service pages (decision 20); generated, not operator-added. ──
  {
    id: 'service-standard', pageType: 'service', label: 'Service — Standard',
    sections: [
      S('pageHeader', 'PageHeaderOverlap', 'bleed'),
      S('services', 'ServicesAccordion', 'normal'),
      S('work', 'BeforeAfter', 'loose'),
      S('faq', 'FaqStickyAside', 'normal'),
      S('finalCta', 'FinalCtaBanner', 'tight'),
    ],
  },
  {
    id: 'service-proof', pageType: 'service', label: 'Service — Proof',
    sections: [
      S('pageHeader', 'PageHeaderEditorial', 'normal'),
      S('differentiators', 'DifferentiatorsIndex', 'loose'),
      S('testimonials', 'TestimonialsGrid', 'normal'),
      S('trust', 'ServiceArea', 'tight'),
      S('contact', 'ContactInlineStrip', 'tight'),
    ],
  },
];

/** Templates available for a given page type (one or more). */
export function templatesFor(pageType: PageTypeId): PageTemplate[] {
  return PAGE_TEMPLATES.filter((t) => t.pageType === pageType);
}

/** Route + default nav label per page type. `service` has no fixed route or label: those are
 *  per-instance, derived from the service item (see servicePageFrom). */
const PAGE_META: Record<PageTypeId, { route: string; label: string }> = {
  home:     { route: '',         label: 'Home' },
  services: { route: 'services', label: 'Services' },
  about:    { route: 'about',    label: 'About' },
  contact:  { route: 'contact',  label: 'Contact' },
  reviews:  { route: 'reviews',  label: 'Reviews' },
  gallery:  { route: 'gallery',  label: 'Gallery' },
  areas:    { route: 'areas',    label: 'Service Areas' },
  service:  { route: '',         label: 'Service' },
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
  if (pageType === 'service') {
    // Service pages are per-instance (route + header come from the service item); there is no
    // single default route to seed from here.
    throw new Error("Use servicePageFrom(item, route) for 'service' pages, not pageFromType.");
  }
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

/** Build a per-service PageInstance (decision 20). `route` is `services/<slug>` (from
 *  servicePageRoutes); the nav label is the service's own title; navVisible is false (linked from
 *  the services section, not the top nav). Header copy is filled at export from the service item. */
export function servicePageFrom(item: { t: string }, route: string): PageInstance {
  const tmpl = templatesFor('service')[0];
  return {
    route,
    pageType: 'service',
    label: item.t,
    templateId: tmpl.id,
    navVisible: false,
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
