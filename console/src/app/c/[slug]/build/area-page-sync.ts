/**
 * The gate's side of town pages (`/areas/<town>`) and spokes (`/areas/<town>/<service>`), the
 * twin of service-page-sync.ts. Xander's local SEO decisions, 2026-11-12
 * (local-seo-architecture-decisions.md in the shared notes): L2 the URLs, L4 never the main city,
 * L6 a town earns its page with real local facts, L14 caps per page type.
 *
 * Which towns and spokes qualify is decided ONLY by @jdd/schema (pickAreaPages,
 * qualifiesForSpokePage), the same functions the agency wizard and the copywriter use. This file
 * turns that answer into routes, and the composition's pages back into `content.areaPages`, which
 * the export writes so a site links only to town pages that exist. Pure, and free of the catalog,
 * so it is unit-testable.
 */
import {
  PAGE_CAPS,
  canonicalTown,
  pickAreaPages,
  qualifiesForSpokePage,
  serviceSlugs,
  townSlugs,
  type AreaPageRef,
} from '@jdd/schema';
import type { SiteComposition } from '@/lib/pages';

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

export const AREAS_ROUTE = 'areas';
export const areaRoute = (townSlug: string): string => `${AREAS_ROUTE}/${townSlug}`;
export const spokeRoute = (townSlug: string, serviceSlug: string): string => `${AREAS_ROUTE}/${townSlug}/${serviceSlug}`;

export interface ChosenArea {
  town: string; // as extensions.serviceArea spells it
  slug: string; // townSlug
}

/** One spoke Xander approved (Phase 3: a Search Console proposal he said yes to). */
export interface ApprovedSpoke {
  town: string;    // as the client spells it (any case)
  service: string; // the service's slug
}

export interface ChosenSpoke {
  town: string;
  townSlug: string;
  service: string; // service slug
  label: string;   // the service's own name
}

function serviceArea(content: unknown): string[] {
  return arr(obj(obj(content).extensions).serviceArea).map(str).filter(Boolean);
}

/** The towns that earn a page (L6), within the town-page cap (L14), in service-area order. */
export function chosenAreaPages(content: unknown): ChosenArea[] {
  const area = serviceArea(content);
  const slugs = townSlugs(content);
  return pickAreaPages(content, PAGE_CAPS.area).map((town) => ({ town, slug: slugs[area.indexOf(town)] }));
}

/**
 * The approved spokes that still qualify, within the spoke cap. A spoke needs its town's page, its
 * service's page and two facts tagged to both (qualifiesForSpokePage); an approval alone is never
 * enough, and a spoke whose facts went away drops out (the export then redirects its URL).
 */
export function chosenSpokePages(content: unknown, approved: ApprovedSpoke[]): ChosenSpoke[] {
  const areas = chosenAreaPages(content);
  const svc = serviceSlugs(content);
  const items = arr(obj(obj(content).services).items).map(obj);
  const out: ChosenSpoke[] = [];
  const seen = new Set<string>();
  for (const a of approved) {
    const town = canonicalTown(content, a.town);
    const area = areas.find((x) => x.town === town);
    const idx = svc.indexOf(str(a.service));
    if (!area || idx < 0) continue;
    const key = spokeRoute(area.slug, svc[idx]);
    if (seen.has(key) || !qualifiesForSpokePage(content, town, idx, true)) continue;
    seen.add(key);
    out.push({ town, townSlug: area.slug, service: svc[idx], label: str(items[idx]?.t) || svc[idx] });
    if (out.length >= PAGE_CAPS.spoke) break;
  }
  return out;
}

/**
 * `content.areaPages`: the composition's town pages with the spokes under each, in page order.
 * Routing, not client data, written by the export beside `servicePages`. A town page whose slug
 * names no town the client covers is left out rather than guessed.
 */
export function areaPageRefs(comp: Pick<SiteComposition, 'pages'>, content: unknown): AreaPageRef[] {
  const area = serviceArea(content);
  const slugs = townSlugs(content);
  const spokes = comp.pages.filter((p) => p.pageType === 'spoke').map((p) => p.route.split('/'));
  return comp.pages
    .filter((p) => p.pageType === 'area')
    .map((p) => p.route.slice(AREAS_ROUTE.length + 1))
    .filter((slug) => slugs.includes(slug))
    .map((slug) => ({
      town: area[slugs.indexOf(slug)],
      slug,
      spokes: spokes.filter((parts) => parts.length === 3 && parts[1] === slug).map((parts) => parts[2]),
    }));
}
