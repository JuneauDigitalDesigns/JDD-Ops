/**
 * Town pages (/areas/<town>) and town + service pages (/areas/<town>/<service>): which ones exist,
 * and the facts each one may be written from (local SEO architecture, Xander 2026-11-12).
 *
 *   - L4: the main city has neither. Home is its town page; the service pages are its town +
 *     service pages.
 *   - L6: a town gets a page when it is one of the client's towns, isn't the main city, and has 3+
 *     town facts of 2+ kinds: a job photo tagged to it, a review tagged to it, an operator note with
 *     its source link. At most 10 (L14); over the cap, the most facts win.
 *   - A town + service page needs an approved proposal (Phase 3) and 2+ facts tagged to both the
 *     town and the service. The service must have its own page, which it links across to. At most
 *     15 (L14).
 *   - L9: local codes, permits and conditions come only from an operator note with its source link.
 *     A note without one is not a fact here, and never reaches the copywriter.
 *
 * Each page's facts are its own and nothing else. A town page gets that town's photos, reviews and
 * notes; a town + service page gets those narrowed to the service, plus the service's Q5 ("what
 * changes the price"), Q6 ("what happens on a typical visit") and how long it takes. What the
 * service page already says (what's included, the jobs it handles, the starting price) is left out
 * on purpose: copying it is exactly the duplicate the export's swapped-city check refuses (L7).
 *
 * STAND-IN for @jdd/schema v1.34.0. The gates and the field names below belong to the schema (the
 * Local SEO session owns them), so the wizard, the console and the export share one rule, as they
 * do for service pages (lib/servicePages.ts). Until it ships, every field is read through the
 * accessors in this file and nowhere else, so matching the published names is a change here only.
 * Pure, no React.
 */
import { pickServicePages, primaryCity, serviceSlug, serviceSlugs } from '@jdd/schema';
import { MAX_PAGES } from '@/lib/pages';

export const TOWN_PAGES_MAX = 10;
export const TOWN_SERVICE_PAGES_MAX = 15;
/** L6: facts and kinds a town needs for its own page. */
export const TOWN_FACTS_MIN = 3;
export const TOWN_FACT_KINDS_MIN = 2;
/** Facts tagged to both the town and the service that a town + service page needs. */
export const TOWN_SERVICE_FACTS_MIN = 2;

type Json = Record<string, any>;

const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const strings = (v: unknown): string[] => arr(v).map(str).filter(Boolean);
const same = (a: string, b: string) => a !== '' && a.toLowerCase() === b.toLowerCase();
const isUrl = (v: string) => /^https?:\/\/\S+$/i.test(v);

// ── Field accessors: the only place a schema field name is read ───────────────────────────────

/** The client's towns (extensions.serviceArea), as the intake spells them. */
const townsOf = (c: Json) => strings(obj(c.extensions).serviceArea);
/** Q2: the towns the client gets the most work from (extensions.topTowns, up to 3). */
const topTownsOf = (c: Json) => strings(obj(c.extensions).topTowns);
/** Q1: the town of a job photo (Project.town). */
const projectTown = (p: Json) => str(p.town);
/** The town of a review (Testimonial.town), set by the operator. */
const reviewTown = (r: Json) => str(r.town);
/** Operator town notes (extensions.townNotes), each { town, text, url, service? }. */
const notesOf = (c: Json) => arr(obj(c.extensions).townNotes).map(obj);
/** Q5 and Q6, per service (ServiceItem.priceFactors, ServiceItem.typicalVisit). */
const priceFactorsOf = (s: Json) => strings(s.priceFactors);
const typicalVisitOf = (s: Json) => strings(s.typicalVisit);
/** The approved town + service pages (extensions.townServicePages), each { town, service slug }. */
const approvedOf = (c: Json) => arr(obj(c.extensions).townServicePages).map(obj);

// ── Facts ─────────────────────────────────────────────────────────────────────────────────────

export interface TownPhoto {
  /** Index in work.projects: the reply's captions come back in photo order and land by image. */
  index: number;
  image: string;
  service: string;
}

/** A job photo is a work project with an image. */
function photos(c: Json): TownPhoto[] {
  return arr(obj(c.work).projects).flatMap((p, index) => {
    const image = str(obj(obj(p).image).url);
    return image ? [{ index, image, service: str(obj(p).service) }] : [];
  });
}

const photosIn = (c: Json, town: string) =>
  photos(c).filter((p) => same(projectTown(obj(arr(obj(c.work).projects)[p.index])), town));
const reviewsIn = (c: Json, town: string) =>
  arr(obj(c.testimonials).items).map(obj).filter((r) => str(r.q) && same(reviewTown(r), town));
const sourcedNotesIn = (c: Json, town: string) =>
  notesOf(c).filter((n) => same(str(n.town), town) && str(n.text) && isUrl(str(n.url)));

/** Town slugs for every town, in order, collision-free (the same slug rule as services). */
export function townSlugs(content: unknown): string[] {
  const taken: string[] = [];
  for (const t of townsOf(obj(content))) taken.push(serviceSlug({ t }, taken));
  return taken;
}

export interface TownPagePick { town: string; slug: string; photos: TownPhoto[] }

/** The towns that get their own page (L4, L6, L14), in the client's own town order. */
export function pickTownPages(content: unknown, cap = TOWN_PAGES_MAX): TownPagePick[] {
  const c = obj(content);
  const main = primaryCity(content);
  const towns = townsOf(c);
  const slugs = townSlugs(content);
  const top = topTownsOf(c);
  const scored = towns.flatMap((town, order) => {
    if (same(town, main)) return [];
    const kinds = [photosIn(c, town).length, reviewsIn(c, town).length, sourcedNotesIn(c, town).length];
    const count = kinds.reduce((a, b) => a + b, 0);
    if (count < TOWN_FACTS_MIN || kinds.filter((k) => k > 0).length < TOWN_FACT_KINDS_MIN) return [];
    const rank = top.findIndex((t) => same(t, town));
    return [{ town, order, count, rank: rank < 0 ? top.length : rank }];
  });
  return scored
    .sort((a, b) => b.count - a.count || a.rank - b.rank || a.order - b.order)
    .slice(0, cap)
    .sort((a, b) => a.order - b.order)
    .map(({ town, order }) => ({ town, slug: slugs[order], photos: photosIn(c, town) }));
}

export interface TownServicePagePick {
  town: string;
  townSlug: string;
  /** The service's slug. */
  service: string;
  serviceIndex: number;
}

/** The approved town + service pages whose facts pass, in approval order. */
export function pickTownServicePages(content: unknown, cap = TOWN_SERVICE_PAGES_MAX): TownServicePagePick[] {
  const c = obj(content);
  const main = primaryCity(content);
  const towns = townsOf(c);
  const tSlugs = townSlugs(content);
  const sSlugs = serviceSlugs(content);
  const paged = new Set(pickServicePages(content, MAX_PAGES));
  const seen = new Set<string>();
  const out: TownServicePagePick[] = [];
  for (const a of approvedOf(c)) {
    const ti = towns.findIndex((t) => same(t, str(a.town)));
    const si = sSlugs.indexOf(str(a.service));
    if (ti < 0 || si < 0 || !paged.has(si) || same(towns[ti], main)) continue;
    const town = towns[ti];
    const service = sSlugs[si];
    const key = `${tSlugs[ti]}/${service}`;
    if (seen.has(key)) continue;
    const facts = photosIn(c, town).filter((p) => p.service === service).length
      + reviewsIn(c, town).filter((r) => str(r.service) === service).length
      + sourcedNotesIn(c, town).filter((n) => str(n.service) === service).length;
    if (facts < TOWN_SERVICE_FACTS_MIN) continue;
    seen.add(key);
    out.push({ town, townSlug: tSlugs[ti], service, serviceIndex: si });
  }
  return out.slice(0, cap);
}

/** One photo as the copywriter sees it: the client's own words about that job, no image, no
 *  place more exact than the town. */
function photoFacts(f: Json, p: TownPhoto, serviceNames: Map<string, string>): Json {
  const src = obj(arr(obj(f.work).projects)[p.index]);
  const out: Json = {};
  if (str(src.t)) out.title = str(src.t);
  if (str(src.scope)) out.job = str(src.scope);
  if (serviceNames.get(p.service)) out.service = serviceNames.get(p.service);
  if (str(src.size)) out.size = str(src.size);
  if (str(src.yr)) out.year = str(src.yr);
  if (str(src.caption)) out.clientCaption = str(src.caption);
  return out;
}

/** A review as the copywriter sees it: the words and the service, never the reviewer's name. */
function reviewFacts(r: Json, serviceNames: Map<string, string>): Json {
  const out: Json = { quote: str(r.q) };
  if (serviceNames.get(str(r.service))) out.service = serviceNames.get(str(r.service));
  return out;
}

function namesBySlug(content: unknown, factsFrom: Json): Map<string, string> {
  const slugs = serviceSlugs(content);
  const items = arr(obj(obj(content).services).items).map(obj);
  const factItems = arr(obj(factsFrom.services).items).map(obj);
  return new Map(slugs.map((s, i) => [s, str(factItems[i]?.t) || str(items[i]?.t)]));
}

/**
 * The facts for each town page. `content` decides which towns get a page and which photos are
 * theirs, exactly as the export does; `factsFrom` is where every fact is read (the brief passes its
 * grounded content, so a preset's sample job never becomes a town's).
 */
export function townPageFacts(content: unknown, factsFrom: unknown = content): Json[] {
  const f = obj(factsFrom);
  const names = namesBySlug(content, f);
  const basedIn = primaryCity(factsFrom);
  return pickTownPages(content).map(({ town, slug, photos: ph }) => {
    const out: Json = { slug, town };
    if (basedIn) out.basedIn = basedIn;
    const services = arr(obj(f.services).items).map(obj).filter((s) => strings(s.areas).some((a) => same(a, town))).map((s) => str(s.t)).filter(Boolean);
    if (services.length) out.servicesHere = services;
    out.photos = ph.map((p) => photoFacts(f, p, names));
    const reviews = reviewsIn(f, town).map((r) => reviewFacts(r, names));
    if (reviews.length) out.reviews = reviews;
    const notes = sourcedNotesIn(f, town).map((n) => ({ text: str(n.text), source: str(n.url) }));
    if (notes.length) out.notes = notes;
    return out;
  });
}

/** The facts for each town + service page: that town's facts for that service, plus the
 *  service's Q5, Q6 and how long it takes. */
export function townServicePageFacts(content: unknown, factsFrom: unknown = content): Json[] {
  const f = obj(factsFrom);
  const names = namesBySlug(content, f);
  const factItems = arr(obj(f.services).items).map(obj);
  return pickTownServicePages(content).map(({ town, townSlug, service, serviceIndex }) => {
    const s = factItems[serviceIndex] ?? {};
    const out: Json = { town: townSlug, townName: town, service, serviceName: names.get(service) };
    const ph = photosIn(obj(content), town).filter((p) => p.service === service).map((p) => photoFacts(f, p, names));
    if (ph.length) out.photos = ph;
    const reviews = reviewsIn(f, town).filter((r) => str(r.service) === service).map((r) => reviewFacts(r, names));
    if (reviews.length) out.reviews = reviews;
    const notes = sourcedNotesIn(f, town).filter((n) => str(n.service) === service).map((n) => ({ text: str(n.text), source: str(n.url) }));
    if (notes.length) out.notes = notes;
    if (priceFactorsOf(s).length) out.priceFactors = priceFactorsOf(s);
    if (typicalVisitOf(s).length) out.typicalVisit = typicalVisitOf(s);
    if (str(s.duration)) out.howLong = str(s.duration);
    return out;
  });
}

// ── The generated copy's shape ────────────────────────────────────────────────────────────────

/** Generated copy for one town + service page. */
export interface TownServicePageCopy { intro: string; expect: string[]; faq: { q: string; a: string }[] }

/** Generated copy for one town page, stored at content.townPages[townSlug]. Every string in it is
 *  generated, so none of it counts toward the export's 40% rule (L7). */
export interface TownPageCopy {
  /** The town as the intake spells it. */
  town: string;
  intro?: string;
  /** One line per town-tagged job photo, keyed by the photo's image URL. */
  captions?: { image: string; caption: string }[];
  services?: Record<string, TownServicePageCopy>;
}

export type TownPagesCopy = Record<string, TownPageCopy>;
