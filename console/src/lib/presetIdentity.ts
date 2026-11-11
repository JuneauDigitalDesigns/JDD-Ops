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
 * Deliberately NOT listed: the seed's bare name "Peak" and its "Est. 2011", which a real client
 * could plausibly have. Only the default-seed export branch (a direct API call with neither content
 * nor vertical) could ship them, and that branch ships the whole sample site anyway.
 *
 * CLIENT-SAFE: imported by the Studio ('use client').
 */

type Json = Record<string, unknown>;

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

const isPlainObject = (x: unknown): x is Json => typeof x === 'object' && x !== null && !Array.isArray(x);

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
