/**
 * The page-grouped shape of the copy review (Phase 10b, decision 49). ONE definition of "which
 * sections hang under which page, and in what order" so the renderer (CopyWireframe) and the gate
 * (IntakeStep) can never disagree about what "every reviewable key" means — the same reason
 * copy-schema.ts owns verdictKey in one place.
 *
 * Pure data + functions, no React and no '@/' alias (imports copy-schema relatively), so the test
 * suite can load it directly under node --test/tsx the way it already loads copy-schema.ts.
 */
import { type Section, type VerdictKey, verdictKey } from './copy-schema';

/** One reviewable page in the copy review. `route` is '' for home; order within a group is page
 *  order, order OF the groups is decision 49. */
export type ReviewGroup = { route: string; label: string; sections: Section[] };

/** The minimal page shape the review needs, derived from the live SiteComposition. */
export type ReviewPage = { route: string; label: string; pageType: string };

/** Home carries all the generatable site content; everything else carries its page header + SEO
 *  (the `subpages` review), plus (the Services page only) the per-service body copy that
 *  services.items[].detail holds. */
export const HOME_SECTIONS: Section[] = [
  'brand', 'announcement', 'hero', 'trust', 'about', 'services', 'work',
  'testimonials', 'faq', 'finalCta', 'footer', 'seo',
];

/** Decision 49's fixed group order: home first (handled separately), then Services, About, Contact,
 *  then the optional-5th pages, then one group per generated service page (alphabetical by route,
 *  which this map lands last). An unknown pageType sorts just before the service pages. */
const PAGE_TYPE_ORDER: Record<string, number> = {
  services: 0, about: 1, contact: 2, reviews: 3, gallery: 4, areas: 5, service: 9,
};

/**
 * Build the ordered review groups from the live composition's non-home pages. A client with four
 * services gets four service groups; a client with nine gets nine — nothing is hardcoded.
 */
/** /areas/<town> and /areas/<town>/<service> (L2). Matched by route, which Xander fixed, so the
 *  review never depends on what the composition calls these page types. `areas` alone is the
 *  Service Areas page, reviewed like any other page. */
const TOWN_ROUTE = /^areas\/[^/]+$/;
const TOWN_SERVICE_ROUTE = /^areas\/[^/]+\/[^/]+$/;
/** After the service pages; a town's own service pages follow it, since their routes sort after. */
const TOWN_ORDER = 10;

function orderOf(p: ReviewPage): number {
  if (TOWN_ROUTE.test(p.route) || TOWN_SERVICE_ROUTE.test(p.route)) return TOWN_ORDER;
  return PAGE_TYPE_ORDER[p.pageType] ?? 8;
}

function sectionsOf(p: ReviewPage): Section[] {
  // A town page's H1, title and headings are approved fixed wording, so its only generated copy
  // is the townPages section's (lib/townPages.ts); the same for a town + service page.
  if (TOWN_ROUTE.test(p.route)) return ['townPages'];
  if (TOWN_SERVICE_ROUTE.test(p.route)) return ['townServicePages'];
  // The Services page additionally reviews services.items[].detail (the prose that actually
  // appears on /services); every other non-home page is header + SEO only.
  return p.pageType === 'services' ? ['subpages', 'services'] : p.pageType === 'service' ? ['subpages', 'servicePages'] : ['subpages'];
}

export function buildReviewGroups(pages: ReviewPage[]): ReviewGroup[] {
  const home: ReviewGroup = { route: '', label: 'Home', sections: HOME_SECTIONS };
  const nonHome = pages
    .filter((p) => p.route !== '')
    .slice()
    .sort((a, b) => {
      const oa = orderOf(a);
      const ob = orderOf(b);
      return oa !== ob ? oa - ob : a.route.localeCompare(b.route);
    })
    .map<ReviewGroup>((p) => ({ route: p.route, label: p.label, sections: sectionsOf(p) }));
  return [home, ...nonHome];
}

type Copy = Record<string, { intro?: unknown; spokes?: Record<string, { intro?: unknown }> }>;
type Overlay = { areaCopy?: unknown; subpages?: Record<string, unknown> } | null | undefined;

const isTownRoute = (route: string) => TOWN_ROUTE.test(route) || TOWN_SERVICE_ROUTE.test(route);
const descriptionOf = (o: Overlay, route: string) =>
  ((o?.subpages?.[route] as { seo?: { description?: unknown } } | undefined)?.seo?.description);

/**
 * The town review keys a run's new overlay puts copy behind: `areas/<town>:townPages` for each town
 * page whose intro or meta description changed, and `areas/<town>/<service>:townServicePages` for
 * each town + service page whose intro or description changed. Like rewrittenPageKeys: nothing
 * else ticks a per-page key, so without this a run's town copy would reach the site unread.
 */
export function rewrittenTownKeys(before: Overlay, after: Overlay): VerdictKey[] {
  const prev = (before?.areaCopy ?? {}) as Copy;
  const next = (after?.areaCopy ?? {}) as Copy;
  const changed = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b);
  const keys: VerdictKey[] = [];
  for (const [town, page] of Object.entries(next)) {
    const route = `areas/${town}`;
    if (changed([page.intro, descriptionOf(after, route)], [prev[town]?.intro, descriptionOf(before, route)])) {
      keys.push(verdictKey('townPages', route));
    }
    for (const [service, spoke] of Object.entries(page.spokes ?? {})) {
      const r = `areas/${town}/${service}`;
      if (changed([spoke?.intro, descriptionOf(after, r)], [prev[town]?.spokes?.[service]?.intro, descriptionOf(before, r)])) {
        keys.push(verdictKey('townServicePages', r));
      }
    }
  }
  return keys;
}

/** Whether a town key has generated copy behind it in this overlay (its intro, as the copy lives
 *  in areaCopy, not at the overlay's top-level section key). Undefined for every other key. */
export function townCopyBehind(key: VerdictKey, generated: Overlay): boolean | undefined {
  const i = key.indexOf(':');
  const route = i < 0 ? '' : key.slice(0, i);
  const section = key.slice(i + 1);
  if (section !== 'townPages' && section !== 'townServicePages') return undefined;
  const [, town, service] = route.split('/');
  const page = ((generated?.areaCopy ?? {}) as Copy)[town ?? ''];
  if (!page) return false;
  return section === 'townPages' ? typeof page.intro === 'string' && page.intro !== '' : Boolean(service && page.spokes?.[service]?.intro);
}


/** Every verdict key the review surface addresses, in render order — home sections bare, every
 *  non-home section prefixed with its route (decision 50). */
export function reviewKeys(groups: ReviewGroup[]): VerdictKey[] {
  return groups.flatMap((g) => g.sections.map((s) => verdictKey(s, g.route || undefined)));
}

/**
 * The per-page review keys a run's new overlay puts copy behind: `{route}:subpages` for every page
 * whose header or SEO differs from the overlay before the run. The gate counts a key as unreviewed
 * only while it is ticked, and nothing ticks a per-page key, so until this the page headers a run
 * wrote would have reached the site with no one reading them. Unchanged pages are left as they are.
 */
export function rewrittenPageKeys(
  before: { subpages?: Record<string, unknown> } | null | undefined,
  after: { subpages?: Record<string, unknown> } | null | undefined,
): VerdictKey[] {
  const prev = before?.subpages ?? {};
  const next = after?.subpages ?? {};
  return Object.keys(next)
    // A town page's description is reviewed with its intro (rewrittenTownKeys), not as a header.
    .filter((route) => route && !isTownRoute(route) && JSON.stringify(next[route]) !== JSON.stringify(prev[route]))
    .map((route) => verdictKey('subpages', route));
}
