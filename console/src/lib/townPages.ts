/**
 * The facts each town page (/areas/<town>) and town + service page (/areas/<town>/<service>) may be
 * written from, and which of them the copywriter writes for (local SEO architecture, Xander
 * 2026-11-12; the shape is @jdd/schema v1.34.0's, settled by the Local SEO session).
 *
 * Which pages exist is never decided here. The town gate (L4, L6, L14) is @jdd/schema's
 * pickAreaPages, the one implementation the wizard, the console and the export share. A town +
 * service page exists only when the export lists it in `content.areaPages[i].spokes` (approved
 * demand, Phase 3, so the list is empty until then) and its facts still pass qualifiesForSpokePage.
 *
 * What the copywriter writes is `content.areaCopy[townSlug].intro`, its spokes' intros, and each
 * page's meta description in `subpages[route].seo.description`. Everything else on these pages
 * renders from tagged facts (jobs, reviews, sourced notes), so only those count toward the export's
 * 40% local share (L7): nothing generated ever does. The H1 and title are fixed approved patterns
 * built by pageSeo, never generated.
 *
 * Each page's facts are its own and nothing else. A town page gets that town's job photos, reviews
 * (the words only, never the reviewer's name) and operator notes with their source link (L9: a note
 * without one is not a fact and never reaches the model). A town + service page gets those narrowed
 * to the service, plus the town's notes, and the service's Q5 ("what changes the price"), Q6 ("what
 * happens on a typical visit") and how long it takes. What the service page already says (what's
 * included, the jobs it handles, the starting price) is left out on purpose: repeating it is the
 * duplicate the export's swapped-city check refuses.
 *
 * Pure, no React.
 */
import {
  PAGE_CAPS,
  canonicalTown,
  pickAreaPages,
  primaryCity,
  qualifiesForSpokePage,
  serviceSlugs,
  townSlugs,
} from '@jdd/schema';

type Json = Record<string, any>;

const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const strings = (v: unknown): string[] => arr(v).map(str).filter(Boolean);
/** The schema's own test for a note's source link (area-pages.ts HTTP_URL). */
const HTTP_URL = /^https?:\/\/[^\s/]+\.[^\s]+$/i;

export interface TownPagePick { town: string; slug: string }
export interface TownServicePagePick { town: string; townSlug: string; service: string; serviceIndex: number }

/** The town pages the copywriter writes for: exactly the ones the schema's gate gives a page. */
export function pickTownPages(content: unknown): TownPagePick[] {
  const towns = strings(obj(obj(content).extensions).serviceArea);
  const slugs = townSlugs(content);
  const picked = new Set(pickAreaPages(content, PAGE_CAPS.area));
  return towns.flatMap((town, i) => (picked.has(town) ? [{ town, slug: slugs[i] }] : []));
}

/** The town + service pages the copywriter writes for: listed by the export in
 *  `areaPages[i].spokes`, on a town that still has a page, and still passing the spoke gate. */
export function pickTownServicePages(content: unknown): TownServicePagePick[] {
  const pages = new Map(pickTownPages(content).map((p) => [p.slug, p]));
  const sSlugs = serviceSlugs(content);
  const out: TownServicePagePick[] = [];
  for (const ref of arr(obj(content).areaPages).map(obj)) {
    const page = pages.get(str(ref.slug));
    if (!page) continue;
    for (const service of strings(ref.spokes)) {
      const serviceIndex = sSlugs.indexOf(service);
      if (serviceIndex < 0 || out.some((o) => o.townSlug === page.slug && o.service === service)) continue;
      if (!qualifiesForSpokePage(content, page.town, serviceIndex, true)) continue;
      out.push({ town: page.town, townSlug: page.slug, service, serviceIndex });
    }
  }
  return out.slice(0, PAGE_CAPS.spoke);
}

// ── Facts ─────────────────────────────────────────────────────────────────────────────────────

const isTown = (content: unknown, town: string, x: Json) => canonicalTown(content, x.town) === town;

/** The town's job photos (a work project with an image), as the copywriter sees them: the
 *  client's own words about the job, no image, nothing more exact than the town. */
function jobs(c: unknown, f: Json, town: string, names: Map<string, string>, service?: string): Json[] {
  return arr(obj(f.work).projects).map(obj)
    .filter((p) => isTown(c, town, p) && str(obj(p.image).url) && (!service || str(p.service) === service))
    .map((p) => {
      const out: Json = {};
      if (str(p.t)) out.title = str(p.t);
      if (str(p.scope)) out.job = str(p.scope);
      if (names.get(str(p.service))) out.service = names.get(str(p.service));
      if (str(p.size)) out.size = str(p.size);
      if (str(p.yr)) out.year = str(p.yr);
      if (str(p.caption)) out.caption = str(p.caption);
      return out;
    });
}

/** The town's reviews: the words and the service, never the reviewer's name. */
function reviews(c: unknown, f: Json, town: string, names: Map<string, string>, service?: string): Json[] {
  return arr(obj(f.testimonials).items).map(obj)
    .filter((r) => isTown(c, town, r) && str(r.q) && (!service || str(r.service) === service))
    .map((r) => (names.get(str(r.service)) ? { quote: str(r.q), service: names.get(str(r.service)) } : { quote: str(r.q) }));
}

/** The town's operator notes that carry their source link (L9). */
function notes(c: unknown, f: Json, town: string): Json[] {
  return arr(obj(f.extensions).townNotes).map(obj)
    .filter((n) => isTown(c, town, n) && str(n.text) && HTTP_URL.test(str(n.sourceUrl)))
    .map((n) => ({ text: str(n.text), source: str(n.sourceUrl) }));
}

function namesBySlug(content: unknown, f: Json): Map<string, string> {
  const items = arr(obj(obj(content).services).items).map(obj);
  const factItems = arr(obj(f.services).items).map(obj);
  return new Map(serviceSlugs(content).map((s, i) => [s, str(factItems[i]?.t) || str(items[i]?.t)]));
}

/**
 * The facts for each town page. `content` decides which pages exist, exactly as the export does;
 * `factsFrom` is where every fact is read (the brief passes its grounded content, so a preset's
 * sample job never becomes a town's).
 */
export function townPageFacts(content: unknown, factsFrom: unknown = content): Json[] {
  const f = obj(factsFrom);
  const names = namesBySlug(content, f);
  const basedIn = primaryCity(factsFrom);
  return pickTownPages(content).map(({ town, slug }) => {
    const out: Json = { slug, town };
    if (basedIn) out.basedIn = basedIn;
    const here = arr(obj(f.services).items).map(obj)
      .filter((s) => strings(s.areas).some((a) => canonicalTown(content, a) === town)).map((s) => str(s.t)).filter(Boolean);
    if (here.length) out.servicesHere = here;
    const j = jobs(content, f, town, names);
    if (j.length) out.jobs = j;
    const r = reviews(content, f, town, names);
    if (r.length) out.reviews = r;
    const n = notes(content, f, town);
    if (n.length) out.notes = n;
    return out;
  });
}

/** The facts for each town + service page: that town's jobs and reviews for that service, the
 *  town's notes, and the service's Q5, Q6 and how long it takes. */
export function townServicePageFacts(content: unknown, factsFrom: unknown = content): Json[] {
  const f = obj(factsFrom);
  const names = namesBySlug(content, f);
  const factItems = arr(obj(f.services).items).map(obj);
  return pickTownServicePages(content).map(({ town, townSlug, service, serviceIndex }) => {
    const s = factItems[serviceIndex] ?? {};
    const out: Json = { town: townSlug, service, townName: town, serviceName: names.get(service) };
    const j = jobs(content, f, town, names, service);
    if (j.length) out.jobs = j;
    const r = reviews(content, f, town, names, service);
    if (r.length) out.reviews = r;
    const n = notes(content, f, town);
    if (n.length) out.notes = n;
    if (strings(s.priceFactors).length) out.priceFactors = strings(s.priceFactors);
    if (strings(s.typicalVisit).length) out.typicalVisit = strings(s.typicalVisit);
    if (str(s.duration)) out.howLong = str(s.duration);
    return out;
  });
}

/** The route of a town page, and of a town + service page. */
export const townRoute = (townSlug: string) => `areas/${townSlug}`;
export const townServiceRoute = (townSlug: string, service: string) => `areas/${townSlug}/${service}`;
