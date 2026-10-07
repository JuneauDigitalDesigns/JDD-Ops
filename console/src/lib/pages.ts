/**
 * The multi-page composition model — the vocabulary shared by the page-template registry, the
 * Studio UI, the draft format, and the exporter. A "page" is a named, ordered list of section
 * refs into the existing catalog; the whole site is chrome (nav/footer/seo chosen once) plus an
 * ordered list of pages.
 *
 * CLIENT-SAFE: this module is imported by client components (PageStudio, BuildWizard), so it must
 * NOT import from `@/lib/export` (that pulls in `node:fs`). The `CATALOG` allowlist stays the
 * server-side security boundary, enforced by the export route's `validateEntries`. Structural
 * validation (routes, chrome, page-header placement) lives here and runs on the client.
 */
import type { NavItem } from '@jdd/schema';
import type { SkinId } from '@/lib/skins';

/** One placed section inside a page — a reference into the existing section catalog.
 *  `id` is a stable, per-instance identity minted when the section is placed (applyTemplate /
 *  pageFromType / add-section). It keys SiteContent.sectionStyles for body sections so per-section
 *  styling survives reordering; chrome (nav/footer) keys off the slot name instead (see styleKeyFor). */
export type SectionRef = { id?: string; categoryId: string; name: string; skin?: SkinId };

/** The stable identity of a kind of page. Drives defaults, nav label, and route. */
export type PageTypeId =
  | 'home' | 'services' | 'about' | 'contact'   // the four defaults
  | 'reviews' | 'gallery' | 'areas';            // optional-5th candidates

/** A page template = an ordered list of BODY sections (nav/footer/seo are chrome, not here).
 *  Every non-home template MUST begin with a `pageHeader` section. */
export type PageTemplate = {
  id: string;             // globally unique, kebab: 'home-standard', 'services-standard'
  pageType: PageTypeId;
  label: string;          // operator-facing: 'Home — Standard'
  sections: SectionRef[]; // ordered; body sections only
};

/** A page as composed for one client — a template's sections plus routing + nav metadata.
 *  Subpage SEO and header COPY live in SiteContent.subpages[route]; not duplicated here. */
export type PageInstance = {
  route: string;          // '' for home; 'services' | 'about' | 'contact' | custom slug
  pageType: PageTypeId;
  label: string;          // nav label, e.g. 'Services'
  templateId: string;     // provenance; which template seeded this page
  navVisible: boolean;    // appears in site nav
  sections: SectionRef[]; // resolved from the template, then operator-editable
};

/** The whole site's composition. nav/footer/seo are chosen ONCE (site chrome); pages[0] is
 *  always the home page (route ''). Replaces the old flat Selections + SkinSelections + order. */
export type SiteComposition = {
  chrome: { nav: SectionRef; footer: SectionRef; seo: SectionRef };
  pages: PageInstance[];
};

// 1, not 3: a legacy single-page client lifts to a one-page composition and must stay valid
// (single-page sites are still shippable). The default is 4 pages; the operator can add up to MAX.
export const MIN_PAGES = 1;
export const MAX_PAGES = 7;

/** Reserved route slugs a custom page may not use (they collide with Next internals). */
const RESERVED_ROUTES = new Set(['api', '_next', 'images']);

export const isHome = (p: PageInstance): boolean => p.route === '';

/** A stable, per-instance section id. Minted when a section is placed on a page. */
export const newSectionId = (): string =>
  `s_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;

/** The SiteContent.sectionStyles key for a placed section: its stable id (body sections) or the
 *  chrome slot name (nav/footer are site-wide, one each). Returns '' for a body section that has
 *  no id yet (shouldn't happen after ensureSectionIds) so callers treat it as "unstyled". */
export function styleKeyFor(ref: SectionRef): string {
  if (ref.categoryId === 'nav' || ref.categoryId === 'footer') return ref.categoryId;
  return ref.id ?? '';
}

/** Assign ids to any body/chrome section lacking one (idempotent). Run on load so compositions
 *  lifted from legacy bundles or read back from a repo gain stable ids before they're edited. */
export function ensureSectionIds(comp: SiteComposition): SiteComposition {
  return {
    ...comp,
    pages: comp.pages.map((p) => ({
      ...p,
      sections: p.sections.map((s) => (s.id ? s : { ...s, id: newSectionId() })),
    })),
  };
}

/** Repo-relative path of a page's generated file. Home is the root page; others nest by route. */
export function routePath(route: string): string {
  return route === '' ? 'src/app/page.tsx' : `src/app/${route}/page.tsx`;
}

/** The nav href for a route. Home is '/'. */
export function navHref(route: string): string {
  return route === '' ? '/' : `/${route}`;
}

/** The site nav links (route links, home first) for every nav-visible page. This becomes
 *  SiteContent.nav at export — generated routing, not client-authored copy. */
export function navLinksFor(comp: SiteComposition): NavItem[] {
  return comp.pages.filter((p) => p.navVisible).map((p) => ({ label: p.label, href: navHref(p.route) }));
}

/** True for a syntactically valid custom route slug (lowercase URL segment, not reserved). */
export function isValidRoute(route: string): boolean {
  return /^[a-z0-9-]+$/.test(route) && !RESERVED_ROUTES.has(route);
}

/**
 * Structural validation of a composition. Throws with a clear message on violation. Does NOT
 * check the catalog allowlist — that is the export route's `validateEntries` (server-side). Use
 * this in the UI and before an export request is built.
 */
export function validateComposition(comp: SiteComposition): SiteComposition {
  const { chrome, pages } = comp;
  if (chrome.nav.categoryId !== 'nav') throw new Error('Chrome nav must be a nav section.');
  if (chrome.footer.categoryId !== 'footer') throw new Error('Chrome footer must be a footer section.');
  if (chrome.seo.categoryId !== 'seo') throw new Error('Chrome seo must be an seo section.');

  if (pages.length < MIN_PAGES || pages.length > MAX_PAGES) {
    throw new Error(`A site must have between ${MIN_PAGES} and ${MAX_PAGES} pages (has ${pages.length}).`);
  }
  if (pages[0]?.route !== '') throw new Error('The first page must be the home page (route "").');

  const seen = new Set<string>();
  for (const page of pages) {
    if (seen.has(page.route)) throw new Error(`Duplicate route "${page.route || '(home)'}".`);
    seen.add(page.route);
    if (page.route !== '' && !isValidRoute(page.route)) {
      throw new Error(`Invalid route "${page.route}".`);
    }
    const firstIsHeader = page.sections[0]?.categoryId === 'pageHeader';
    const hasHeader = page.sections.some((s) => s.categoryId === 'pageHeader');
    if (isHome(page)) {
      if (hasHeader) throw new Error('The home page must not contain a page header (it uses the hero).');
    } else {
      if (!firstIsHeader) throw new Error(`Page "${page.route}" must open with a page header.`);
    }
  }
  return comp;
}

/** The legacy single-page studio state, as persisted in old bundles and read back from a repo. */
type LegacyComposition = {
  selections: Record<string, string>;
  skins?: Record<string, SkinId>;
  order: string[];
};

const CHROME_FALLBACK = {
  nav: 'NavMinimal',
  footer: 'FooterColumns',
  seo: 'SeoLocalBusiness',
} as const;

/**
 * Flatten a composition back into the legacy single-page {selections, skins, order} shape for the
 * HOME page + chrome. INTERIM: used only to keep the existing single-page Launch/Deploy export
 * working while the multi-page export path is built (Phase E), where this is removed.
 */
export function homeLegacyView(comp: SiteComposition): { selections: Record<string, string>; skins: Record<string, SkinId>; order: string[] } {
  const home = comp.pages.find(isHome);
  const selections: Record<string, string> = {};
  const skins: Record<string, SkinId> = {};
  const put = (ref: SectionRef) => {
    selections[ref.categoryId] = ref.name;
    if (ref.skin) skins[ref.categoryId] = ref.skin;
  };
  put(comp.chrome.nav);
  put(comp.chrome.footer);
  put(comp.chrome.seo);
  // Home has no pageHeader; skip any just in case so the legacy exporter never sees one.
  const body = (home?.sections ?? []).filter((s) => s.categoryId !== 'pageHeader');
  body.forEach(put);
  const order = ['nav', ...body.map((s) => s.categoryId), 'footer'];
  return { selections, skins, order };
}

/**
 * Lift a legacy single-page studio state (Selections + SkinSelections + order, or a
 * StudioReadBack) into a one-page SiteComposition: nav/footer/seo become chrome; every other
 * body category in `order` becomes a section on the single home page. Existing single-page
 * clients open in the new UI through this, and are never mutated on disk until re-exported.
 */
export function liftLegacyToComposition(legacy: LegacyComposition): SiteComposition {
  const { selections, order } = legacy;
  const skins = legacy.skins ?? {};
  const ref = (categoryId: string, fallbackName?: string): SectionRef => ({
    categoryId,
    name: selections[categoryId] ?? fallbackName ?? '',
    skin: skins[categoryId],
  });

  const homeSections: SectionRef[] = order
    .filter((id) => id !== 'nav' && id !== 'footer')
    .map((id) => ref(id));

  return {
    chrome: {
      nav: ref('nav', CHROME_FALLBACK.nav),
      footer: ref('footer', CHROME_FALLBACK.footer),
      seo: ref('seo', CHROME_FALLBACK.seo),
    },
    pages: [
      {
        route: '',
        pageType: 'home',
        label: 'Home',
        templateId: 'home-legacy',
        navVisible: true,
        sections: homeSections,
      },
    ],
  };
}
