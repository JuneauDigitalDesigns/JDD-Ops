export interface CopyResult {
  brand: {
    tagline: string;
    // Facts — only ever populated when grounded in website notes or operator details.
    name?: string;
    short?: string;
    long?: string;
    established?: string;
    phone?: string;
    email?: string;
    address?: string;
    license?: string;
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
    pillars: { t: string; d: string }[];
    stats?: { n: string; l: string }[];
  };
  services: { eyebrow: string; title: string; sub: string; items: { t: string; d: string; tag: string }[] };
  work: {
    eyebrow: string;
    title: string;
    sub: string;
    projects?: { t: string; loc: string; yr: string; scope: string; size: string; caption: string }[];
  };
  testimonials: {
    eyebrow: string;
    title: string;
    items: { q: string; a: string; r: string; company?: string; stars?: number }[];
  };
  faq: { eyebrow: string; title: string; sub: string; items: { q: string; a: string }[] };
  finalCta: { eyebrow: string; headline: string; sub: string; cta: string; secondary?: string; frictionReducers?: string[] };
  footer: { blurb?: string };
  seo: { title: string; description: string };
}

export type Section = keyof CopyResult;

export const ALL_SECTIONS: Section[] = [
  'brand', 'announcement', 'trust', 'hero', 'about', 'services',
  'work', 'testimonials', 'faq', 'finalCta', 'footer', 'seo',
];

const str = { type: 'string' } as const;
const num = { type: 'number' } as const;
const obj = (properties: Record<string, unknown>, required: string[]) =>
  ({ type: 'object', additionalProperties: false, properties, required });
const arr = (items: unknown) => ({ type: 'array', items });

const SECTION_SCHEMAS: Record<Section, ReturnType<typeof obj>> = {
  brand: obj(
    { tagline: str, name: str, short: str, long: str, established: str, phone: str, email: str, address: str, license: str },
    ['tagline'],
  ),
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
      eyebrow: str, title: str, body: str,
      pillars: arr(obj({ t: str, d: str }, ['t', 'd'])),
      stats: arr(obj({ n: str, l: str }, ['n', 'l'])),
    },
    ['eyebrow', 'title', 'body', 'pillars'],
  ),
  services: obj(
    { eyebrow: str, title: str, sub: str, items: arr(obj({ t: str, d: str, tag: str }, ['t', 'd', 'tag'])) },
    ['eyebrow', 'title', 'sub', 'items'],
  ),
  work: obj(
    {
      eyebrow: str, title: str, sub: str,
      projects: arr(obj({ t: str, loc: str, yr: str, scope: str, size: str, caption: str }, ['t', 'loc', 'yr', 'scope', 'size', 'caption'])),
    },
    ['eyebrow', 'title', 'sub'],
  ),
  testimonials: obj(
    { eyebrow: str, title: str, items: arr(obj({ q: str, a: str, r: str, company: str, stars: num }, ['q', 'a', 'r'])) },
    ['eyebrow', 'title', 'items'],
  ),
  faq: obj(
    { eyebrow: str, title: str, sub: str, items: arr(obj({ q: str, a: str }, ['q', 'a'])) },
    ['eyebrow', 'title', 'sub', 'items'],
  ),
  finalCta: obj(
    { eyebrow: str, headline: str, sub: str, cta: str, secondary: str, frictionReducers: arr(str) },
    ['eyebrow', 'headline', 'sub', 'cta'],
  ),
  footer: obj({ blurb: str }, []),
  seo: obj({ title: str, description: str }, ['title', 'description']),
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
