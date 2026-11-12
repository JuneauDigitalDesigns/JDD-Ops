/**
 * Business-identity and SEO values that must never reach a client site (2026-11-11).
 *
 * The Studio's effective content is `preset <- imported <- generated <- edits`, and the merge
 * reads null, "" and [] as "missing", so wherever a client gave nothing the industry preset's
 * sample filled the gap. For identity that means somebody else's business: a client with
 * `brand.email: null` shipped `owner@yourhvaccompany.com` in every contact block and footer, in
 * the JSON-LD business node and in llms.txt; one with no SEO copy yet shipped "Your HVAC Company |
 * Heating & Cooling Service" and the preset's "Licensed HVAC contractor ... 24/7 emergency service"
 * as its root title and its home, JSON-LD and llms.txt description; one with no legal line shipped
 * "© 2026 Your HVAC Company LLC". Copy generation then spread the base's brand and footer into
 * `generated`, so the sample outlived the client filling in their own value later. Found on
 * Tracewell Heating & Air (finding 6 of the 2026-11-11 onboarding test), whose `.draft.json` has
 * `generated.footer.legal` set to the HVAC preset's.
 *
 * Same shape as lib/placeholderCanonical.ts (#78) and lib/sampleReviews.ts: a list of every value
 * any preset, the default seed or the template has shipped in these fields, and a strip that runs
 * AFTER the merge (so an emptied value can't fall through to the preset again). It runs on the
 * Studio's effective content, so the preview shows what the export ships, and again in the export
 * route before site.ts is written, the gate a direct API call cannot skip. Add to the list, never
 * remove from it: a sample deleted from a preset is still baked into any draft or repo made while
 * it was there. test/preset-identity-no-fallthrough.test.mjs fails when a preset carries a value
 * the list doesn't.
 *
 * A value equal to a sample counts as the sample whoever supplied it, the rule #79's
 * copy-brief/grounded.ts applies to the copy brief: a close-seeded client's imported content IS the
 * preset plus a name. A field is matched exactly against its own kind of sample (whitespace and
 * case aside, digits only for phones); free text that embeds identity (the legal line, a "Call
 * (555) 555-0100" button, a trust badge with a license number) is emptied when one of those samples
 * appears inside it. Never a pattern: the e2e fixtures' real numbers are 555-01xx too.
 *
 * Sample CLAIMS go the same way (operator decision, 2026-11-11): a rating, trust badges, logos,
 * stat tiles and copy that names a placeholder place. The HVAC preset's `reviewBadge` (4.9 from 340)
 * showed a client with no rating as 4.9 stars from 340 reviews in the hero, the reviews band and the
 * trust strip; its four badges and "4.9★ From 180+ verified reviews" stat did the same for badges
 * and stats; "Your City's Trusted Plumbing Pros" headed a hero. A client with no real value shows
 * nothing. Lists (badges, logos, stats, hero bullets) are compared as a WHOLE list, the way
 * grounded.ts and intake-sources.ts judge them: a client's own "BBB Accredited" or "4.9★ Customer
 * rating" sits in a list that is not the preset's and is kept. A list falls through whole, so the
 * whole list is what a fall-through looks like.
 *
 * Deliberately NOT listed: the seed's bare name "Peak" and its "Est. 2011", which a real client
 * could plausibly have. Only the default-seed export branch (a direct API call with neither content
 * nor vertical) could ship them, and that branch ships the whole sample site anyway.
 *
 * CLIENT-SAFE: imported by the Studio ('use client').
 */

type Json = Record<string, unknown>;
const isPlainObject = (x: unknown): x is Json => typeof x === 'object' && x !== null && !Array.isArray(x);

export interface SampleIdentity {
  /** Where it shipped from, for the reader. */
  from: string;
  names?: string[];
  taglines?: string[];
  phones?: string[];
  emails?: string[];
  addresses?: string[];
  licenses?: string[];
  titles?: string[];
  descriptions?: string[];
  /** Footer legal lines (matched exactly and, through `names`, by the legal name they carry). */
  legal?: string[];
}

export const RETIRED_SAMPLE_IDENTITY: readonly SampleIdentity[] = [
  {
    from: 'data/verticals/hvac.ts',
    names: ['Your HVAC Co.', 'Your HVAC Company LLC'],
    taglines: ['Comfort in every season.'],
    phones: ['(555) 555-0100'],
    emails: ['owner@yourhvaccompany.com'],
    addresses: ['123 Main St, Your City, ST 00000'],
    licenses: ['CAC1234567'],
    titles: ['Your HVAC Company | Heating & Cooling Service'],
    descriptions: ['Licensed HVAC contractor offering furnace repair, AC installation, maintenance plans, and 24/7 emergency service.'],
    legal: ['© 2026 Your HVAC Company LLC. All rights reserved.'],
  },
  {
    from: 'data/verticals/roofing.ts',
    names: ['Your Roofing Co.', 'Your Roofing Company LLC'],
    taglines: ['Protecting what matters most.'],
    phones: ['(555) 555-0100'],
    emails: ['owner@yourroofingcompany.com'],
    addresses: ['123 Main St, Your City, ST 00000'],
    titles: ['Your Roofing Company | Roof Replacement & Repair'],
    descriptions: ['GAF-certified roofing contractor offering roof replacements, storm damage repair, gutter installation, and free inspections.'],
    legal: ['© 2026 Your Roofing Company LLC. All rights reserved.'],
  },
  {
    from: 'data/verticals/plumbing.ts',
    names: ['Your Plumbing Co.', 'Your Plumbing Company LLC'],
    taglines: ['Fast fixes, honest prices.'],
    phones: ['(555) 555-0100'],
    emails: ['owner@yourplumbingcompany.com'],
    addresses: ['123 Main St, Your City, ST 00000'],
    titles: ['Your Plumbing Company | Same-Day Plumbing Service'],
    descriptions: ['Licensed plumbing contractor offering same-day service for leaks, drain clearing, water heaters, and 24/7 emergency plumbing.'],
    legal: ['© 2026 Your Plumbing Company LLC. All rights reserved.'],
  },
  {
    from: 'data/verticals/lawn-care.ts',
    names: ['Your Lawn Care Co.', 'Your Lawn Co.', 'Your Lawn Care Company LLC'],
    taglines: ["A lawn you'll love, all season long."],
    phones: ['(555) 555-0100'],
    emails: ['owner@yourlawncare.com'],
    addresses: ['123 Main St, Your City, ST 00000'],
    titles: ['Your Lawn Care Company | Lawn Mowing & Treatments'],
    descriptions: ['Locally owned lawn care company offering mowing, fertilization, aeration, weed control, and seasonal lawn treatments.'],
    legal: ['© 2026 Your Lawn Care Company LLC. All rights reserved.'],
  },
  {
    from: 'data/verticals/car-detailing.ts',
    names: ['Your Detailing Co.', 'Your Detailing Company LLC'],
    taglines: ['Showroom quality, delivered to you.'],
    phones: ['(555) 555-0100'],
    emails: ['owner@yourdetailingco.com'],
    addresses: ['123 Main St, Your City, ST 00000'],
    titles: ['Your Detailing Company | Professional Auto Detailing'],
    descriptions: [
      'Professional auto detailing, interior, exterior, paint correction, ceramic coatings, and mobile service.',
      'Professional auto detailing — interior, exterior, paint correction, ceramic coatings, and mobile service.',
    ],
    legal: ['© 2026 Your Detailing Company LLC. All rights reserved.'],
  },
  {
    from: 'data/verticals/health.ts',
    names: ['Your Wellness Practice', 'Your Wellness Practice LLC'],
    taglines: ['Care that meets you where you are.'],
    phones: ['(555) 555-0123'],
    emails: ['hello@yourwellnesspractice.com'],
    addresses: ['123 Main St, Your City, ST 00000'],
    titles: ['Your Wellness Practice | Whole-Person Wellness Care'],
    descriptions: [
      'Whole-person wellness practice offering consultations, personalized care plans, and ongoing support. New clients welcome, book online.',
      'Whole-person wellness practice offering consultations, personalized care plans, and ongoing support. New clients welcome — book online.',
    ],
    legal: ['© 2026 Your Wellness Practice LLC. All rights reserved.'],
  },
  {
    from: 'data/site.ts (the default seed)',
    names: ['Peak Home Services LLC', 'Peak Home Services'],
    taglines: ['Reliable service, every season.'],
    phones: ['(907) 555-0142'],
    emails: ['owner@peakhomeservices.com'],
    addresses: ['318 Glacier Ave, Juneau, AK 99801'],
    licenses: ['AK-GC-2019-04817'],
    titles: ['Peak Home Services | HVAC & Plumbing in Juneau, AK'],
    descriptions: ["Juneau's trusted HVAC, plumbing, and home services company. Same-day diagnostics, price-lock guarantee, and 24/7 emergency support."],
    legal: ['© 2026 Peak Home Services LLC. All rights reserved.'],
  },
  {
    from: 'template/src/data/site.ts and scripts/new-client.js',
    names: ['Your Business', 'yourbiz', 'Your Business LLC'],
    taglines: ['A short, clear statement of what you do.'],
    phones: ['(907) 555-0100'],
    emails: ['hello@example.com'],
    addresses: ['123 Main St, Juneau, AK 99801'],
    titles: ['Your Business', 'TODO'],
    descriptions: ['A short, clear statement of what you do.', 'TODO'],
  },
];

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
/** National digits: "(555) 555-0100", "tel:+15555550100" and "5555550100" are one number. */
const phoneDigits = (s: string) => {
  const d = s.replace(/\D/g, '');
  return d.length === 11 && d.startsWith('1') ? d.slice(1) : d;
};
const emailKey = (s: string) => norm(s.replace(/^mailto:/i, ''));

const collect = (pick: (s: SampleIdentity) => string[] | undefined, key: (s: string) => string) =>
  new Set(RETIRED_SAMPLE_IDENTITY.flatMap((s) => pick(s) ?? []).map(key).filter(Boolean));

const NAMES = collect((s) => s.names, norm);
const TAGLINES = collect((s) => s.taglines, norm);
const PHONES = collect((s) => s.phones, phoneDigits);
const EMAILS = collect((s) => s.emails, emailKey);
const ADDRESSES = collect((s) => s.addresses, norm);
const LICENSES = collect((s) => s.licenses, norm);
const TITLES = collect((s) => s.titles, norm);
const DESCRIPTIONS = collect((s) => s.descriptions, norm);
const LEGAL = collect((s) => s.legal, norm);

/** Sample tokens that mark free text (a legal line, "Call (555) 555-0100", a trust badge) as
 *  carrying somebody else's identity. Names only where they can't be a real business's words:
 *  the "Your ..." placeholders and the seed's full name. */
const TEXT_NAMES = [...NAMES].filter((n) => (n.startsWith('your ') && n.length >= 8) || n.startsWith('peak home services'));
const TEXT_TOKENS = [...TEXT_NAMES, ...EMAILS, ...LICENSES, ...ADDRESSES];

type Kind = 'name' | 'tagline' | 'phone' | 'email' | 'address' | 'license' | 'title' | 'description';

/** Identity fields, each matched exactly against its own kind of sample. */
export const IDENTITY_FIELDS: readonly { path: string; kind: Kind }[] = [
  { path: 'brand.name', kind: 'name' },
  { path: 'brand.short', kind: 'name' },
  { path: 'brand.long', kind: 'name' },
  { path: 'brand.tagline', kind: 'tagline' },
  { path: 'brand.phone', kind: 'phone' },
  { path: 'brand.phoneHref', kind: 'phone' },
  { path: 'brand.email', kind: 'email' },
  { path: 'brand.address', kind: 'address' },
  { path: 'brand.license', kind: 'license' },
  { path: 'seo.title', kind: 'title' },
  { path: 'seo.description', kind: 'description' },
  { path: 'extensions.contactDetails.address', kind: 'address' },
];

/** Free text that embeds identity: emptied when it carries any sample name, phone, email,
 *  license or address. */
export const IDENTITY_TEXT_FIELDS: readonly string[] = ['footer.legal', 'hero.secondaryCta', 'finalCta.secondary'];

/** A list of short texts, filtered item by item the same way (the HVAC preset's
 *  "Licensed & insured · CAC1234567"). */
export const IDENTITY_TEXT_LISTS: readonly string[] = ['extensions.trustBadges'];

// ── Sample claims ────────────────────────────────────────────────────────────

/** Every rating a preset, the seed or the template has shipped. Matched on rating and count, and
 *  only with no review link: a client's own badge carries the URL of their reviews. */
export const RETIRED_SAMPLE_RATINGS: readonly { from: string; rating: number; count: number }[] = [
  { from: 'data/verticals/hvac.ts', rating: 4.9, count: 340 },
];

/** Every whole list a preset, the seed or the template has shipped at these paths, read from each
 *  file's git history (and deprecated/studio/preview's presets). */
export const RETIRED_SAMPLE_LISTS: Readonly<Record<string, readonly { from: string; list: readonly (string | Json)[] }[]>> = {
  "extensions.trustBadges": [
    { from: "data/verticals/hvac.ts", list: ["Licensed & insured · CAC1234567", "24/7 emergency service", "Financing available", "Satisfaction guaranteed"] },
    { from: "data/verticals/hvac.ts", list: ["NATE Certified Technicians", "EPA 608 Certified", "Energy Star Partner", "BBB Accredited"] },
    { from: "data/verticals/roofing.ts", list: ["GAF Certified Installer", "Insurance Claims Specialist", "30-Year Workmanship Warranty", "Licensed & Bonded"] },
    { from: "data/verticals/plumbing.ts", list: ["Licensed & Bonded", "Upfront Pricing", "Background-Checked Technicians", "Satisfaction Guarantee"] },
    { from: "data/verticals/lawn-care.ts", list: ["Eco-Friendly Products", "Satisfaction Guaranteed", "Locally Owned & Operated", "Fully Insured"] },
    { from: "data/verticals/car-detailing.ts", list: ["Certified Detailers", "5-Star Google Rating", "100% Satisfaction Guarantee", "Insured & Bonded"] },
    { from: "data/verticals/health.ts", list: ["Licensed Practitioners", "Privacy-First Care", "Insured & Accredited", "Community Trusted"] },
    { from: "data/site.ts (the default seed)", list: ["EPA 608 Certified", "NATE-Certified Technicians", "BBB Accredited", "Best of Juneau 2023 & 2024"] },
  ],
  "trust.logos": [
    { from: "data/verticals/hvac.ts", list: ["NATE Certified", "EPA 608 Certified", "Energy Star Partner", "BBB Accredited", "Licensed & Insured"] },
    { from: "data/verticals/roofing.ts", list: ["GAF Certified", "Insurance Claims Specialist", "30-Year Warranty", "Licensed & Bonded", "BBB Accredited"] },
    { from: "data/verticals/plumbing.ts", list: ["Licensed & Bonded", "Upfront Pricing", "Background Checked", "24/7 Emergency", "BBB Accredited"] },
    { from: "data/verticals/lawn-care.ts", list: ["Eco-Friendly Products", "Satisfaction Guaranteed", "Locally Owned", "Fully Insured", "Free Estimates"] },
    { from: "data/verticals/car-detailing.ts", list: ["Certified Detailers", "5-Star Rated", "100% Satisfaction", "Insured & Bonded", "Mobile Service Available"] },
    { from: "data/verticals/health.ts", list: ["Licensed Practitioners", "Privacy-First Care", "Insured & Accredited", "5-Star Reviewed", "Community Partner"] },
    { from: "data/site.ts (the default seed)", list: ["City of Juneau", "Bergmann Properties", "Juneau School District", "EPA 608 Certified", "NATE-Certified", "BBB Accredited", "Best of Juneau 2024"] },
  ],
  "about.stats": [
    { from: "data/verticals/hvac.ts", list: [{ n: "24/7", l: "Emergency service, real humans" }, { n: "18+", l: "Years serving your area" }, { n: "4.9★", l: "From 180+ verified reviews" }, { n: "12", l: "Towns in our coverage area" }] },
    { from: "data/verticals/hvac.ts", list: [{ n: "24/7", l: "Emergency support" }, { n: "1 hr", l: "Avg. response time" }, { n: "4.9★", l: "Customer rating" }, { n: "100%", l: "Satisfaction guarantee" }] },
    { from: "data/verticals/roofing.ts", list: [{ n: "500+", l: "Roofs replaced" }, { n: "30 yr", l: "Warranty coverage" }, { n: "4.9★", l: "Customer rating" }, { n: "100%", l: "Satisfaction guarantee" }] },
    { from: "data/verticals/plumbing.ts", list: [{ n: "24/7", l: "Emergency support" }, { n: "Same Day", l: "Service available" }, { n: "4.9★", l: "Customer rating" }, { n: "100%", l: "Satisfaction guarantee" }] },
    { from: "data/verticals/lawn-care.ts", list: [{ n: "200+", l: "Lawns maintained" }, { n: "Eco", l: "Certified products" }, { n: "4.9★", l: "Customer rating" }, { n: "100%", l: "Satisfaction guarantee" }] },
    { from: "data/verticals/car-detailing.ts", list: [{ n: "500+", l: "Vehicles detailed" }, { n: "5★", l: "Google rating" }, { n: "4.9", l: "Average review score" }, { n: "100%", l: "Satisfaction guarantee" }] },
    { from: "data/verticals/health.ts", list: [{ n: "Same wk", l: "Appointment availability" }, { n: "1:1", l: "Personalized attention" }, { n: "4.9★", l: "Client rating" }, { n: "100%", l: "Confidential & private" }] },
    { from: "data/site.ts (the default seed)", list: [{ n: "14+", l: "Years in business" }, { n: "2,400+", l: "Jobs completed" }, { n: "4.9", l: "Average review rating" }, { n: "24/7", l: "Emergency support" }] },
  ],
  "hero.heroBullets": [
    { from: "data/verticals/hvac.ts", list: [{ value: "24/7", label: "Emergency line" }, { value: "1 hr", label: "Response time" }, { value: "4.9", label: "Average rating" }, { value: "100%", label: "Satisfaction" }] },
    { from: "data/verticals/roofing.ts", list: [{ value: "500+", label: "Roofs replaced" }, { value: "30 yr", label: "Workmanship warranty" }, { value: "4.9", label: "Average rating" }, { value: "100%", label: "Satisfaction" }] },
    { from: "data/verticals/plumbing.ts", list: [{ value: "24/7", label: "Emergency line" }, { value: "Same Day", label: "Service available" }, { value: "4.9", label: "Average rating" }, { value: "100%", label: "Satisfaction" }] },
    { from: "data/verticals/lawn-care.ts", list: [{ value: "200+", label: "Lawns maintained" }, { value: "Eco", label: "Friendly products" }, { value: "4.9", label: "Average rating" }, { value: "100%", label: "Satisfaction" }] },
    { from: "data/verticals/car-detailing.ts", list: [{ value: "500+", label: "Vehicles detailed" }, { value: "5★", label: "Google rating" }, { value: "4.9", label: "Average review" }, { value: "100%", label: "Satisfaction" }] },
    { from: "data/verticals/health.ts", list: [{ value: "Same wk", label: "Appointments" }, { value: "1:1", label: "Personal care" }, { value: "4.9", label: "Average rating" }, { value: "100%", label: "Confidential" }] },
    { from: "data/site.ts (the default seed)", list: [{ value: "2,400+", label: "Jobs completed" }, { value: "4.9", label: "Average rating" }, { value: "14 yrs", label: "In business" }, { value: "24/7", label: "Emergency line" }] },
  ],
};

/** Copy that names a placeholder place, or (the hero badge) states a sample rating, matched exactly
 *  at its own path. */
export const RETIRED_SAMPLE_TEXT: Readonly<Record<string, readonly string[]>> = {
  'hero.eyebrow': [
    "Your City's Trusted HVAC Experts",
    "Your City's Trusted Plumbing Pros",
    "Your City's Trusted Roofing Contractor",
    "Your City's Whole-Person Wellness Practice",
    'Your Neighborhood Lawn Experts',
  ],
  'hero.sub': [
    "Same-day repairs, honest flat-rate quotes, and technicians who show up on time. Keeping your city's homes comfortable since 2009.",
  ],
  'work.sub': ['Real results from real customers in your neighborhood.'],
  'hero.badge': ['4.9 / 5, 300+ reviews', '4.9 / 5 — 300+ reviews'],
};

/** The seed's rating pillar, matched as a record. */
const RETIRED_SAMPLE_PILLARS: readonly { t: string; d: string }[] = [
  { t: '4.9-Star Rated', d: 'Over 300 verified reviews across Google and Facebook from real Juneau customers.' },
];

const itemKey = (v: unknown): string =>
  typeof v === 'string'
    ? norm(v)
    : isPlainObject(v)
      ? JSON.stringify(Object.keys(v).sort().map((k) => [k, typeof v[k] === 'string' ? norm(v[k] as string) : v[k]]))
      : JSON.stringify(v);

/** The record keys a sample list at `path` was recorded with ({n, l}, {value, label}), or none. */
const recordKeysFor = (path: string): string[] | undefined => {
  const first = RETIRED_SAMPLE_LISTS[path]?.[0]?.list[0];
  return isPlainObject(first) ? Object.keys(first) : undefined;
};

/** A list's identity: its non-blank items, normalized, in order. Records are compared on the keys
 *  the sample was recorded with, so an id or icon added later doesn't hide a sample. */
const listKey = (list: readonly unknown[], keys?: string[]): string =>
  JSON.stringify(
    list
      .filter((v) => v !== null && v !== undefined && !(typeof v === 'string' && !v.trim()))
      .map((v) => itemKey(keys && isPlainObject(v) ? Object.fromEntries(keys.map((k) => [k, v[k]])) : v)),
  );

const SAMPLE_LIST_KEYS = new Map(
  Object.entries(RETIRED_SAMPLE_LISTS).map(([path, entries]) => [
    path,
    new Set(entries.map((e) => listKey(e.list, recordKeysFor(path)))),
  ]),
);

/** True when `list` is, blanks aside, a whole list a preset, the seed or the template shipped at `path`. */
export function isSampleList(path: string, list: unknown): boolean {
  if (!Array.isArray(list) || !list.length) return false;
  const known = SAMPLE_LIST_KEYS.get(path);
  return !!known && known.has(listKey(list, recordKeysFor(path)));
}

/** True when this review badge is a preset's sample rating. */
export function isSampleRating(badge: unknown): boolean {
  if (!isPlainObject(badge)) return false;
  const url = typeof badge.url === 'string' ? badge.url.trim() : '';
  return !url && RETIRED_SAMPLE_RATINGS.some((r) => Number(badge.rating) === r.rating && Number(badge.count) === r.count);
}

const SAMPLE_TEXT = new Map(Object.entries(RETIRED_SAMPLE_TEXT).map(([path, list]) => [path, new Set(list.map(norm))]));
const SAMPLE_PILLARS = new Set(RETIRED_SAMPLE_PILLARS.map((p) => itemKey({ t: p.t, d: p.d })));

function isSampleOf(kind: Kind, value: string): boolean {
  switch (kind) {
    case 'name': return NAMES.has(norm(value));
    case 'tagline': return TAGLINES.has(norm(value));
    case 'phone': { const d = phoneDigits(value); return d.length >= 7 && PHONES.has(d); }
    case 'email': return EMAILS.has(emailKey(value));
    case 'address': return ADDRESSES.has(norm(value));
    case 'license': return LICENSES.has(norm(value));
    case 'title': return TITLES.has(norm(value));
    case 'description': return DESCRIPTIONS.has(norm(value));
  }
}

/** True when free text carries a sample identity value anywhere in it. */
export function carriesSampleIdentity(value: unknown): boolean {
  if (typeof value !== 'string' || !value.trim()) return false;
  const text = norm(value);
  if (LEGAL.has(text)) return true;
  if (TEXT_TOKENS.some((t) => text.includes(t))) return true;
  // Any run of phone-shaped characters whose digits are a sample number.
  for (const run of value.match(/[+\d][\d\s().-]{6,}\d/g) ?? []) {
    if (PHONES.has(phoneDigits(run))) return true;
  }
  return false;
}

/** True when `value` is a sample of the identity field at `path` (see IDENTITY_FIELDS). */
export function isSampleIdentity(path: string, value: unknown): boolean {
  if (typeof value !== 'string' || !value.trim()) return false;
  const field = IDENTITY_FIELDS.find((f) => f.path === path);
  if (field) return isSampleOf(field.kind, value);
  if (IDENTITY_TEXT_FIELDS.includes(path)) return carriesSampleIdentity(value);
  return false;
}


function get(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const seg of path.split('.')) {
    if (!isPlainObject(cur)) return undefined;
    cur = cur[seg];
  }
  return cur;
}

/** Immutable set along an existing path of plain objects (never creates one). */
function set<T>(obj: T, path: string, value: unknown): T {
  const [head, ...rest] = path.split('.');
  const node = obj as unknown as Json;
  const next = rest.length ? set(node[head], rest.join('.'), value) : value;
  return { ...node, [head]: next } as T;
}

export interface RemovedIdentity {
  path: string;
  value: string;
}

/**
 * Empty every identity field that holds a sample, and drop sample-bearing items from the text
 * lists. Returns the input untouched (same object) when there is nothing to remove, and never
 * mutates it. `removed` lists what was dropped, for the export's step log.
 */
export function stripPresetIdentity<T>(content: T): { content: T; removed: RemovedIdentity[] } {
  if (!isPlainObject(content)) return { content, removed: [] };
  const removed: RemovedIdentity[] = [];
  let out = content;

  for (const path of [...IDENTITY_FIELDS.map((f) => f.path), ...IDENTITY_TEXT_FIELDS]) {
    const value = get(out, path);
    if (typeof value !== 'string' || !value.trim()) continue;
    if (isSampleIdentity(path, value)) {
      out = set(out, path, '');
      removed.push({ path, value });
    }
  }

  // Sample claims: the rating, whole sample lists, placeholder-place copy, the seed's rating pillar.
  // Before the item filter below, so the HVAC badges are judged as the list they fell through as.
  if (isSampleRating(get(out, 'extensions.reviewBadge'))) {
    removed.push({ path: 'extensions.reviewBadge', value: JSON.stringify(get(out, 'extensions.reviewBadge')) });
    out = set(out, 'extensions.reviewBadge', null);
  }
  for (const path of Object.keys(RETIRED_SAMPLE_LISTS)) {
    const list = get(out, path);
    if (isSampleList(path, list)) {
      removed.push({ path, value: JSON.stringify(list) });
      out = set(out, path, []);
    }
  }
  for (const [path, known] of SAMPLE_TEXT) {
    const value = get(out, path);
    if (typeof value === 'string' && known.has(norm(value))) {
      removed.push({ path, value });
      out = set(out, path, '');
    }
  }
  const pillars = get(out, 'about.pillars');
  if (Array.isArray(pillars)) {
    const kept = pillars.filter((p) => !(isPlainObject(p) && SAMPLE_PILLARS.has(itemKey({ t: p.t, d: p.d }))));
    if (kept.length !== pillars.length) {
      removed.push({ path: 'about.pillars', value: JSON.stringify(pillars.filter((p) => !kept.includes(p))) });
      out = set(out, 'about.pillars', kept);
    }
  }

  for (const path of IDENTITY_TEXT_LISTS) {
    const list = get(out, path);
    if (!Array.isArray(list)) continue;
    const kept = list.filter((item) => !carriesSampleIdentity(item));
    if (kept.length === list.length) continue;
    for (const item of list) if (!kept.includes(item)) removed.push({ path, value: String(item) });
    out = set(out, path, kept);
  }

  // A client who gave a phone but no tel: link inherited the preset's link, so their call buttons
  // dialled (555) 555-0100. With that link gone, build it from their own number rather than ship
  // a call button that goes nowhere (the same rule copy-brief/apply-generated.ts uses).
  const phone = get(out, 'brand.phone');
  if (removed.some((r) => r.path === 'brand.phoneHref') && typeof phone === 'string' && phone.trim()) {
    out = set(out, 'brand.phoneHref', `tel:${phone.replace(/[^0-9+]/g, '')}`);
  }

  return { content: out, removed };
}
