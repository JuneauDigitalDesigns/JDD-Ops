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
export function buildReviewGroups(pages: ReviewPage[]): ReviewGroup[] {
  const home: ReviewGroup = { route: '', label: 'Home', sections: HOME_SECTIONS };
  const nonHome = pages
    .filter((p) => p.route !== '')
    .slice()
    .sort((a, b) => {
      const oa = PAGE_TYPE_ORDER[a.pageType] ?? 8;
      const ob = PAGE_TYPE_ORDER[b.pageType] ?? 8;
      return oa !== ob ? oa - ob : a.route.localeCompare(b.route);
    })
    .map<ReviewGroup>((p) => ({
      route: p.route,
      label: p.label,
      // The Services page additionally reviews services.items[].detail (the prose that actually
      // appears on /services); every other non-home page is header + SEO only.
      sections: p.pageType === 'services' ? ['subpages', 'services'] : ['subpages'],
    }));
  return [home, ...nonHome];
}

/** Every verdict key the review surface addresses, in render order — home sections bare, every
 *  non-home section prefixed with its route (decision 50). */
export function reviewKeys(groups: ReviewGroup[]): VerdictKey[] {
  return groups.flatMap((g) => g.sections.map((s) => verdictKey(s, g.route || undefined)));
}
