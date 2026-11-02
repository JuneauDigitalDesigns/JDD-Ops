// The single source of truth for which page sections a nav link can point at, and the
// anchor each one resolves to. Catalog section components render a DOM `id` on their root;
// a nav `href` of `#<id>` is what makes "click nav → scroll to section" work.
//
// Only these categories render an id today (hero/trust/footer/nav do not), so only these
// are offered as link targets. finalCta is deliberately `#cta`, NOT `#finalCta` — live
// client repos already ship that anchor, and changing it would break their existing nav.
//
// Keep this in lockstep with the DOM `id=` attributes in components/catalog/**. If a
// section's id changes there, change it here.

import { navHref, type SiteComposition } from '@/lib/pages';
import { slugify } from '@/lib/slugify';
import type { SiteContent } from '@/data/site';

export type NavTarget = { categoryId: string; anchor: string; label: string };

const TARGETS: readonly NavTarget[] = [
  { categoryId: 'about', anchor: '#about', label: 'About' },
  { categoryId: 'services', anchor: '#services', label: 'Services' },
  { categoryId: 'work', anchor: '#work', label: 'Work' },
  { categoryId: 'testimonials', anchor: '#testimonials', label: 'Reviews' },
  { categoryId: 'faq', anchor: '#faq', label: 'FAQ' },
  { categoryId: 'contact', anchor: '#contact', label: 'Contact' },
  { categoryId: 'finalCta', anchor: '#cta', label: 'Book' },
] as const;

const BY_CATEGORY = new Map(TARGETS.map((t) => [t.categoryId, t]));
const BY_ANCHOR = new Map(TARGETS.map((t) => [t.anchor, t]));

/** The link targets that are actually on the page right now, in page order. */
export function linkableTargets(order: string[]): NavTarget[] {
  return order.map((id) => BY_CATEGORY.get(id)).filter((t): t is NavTarget => t !== undefined);
}

/**
 * True when `href` points at a KNOWN section anchor that is NOT currently on the page —
 * i.e. a link that will scroll to nothing. Non-section hrefs (external URLs, `#`, `#top`)
 * return false: they aren't ours to police and flagging them would be noise.
 */
export function isDanglingLink(href: string, order: string[]): boolean {
  const target = BY_ANCHOR.get(href.trim());
  if (!target) return false;
  return !order.includes(target.categoryId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Composition-aware chrome-link resolution (multi-page).
//
// A single-page site's chrome links are `#anchor`s that scroll within the one page. On a
// MULTI-PAGE site those sections live on different routes, so the same `#anchor` scrolls to
// nothing from every other page. This rewrites a chrome href (today: footer.cols links) to the
// route that actually carries its section, exactly as the exporter already regenerates the nav
// from the composition. A link whose section exists on NO page is dangling and the exporter
// refuses it (see remapFooterCols) rather than shipping a dead link no one can see is dead.
// ─────────────────────────────────────────────────────────────────────────────

/** The category a known section anchor points at (`#services` → `services`), or null for a href
 *  that isn't one of ours to touch — external URLs, `#`, `#top`. */
export function anchorCategory(href: string): string | null {
  return BY_ANCHOR.get(href.trim())?.categoryId ?? null;
}

/** The page type that semantically OWNS a category — its dedicated route. A category not listed
 *  here (e.g. `faq`) has no page of its own and falls back to wherever it first appears. */
const CATEGORY_OWNER: Record<string, string> = {
  services: 'services',
  about: 'about',
  contact: 'contact',
  finalCta: 'contact',
  testimonials: 'reviews',
  work: 'gallery',
};

/** The best route to reach a category: its owner page if the composition has one, else the first
 *  page (home first) that carries the category, else null when it is nowhere on the site. */
export function bestRouteForCategory(categoryId: string, comp: SiteComposition): string | null {
  const owner = CATEGORY_OWNER[categoryId];
  if (owner) {
    const ownerPage = comp.pages.find((p) => p.pageType === owner);
    if (ownerPage) return ownerPage.route;
  }
  const anyPage = comp.pages.find((p) => p.sections.some((s) => s.categoryId === categoryId));
  return anyPage ? anyPage.route : null;
}

/** The per-service route (decision 20) matching a footer link's label, or null. The match is by
 *  slug equality against the generated `services/<slug>` route, so a label that doesn't name an
 *  actual service page falls through to the plain `/services` resolution rather than guessing. */
export function servicePageRouteForLabel(label: string, comp: SiteComposition): string | null {
  const route = `services/${slugify(label)}`;
  const page = comp.pages.find((p) => p.pageType === 'service' && p.route === route);
  return page ? page.route : null;
}

/** Rewrite one chrome href against the composition. Returns the href unchanged when it is not a
 *  known section anchor (external, `#`, `#top`) or when its section is nowhere (dangling —
 *  remapFooterCols reports those and the exporter refuses). */
export function resolveChromeHref(href: string, label: string, comp: SiteComposition): string {
  const anchor = href.trim();
  const categoryId = anchorCategory(anchor);
  if (!categoryId) return href;

  // A footer "services" link that names an actual per-service page deep-links to it (decision 20);
  // anything else falls through to the services-page / anchor resolution below.
  if (categoryId === 'services') {
    const svc = servicePageRouteForLabel(label, comp);
    if (svc) return navHref(svc);
  }

  const route = bestRouteForCategory(categoryId, comp);
  if (route === null) return href; // dangling — left as-is for the caller to flag
  const multiPage = comp.pages.length > 1;
  if (route === '') return multiPage ? `/${anchor}` : anchor; // on home: `/#faq`, or keep `#faq`
  return `${navHref(route)}${anchor}`; // on a subpage: `/services#services`, `/contact#cta`
}

type FooterContent = SiteContent['footer'];

/** Remap every footer column link against the composition, collecting the ones whose target
 *  section is on no page (dangling). The exporter rewrites footer.cols with the result and
 *  refuses the whole export when `dangling` is non-empty. */
export function remapFooterCols(
  footer: FooterContent,
  comp: SiteComposition,
): { cols: FooterContent['cols']; dangling: { label: string; href: string; col: string }[] } {
  const dangling: { label: string; href: string; col: string }[] = [];
  const cols = footer.cols.map((col) => ({
    ...col,
    links: col.links.map((link) => {
      const anchor = link.href.trim();
      const categoryId = anchorCategory(anchor);
      if (!categoryId) return link; // not ours — external, `#`, `#top`
      if (categoryId === 'services' && servicePageRouteForLabel(link.label, comp)) {
        return { ...link, href: resolveChromeHref(anchor, link.label, comp) };
      }
      if (bestRouteForCategory(categoryId, comp) === null) {
        dangling.push({ label: link.label, href: anchor, col: col.h });
        return link; // leave it; the export refuses rather than shipping a dead link
      }
      return { ...link, href: resolveChromeHref(anchor, link.label, comp) };
    }),
  }));
  return { cols, dangling };
}
