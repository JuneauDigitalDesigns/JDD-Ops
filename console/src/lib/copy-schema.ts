export interface CopyResult {
  // The tagline only. NO identity field (F-E6, approved 2026-11-11): the name, short name, legal
  // name, established year, phone, email, address and license are the client's, from the intake,
  // never the copywriter's. The phone matters most: a client's site advertises the JDD Twilio
  // number, and a model-written one would replace it. Removed from the output schema rather than
  // ignored after the fact, as PLAN D4 did for about.stats. The model still SEES them, as read-only
  // facts (copy-brief/facts.ts COPY_FACT_PATHS), so copy can name the business or the number.
  // See test/no-generated-identity.test.mjs and no-generated-legal-name.test.mjs.
  brand: {
    tagline: string;
  };
  announcement: { text: string };
  trust: { label?: string; logos?: string[] };
  hero: {
    eyebrow: string;
    headline: string;
    headlineEmphasis?: string;
    sub: string;
    cta: string;
    secondaryCta?: string;
    formLabel?: string;
    trust?: string;
    badge?: string;
    frictionReducers?: string[];
    heroBullets?: { value: string; label: string }[];
  };
  about: {
    eyebrow: string;
    title: string;
    body: string;
    story?: string[];
    pillars: { t: string; d: string }[];
    // NO stats field (PLAN D4, 2026-10-28): a statistic is a fact about the business, supplied
    // by the client at intake, never something the copywriter originates. Removed from the
    // model's own output schema rather than merely ignored after the fact, so the model is
    // never even offered the option — see apply-generated.ts and compile.ts's matching removal.
  };
  services: { eyebrow: string; title: string; sub: string; items: { t: string; d: string; tag: string; detail?: string }[] };
  work: {
    eyebrow: string;
    title: string;
    sub: string;
    projects?: { t: string; loc: string; yr: string; scope: string; size: string; caption: string }[];
  };
  // The reviews section's heading only. NO items (operator decision, 2026-11-10): a review is a
  // real customer's words, supplied by the client, never written by the copywriter. Removed from
  // the output schema rather than ignored after the fact, as PLAN D4 did for about.stats, so the
  // model is never offered the option. See test/no-generated-testimonials.test.mjs.
  testimonials: {
    eyebrow: string;
    title: string;
  };
  faq: { eyebrow: string; title: string; sub: string; items: { q: string; a: string }[] };
  finalCta: { eyebrow: string; headline: string; headlineEmphasis?: string; sub: string; cta: string; secondary?: string; frictionReducers?: string[] };
  footer: { blurb?: string };
  seo: { title: string; description: string };
  /** Per-subpage header + SEO for a multi-page site. One entry per non-home route; the route
   *  discriminator keeps the JSON schema a fixed shape (no dynamic object keys). Merged into
   *  SiteContent.subpages by applyGeneratedCopy. Only requested when the run carries subpages. */
  subpages?: {
    items: {
      route: string;
      eyebrow: string;
      title: string;
      sub: string;
      ctaLabel?: string;
      ctaHref?: string;
      seoTitle: string;
      seoDescription: string;
    }[];
  };
  /** Per-service page body copy (service-page-spec.md §3, §4): one item per service that earns
   *  its own page (lib/servicePages.ts), keyed by slug, merged into services.items[i].page. Only
   *  requested when at least one service qualifies. */
  servicePages?: {
    items: {
      slug: string;
      intro: string;
      expect: string[];
      faq: { q: string; a: string }[];
    }[];
  };
}

export type Section = keyof CopyResult;

/** The brand fields the copywriter writes: CopyResult.brand's keys. Everything else in `brand` is
 *  the client's (identity, palette, typography) and is never in the generated layer. */
export const COPYWRITER_BRAND_FIELDS = ['tagline'] as const satisfies readonly (keyof CopyResult['brand'])[];

/**
 * A generated layer's `brand` cut down to COPYWRITER_BRAND_FIELDS. A draft generated before
 * 2026-11-11 stored a copy of the whole brand there (the old applyGeneratedCopy spread
 * `base.brand`), which outranks the intake in the Studio's merge: it froze the name, phone,
 * address and the rest at generation time, and could carry a model-written phone or legal name.
 * effectiveContent runs every generated layer through this, so a stored draft heals without a rerun.
 */
export function withCopywriterBrandOnly<T>(generated: T): T {
  const brand = (generated as { brand?: Record<string, unknown> } | null)?.brand;
  if (!brand || typeof brand !== 'object') return generated;
  const keys = Object.keys(brand);
  if (keys.every((k) => (COPYWRITER_BRAND_FIELDS as readonly string[]).includes(k))) return generated;
  const kept = Object.fromEntries(COPYWRITER_BRAND_FIELDS.filter((k) => k in brand).map((k) => [k, brand[k]]));
  const out: Record<string, unknown> = { ...(generated as Record<string, unknown>) };
  if (Object.keys(kept).length) out.brand = kept;
  else delete out.brand;
  return out as T;
}

/** A review verdict addresses ONE section on ONE page instance (decision 50). Home sections and
 *  site-wide content use the bare section id; anything that exists per route is prefixed with that
 *  route. A section placed on two pages is approved independently, the way SiteContent.sectionStyles
 *  keys off the per-instance section id (lib/pages.ts styleKeyFor). Kept as a plain string so no
 *  @jdd/schema change is needed: CopyBrief.tickedSections is already typed string[]. */
export type VerdictKey = string; // `${section}` | `${route}:${section}`

export const verdictKey = (section: Section, route?: string): VerdictKey =>
  route ? `${route}:${section}` : section;

/** Split a key back into its parts. A key with no ':' is a home/site-wide section. */
export function parseVerdictKey(k: VerdictKey): { route?: string; section: Section } {
  const i = k.indexOf(':');
  return i < 0
    ? { section: k as Section }
    : { route: k.slice(0, i), section: k.slice(i + 1) as Section };
}

export const ALL_SECTIONS: Section[] = [
  'brand', 'announcement', 'trust', 'hero', 'about', 'services',
  'work', 'testimonials', 'faq', 'finalCta', 'footer', 'seo', 'subpages', 'servicePages',
];

const str = { type: 'string' } as const;
const num = { type: 'number' } as const;
const obj = (properties: Record<string, unknown>, required: string[]) =>
  ({ type: 'object', additionalProperties: false, properties, required });
const arr = (items: unknown) => ({ type: 'array', items });

const SECTION_SCHEMAS: Record<Section, ReturnType<typeof obj>> = {
  // Identity fields intentionally absent: see CopyResult.brand above.
  brand: obj({ tagline: str }, ['tagline']),
  announcement: obj({ text: str }, ['text']),
  trust: obj({ label: str, logos: arr(str) }, []),
  hero: obj(
    {
      eyebrow: str, headline: str, headlineEmphasis: str, sub: str, cta: str, secondaryCta: str,
      formLabel: str, trust: str, badge: str, frictionReducers: arr(str),
      heroBullets: arr(obj({ value: str, label: str }, ['value', 'label'])),
    },
    ['eyebrow', 'headline', 'sub', 'cta'],
  ),
  about: obj(
    {
      eyebrow: str, title: str, body: str, story: arr(str),
      pillars: arr(obj({ t: str, d: str }, ['t', 'd'])),
      // stats intentionally absent — see the CopyResult.about comment above (PLAN D4).
    },
    ['eyebrow', 'title', 'body', 'pillars'],
  ),
  services: obj(
    { eyebrow: str, title: str, sub: str, items: arr(obj({ t: str, d: str, tag: str, detail: str }, ['t', 'd', 'tag'])) },
    ['eyebrow', 'title', 'sub', 'items'],
  ),
  work: obj(
    {
      eyebrow: str, title: str, sub: str,
      projects: arr(obj({ t: str, loc: str, yr: str, scope: str, size: str, caption: str }, ['t', 'loc', 'yr', 'scope', 'size', 'caption'])),
    },
    ['eyebrow', 'title', 'sub'],
  ),
  // Heading only; items intentionally absent (see CopyResult.testimonials above).
  testimonials: obj({ eyebrow: str, title: str }, ['eyebrow', 'title']),
  faq: obj(
    { eyebrow: str, title: str, sub: str, items: arr(obj({ q: str, a: str }, ['q', 'a'])) },
    ['eyebrow', 'title', 'sub', 'items'],
  ),
  finalCta: obj(
    { eyebrow: str, headline: str, headlineEmphasis: str, sub: str, cta: str, secondary: str, frictionReducers: arr(str) },
    ['eyebrow', 'headline', 'sub', 'cta'],
  ),
  footer: obj({ blurb: str }, []),
  seo: obj({ title: str, description: str }, ['title', 'description']),
  subpages: obj(
    {
      items: arr(obj(
        { route: str, eyebrow: str, title: str, sub: str, ctaLabel: str, ctaHref: str, seoTitle: str, seoDescription: str },
        ['route', 'eyebrow', 'title', 'sub', 'seoTitle', 'seoDescription'],
      )),
    },
    ['items'],
  ),
  servicePages: obj(
    {
      items: arr(obj(
        { slug: str, intro: str, expect: arr(str), faq: arr(obj({ q: str, a: str }, ['q', 'a'])) },
        ['slug', 'intro', 'expect', 'faq'],
      )),
    },
    ['items'],
  ),
};

/**
 * Build an output schema containing only the requested sections. `brand` is included by
 * default (whole-site generation); pass `includeBrand=false` when chunking so `brand` is
 * treated as an ordinary chunk member rather than duplicated into every chunk's schema.
 */
export function buildCopySchema(sections: Section[], includeBrand = true) {
  const want = new Set<Section>(includeBrand ? ['brand', ...sections] : sections);
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const s of ALL_SECTIONS) {
    if (want.has(s)) {
      properties[s] = SECTION_SCHEMAS[s];
      required.push(s);
    }
  }
  return obj(properties, required);
}

export const COPY_SCHEMA = buildCopySchema(ALL_SECTIONS);
