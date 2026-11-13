/**
 * Town pages (/areas/<town>), town + service pages (/areas/<town>/<service>) and the /areas index,
 * as the catalog components see them. Xander approved the mockups "HVAC Town Pages" on
 * 2026-11-12 ("Build as shown", wording T1 to T5 word for word) under his local SEO decisions
 * (local-seo-architecture-decisions.md in the shared notes).
 *
 * KEEP IN STEP: this file is byte-identical in console/src/lib and template/src/lib, because the
 * catalog components import it in the Studio preview AND in every client repo
 * (console/test/town-pages.test.mjs). Client repos have no @jdd/schema dependency, so it reads
 * content structurally. `canonicalTown` and the fact filters repeat @jdd/schema's gate
 * (area-pages.ts) on purpose; the test runs both over the same content and fails if they disagree.
 *
 * Which pages exist is decided by the composition, not here: the export writes `content.areaPages`
 * (each town page and the spokes under it), and the Studio injects the same list into its preview.
 * A town or spoke not in that list renders nothing and is linked from nowhere.
 *
 * What a page may say (L6, L7, L9): only facts tagged to the town, which are its job photos (the
 * client's own caption and the town), its reviews and the operator's sourced notes, plus the
 * services with pages and ONE generated intro (`content.areaCopy`). The 40% share in the console's
 * scorePage.ts counts exactly these, so nothing else is drawn in a page body.
 */
import { primaryCity, serviceBySlug, servicePhoto, serviceRefs, type ServiceRef } from '@/lib/serviceLinks';

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

const HTTP_URL = /^https?:\/\/[^\s/]+\.[^\s]+$/i;

/** Approved word for word by Xander, 2026-11-12. */
export const AREA_WORDS = {
  home: 'Home',
  areas: 'Areas',
  in: 'in',
  areasWeServe: 'Areas we serve',
  source: 'Source',
  priceFactors: 'What affects the price',
  ourServicesIn: (town: string) => `Our services in ${town}`,
  recentJobsIn: (town: string) => `Recent jobs in ${town}`,
  customersSay: (town: string) => `What our ${town} customers say`,
  workingIn: (town: string) => `Working in ${town}`,
  moreWorkIn: (town: string) => `More of our work in ${town}`,
  inTown: (what: string, town: string) => `${what} in ${town}`,
  nearbyTowns: (service: string) => `${service} in nearby towns`,
} as const;

/**
 * "About our {service} service", the across link on a town + service page. The service name is
 * lowercased, except a word in capitals (AC, HVAC), and when the name already ends in "service" the
 * second one is dropped ("About our AC installation & service"; Xander, 2026-11-12).
 */
export function aboutOurService(serviceName: string): string {
  const name = str(serviceName)
    .split(/\s+/)
    .map((w) => (/[A-Z]{2,}/.test(w) && w === w.toUpperCase() ? w : w.toLowerCase()))
    .join(' ');
  return /\bservices?$/i.test(name) ? `About our ${name}` : `About our ${name} service`;
}

/** The towns the client covers, as the service area spells them. */
function serviceArea(content: unknown): string[] {
  return arr(obj(obj(content).extensions).serviceArea).map(str).filter(Boolean);
}

/** The client's own spelling of a town, or '' when the client doesn't cover it. Same as @jdd/schema. */
export function canonicalTown(content: unknown, town: unknown): string {
  const want = str(town).toLowerCase();
  if (!want) return '';
  return serviceArea(content).find((t) => t.toLowerCase() === want) ?? '';
}

/** One town page the site has: `content.areaPages`, written by the export. */
export type AreaRef = { town: string; slug: string; spokes: string[] };

/** Every town page the site has, in page order. */
export function areaRefs(content: unknown): AreaRef[] {
  return arr(obj(content).areaPages)
    .map(obj)
    .map((r) => ({ town: canonicalTown(content, r.town), slug: str(r.slug), spokes: arr(r.spokes).map(str).filter(Boolean) }))
    .filter((r) => r.town !== '' && r.slug !== '');
}

export const areaHref = (townSlug: string) => `/areas/${townSlug}`;
export const spokeHref = (townSlug: string, serviceSlug: string) => `/areas/${townSlug}/${serviceSlug}`;

/**
 * The page a town header or body is on: a town page, a town + service page, or null when the site
 * has no such page (the section renders nothing).
 */
export function townPageFor(
  content: unknown,
  townSlug: string | undefined,
  serviceSlug?: string,
): { area: AreaRef; service: ServiceRef | null } | null {
  if (!townSlug) return null;
  const area = areaRefs(content).find((r) => r.slug === townSlug);
  if (!area) return null;
  if (!serviceSlug) return { area, service: null };
  const service = area.spokes.includes(serviceSlug) ? serviceBySlug(content, serviceSlug) : null;
  return service ? { area, service } : null;
}

/** The generated intro under the H1, with its edit path, or null. */
export function townIntro(content: unknown, townSlug: string, serviceSlug?: string): { text: string; path: string } | null {
  const copy = obj(obj(obj(content).areaCopy)[townSlug]);
  const path = serviceSlug ? `areaCopy.${townSlug}.spokes.${serviceSlug}.intro` : `areaCopy.${townSlug}.intro`;
  const text = serviceSlug ? str(obj(obj(copy.spokes)[serviceSlug]).intro) : str(copy.intro);
  return text ? { text, path } : null;
}

const tagged = (content: unknown, town: string, x: Json) => town !== '' && canonicalTown(content, x.town) === town;
const ofService = (serviceSlug: string | undefined, x: Json) => !serviceSlug || str(x.service) === serviceSlug;

export type TownJob = { url: string; alt: string; caption: string; captionPath: string; town: string };
/** The town's job photos (a spoke's: of that service too). A job counts only with a photo. */
export function townJobs(content: unknown, town: string, serviceSlug?: string): TownJob[] {
  return arr(obj(obj(content).work).projects)
    .map((raw, i) => ({ p: obj(raw), i }))
    .filter(({ p }) => tagged(content, town, p) && str(obj(p.image).url) !== '' && ofService(serviceSlug, p))
    .map(({ p, i }) => ({
      url: str(obj(p.image).url),
      alt: str(obj(p.image).alt) || str(p.caption) || town,
      caption: str(p.caption),
      captionPath: `work.projects.${i}.caption`,
      town,
    }));
}

export type TownReview = { q: string; a: string; path: string };
/** The town's reviews (a spoke's: of that service too). A review counts only with words. */
export function townReviews(content: unknown, town: string, serviceSlug?: string): TownReview[] {
  return arr(obj(obj(content).testimonials).items)
    .map((raw, i) => ({ r: obj(raw), i }))
    .filter(({ r }) => tagged(content, town, r) && str(r.q) !== '' && ofService(serviceSlug, r))
    .map(({ r, i }) => ({ q: str(r.q), a: str(r.a), path: `testimonials.items.${i}` }));
}

export type TownNote = { text: string; url: string; path: string };
/** The operator's notes on the town. A note without a real source link never shows (L9). */
export function townNotes(content: unknown, town: string): TownNote[] {
  return arr(obj(obj(content).extensions).townNotes)
    .map((raw, i) => ({ n: obj(raw), i }))
    .filter(({ n }) => tagged(content, town, n) && str(n.text) !== '' && HTTP_URL.test(str(n.sourceUrl)))
    .map(({ n, i }) => ({ text: str(n.text), url: str(n.sourceUrl), path: `extensions.townNotes.${i}.text` }));
}

export type TownService = { s: ServiceRef; href: string; image: string };
/** "Our services in {Town}": the services with pages, each to its spoke in this town when the
 *  site has one, else to its service page. */
export function townServices(content: unknown, area: AreaRef): TownService[] {
  return serviceRefs(content)
    .filter((s) => s.href !== null)
    .map((s) => ({
      s,
      href: area.spokes.includes(s.slug) ? spokeHref(area.slug, s.slug) : (s.href as string),
      image: str(obj(s.item.image).url),
    }));
}

/** The /areas index: every town served, in order. The main city links home (L4), a town with its
 *  own page links to it, and every other town is plain text. */
export function areasIndex(content: unknown): { town: string; href: string | null; home: boolean }[] {
  const main = primaryCity(content).toLowerCase();
  const pages = areaRefs(content);
  return serviceArea(content).map((town) => {
    if (main && town.toLowerCase() === main) return { town, href: '/', home: true };
    const page = pages.find((p) => p.town === town);
    return { town, href: page ? areaHref(page.slug) : null, home: false };
  });
}

/** "{Service} in nearby towns" on a service page: the town + service pages the site has for it. */
export function nearbyTownLinks(content: unknown, serviceSlug: string): { town: string; href: string }[] {
  return areaRefs(content)
    .filter((r) => r.spokes.includes(serviceSlug))
    .map((r) => ({ town: r.town, href: spokeHref(r.slug, serviceSlug) }));
}

/** "What affects the price" on a service page: the client's own answer to Q5, with edit paths. */
export function priceFactors(s: ServiceRef): { text: string; path: string }[] {
  return arr(s.item.priceFactors)
    .map((v, i) => ({ text: str(v), path: `services.items.${s.index}.priceFactors.${i}` }))
    .filter((x) => x.text !== '');
}

/** The photo behind a town page's header: its first job in the town (a spoke's, of that service),
 *  else, on a spoke, the photo its service page leads with. A town page with no job photo has none. */
export function townHeaderPhoto(content: unknown, area: AreaRef, service: ServiceRef | null): { url: string; alt: string } | null {
  const job = townJobs(content, area.town, service?.slug)[0];
  if (job) return { url: job.url, alt: job.alt };
  return service ? servicePhoto(content, service) : null;
}
