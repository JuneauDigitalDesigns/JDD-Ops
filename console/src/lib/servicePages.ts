/**
 * Which services earn their own page, and at what URL (service-page-spec.md §1-§2, in the shared
 * session notes; Xander's decision of 2026-11-10 that each service gets a page under /services).
 *
 * A page per service only helps when each page has something of its own to say. Near-identical
 * pages that differ by a heading are what Google's spam policy calls doorways, so a service needs
 * real, client-supplied facts before it gets a page:
 *
 *   core:  `included` with 3+ items, or `typicalJobs` with 2+
 *   plus:  at least one more fact (the other core list, a starting price, brands, areas that
 *          narrow the service area, or a real review / job photo / customer question tagged to it)
 *
 * A service that misses stays a card on /services (`/services#<slug>`): no page, no sitemap
 * entry, no dead link. Nothing here generates copy, and nothing is ever padded to pass.
 *
 * The ONE implementation: the export, the Studio's page wiring and intake-wizard's "this service
 * needs N more facts" hint all import it, the way onboard-checks.js serves both the suite and
 * the dry run. Reads content structurally so it works before the @jdd/schema fields land.
 * Guarded by test/service-page-gate.test.mjs.
 */

type Json = Record<string, unknown>;

const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const filled = (v: unknown): string[] => arr(v).map(str).filter(Boolean);

/** The names a fact is reported under, in the order the intake hint lists them. */
export type ServiceFact =
  | 'included' | 'typicalJobs' | 'priceFrom' | 'brands' | 'areas' | 'review' | 'photo' | 'question';

export const INCLUDED_MIN = 3;
export const TYPICAL_JOBS_MIN = 2;
/** Core fact + one more. */
export const FACTS_MIN = 2;

const STOP_WORDS = new Set(['and', 'with', 'for', 'of', 'the', 'a', 'an', 'in', 'on', 'to', 'or']);
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function slugBase(name: string): string {
  const words = name
    .toLowerCase()
    .replace(/\bnear\s+me\b/g, ' ')
    .replace(/&/g, ' ')
    .split(/[^a-z0-9]+/)
    .filter((w) => w && w !== 'and');
  const five = words.slice(0, 5);
  while (five.length > 1 && STOP_WORDS.has(five[five.length - 1])) five.pop();
  return five.join('-').slice(0, 60).replace(/-+$/, '') || 'service';
}

/**
 * The URL slug for a service page (`/services/<slug>`). A valid stored `item.slug` wins, so a
 * renamed service keeps its published URL; otherwise it is derived from the name (at most five
 * words, no "&", "and" or "near me", no trailing stop word). `taken` holds slugs already assigned
 * on this site; a collision gets -2, -3.
 */
export function serviceSlug(item: { t?: unknown; slug?: unknown }, taken: Iterable<string>): string {
  const used = new Set(taken);
  const stored = str(item.slug);
  const base = stored && SLUG_RE.test(stored) && stored.length <= 60 ? stored : slugBase(str(item.t));
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!used.has(candidate)) return candidate;
  }
}

/** Slugs for every service, in order, collision-free. */
export function serviceSlugs(content: unknown): string[] {
  const out: string[] = [];
  for (const it of arr(obj(obj(content).services).items)) out.push(serviceSlug(obj(it), out));
  return out;
}

/** Which facts a service has, which it lacks, and how many it has. */
export function servicePageFacts(
  content: unknown,
  index: number,
): { count: number; core: boolean; have: ServiceFact[]; missing: ServiceFact[] } {
  const c = obj(content);
  const item = obj(arr(obj(c.services).items)[index]);
  const slug = serviceSlugs(content)[index] ?? '';
  const ext = obj(c.extensions);
  const siteArea = new Set(filled(ext.serviceArea).map((a) => a.toLowerCase()));
  const areas = filled(item.areas);
  const taggedTo = (list: unknown[]) => list.map(obj).some((x) => str(x.service) === slug && slug !== '');

  const has: Record<ServiceFact, boolean> = {
    included: filled(item.included).length >= INCLUDED_MIN,
    typicalJobs: filled(item.typicalJobs).length >= TYPICAL_JOBS_MIN,
    priceFrom: str(item.priceFrom) !== '',
    brands: filled(item.brands).length > 0,
    // Areas are a fact about THIS service only when they narrow the site's service area.
    areas: areas.length > 0 && (siteArea.size === 0 || areas.length < siteArea.size),
    review: taggedTo(arr(obj(c.testimonials).items).filter((t) => str(obj(t).q) !== '')),
    photo: taggedTo(arr(obj(c.work).projects)),
    question: taggedTo(arr(ext.customerQuestions).filter((q) => str(obj(q).q) !== '')),
  };
  const order = Object.keys(has) as ServiceFact[];
  const have = order.filter((k) => has[k]);
  return { count: have.length, core: has.included || has.typicalJobs, have, missing: order.filter((k) => !has[k]) };
}

/** True when the service has enough real facts for a page of its own. */
export function qualifiesForServicePage(content: unknown, index: number): boolean {
  const f = servicePageFacts(content, index);
  return f.core && f.count >= FACTS_MIN;
}

/**
 * The service indices that get a page, given how many page slots are left (MAX_PAGES minus the
 * site's other pages). Over the cap, the services with the most facts win; ties keep their
 * order. Returned in the services' original order, so pages sit in the order the client listed.
 */
export function pickServicePages(content: unknown, slotsLeft: number): number[] {
  const n = arr(obj(obj(content).services).items).length;
  const ranked = Array.from({ length: n }, (_, i) => i)
    .filter((i) => qualifiesForServicePage(content, i))
    .map((i) => ({ i, count: servicePageFacts(content, i).count }))
    .sort((a, b) => b.count - a.count || a.i - b.i);
  return ranked.slice(0, Math.max(0, slotsLeft)).map((r) => r.i).sort((a, b) => a - b);
}
