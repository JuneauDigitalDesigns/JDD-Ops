// ─────────────────────────────────────────────────────────────────────────────
// src/data/site.ts — the single source of truth for all site copy.
//
// CONTRACT (do not break):
//   - The CONTENT export line (the `const CONTENT` declaration below) MUST appear
//     exactly once and MUST be the last statement in this file. onboard.js (step 3)
//     finds that line and replaces everything from it onward with the client's
//     spliced JSON, keeping everything above it. Anything you want to survive
//     provisioning (the types below) must live ABOVE it. Never add code after the
//     CONTENT export, and never repeat its exact declaration text anywhere above.
//   - The schema is FIXED and identical for every client. Components consume the
//     keys they need and ignore the rest. Do NOT add per-client fields.
// ─────────────────────────────────────────────────────────────────────────────

export type Palette = {
  accent: string;
  accentFg?: string; // text drawn on accent bg; when absent, derived for contrast
  bg: string;
  bgSoft: string;
  ink: string;
  inkSoft: string;
  rule: string;
};

export type Typography = {
  fontSans: string;
  fontHeading: string;
  headingWeight: number;
  bodyWeight: number;
};

export type ElementStyle = { color?: string; fontSize?: number; fontWeight?: number };

export type Brand = {
  name: string;
  short: string;
  long: string;
  established: string | null;
  tagline: string;
  phone: string;
  phoneHref: string;
  email: string;
  address: string;
  license: string | null;
  palette: Palette;
  typography: Typography;
};

export type ServiceItem = { n: string; t: string; d: string; tag: string };
export type FaqItem = { q: string; a: string };
export type TestimonialItem = {
  q: string;
  a: string;
  r: string;
  company: string | null;
  stars: number;
};

export type Seo = { title: string; description: string; canonical: string };

export type Meta = {
  schema_version: string;
  generated_at: string;
  variation: string;
  is_placeholder: boolean;
  missing_fields: string[];
  selectedPlan: string;
  siteIndex?: number;
  siteCount?: number;
  siblingSlugs?: string[];
};

export type SiteContent = {
  brand: Brand;
  services: { items: ServiceItem[] };
  faq: { items: FaqItem[] };
  testimonials?: { items: TestimonialItem[] };
  seo: Seo;
  _meta: Meta;
  overrides?: Record<string, unknown>;
};

// The default placeholder content. Valid against SiteContent so `npm run build`
// and `npm run dev` work out of the box. onboard.js replaces this object (from the
// marker onward) with the client's real content at provision time.
export const CONTENT: SiteContent = {
  brand: {
    name: "Your Business",
    short: "yourbiz",
    long: "Your Business LLC",
    established: null,
    tagline: "A short, clear statement of what you do.",
    phone: "(907) 555-0100",
    phoneHref: "tel:+19075550100",
    email: "hello@example.com",
    address: "123 Main St, Juneau, AK 99801",
    license: null,
    palette: {
      accent: "#1E6FBF",
      bg: "#FFFFFF",
      bgSoft: "#F0F5FB",
      ink: "#0F1B2D",
      inkSoft: "#4A5568",
      rule: "#CBD5E1",
    },
    typography: {
      fontSans: "-apple-system, BlinkMacSystemFont, sans-serif",
      fontHeading: "-apple-system, BlinkMacSystemFont, sans-serif",
      headingWeight: 700,
      bodyWeight: 400,
    },
  },
  services: {
    items: [
      { n: "01", t: "Service One", d: "Describe the first service.", tag: "Category" },
      { n: "02", t: "Service Two", d: "Describe the second service.", tag: "Category" },
      { n: "03", t: "Service Three", d: "Describe the third service.", tag: "Category" },
    ],
  },
  faq: {
    items: [
      { q: "A common question?", a: "A clear, helpful answer." },
      { q: "Another question?", a: "Another clear answer." },
    ],
  },
  seo: {
    title: "Your Business",
    description: "A short, clear statement of what you do.",
    canonical: "https://example.com",
  },
  _meta: {
    schema_version: "2.1",
    generated_at: "1970-01-01T00:00:00Z",
    variation: "D",
    is_placeholder: true,
    missing_fields: [],
    selectedPlan: "starter",
  },
};
