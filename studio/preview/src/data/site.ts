/**
 * Single source of truth for all page content.
 * Schema v2.1 — aligned with Variation D (Conversion) design.
 *
 * Client: Peak Home Services LLC — Juneau, AK
 * Generated: 2026-05-10  |  Plan: growth
 */

// ─── TypeScript interfaces ────────────────────────────────────────────────────

export interface NavItem {
  label: string;
  href: string;
}

/** A labeled hyperlink used in footer columns, social links, and legal links. */
export interface FooterLink {
  label: string;
  href: string;
}

export interface Pillar {
  k: string; // icon key e.g. "shield" | "clock" | "tag" | "star", or legacy badge number "01"
  t: string; // title
  d: string; // one-sentence description
}

export interface Stat {
  n: string; // numeric value e.g. "96%"
  l: string; // label e.g. "Repeat-client rate"
}

export interface ServiceItem {
  n: string;    // "01", "02", …
  t: string;    // service name
  d: string;    // description (≤ 120 chars)
  tag: string;  // category badge
  image?: { url: string; alt: string }; // optional preview image
}

export interface Project {
  t: string;       // project title
  loc: string;     // city, state
  yr: string | null;      // year delivered
  scope: string;   // project type / category
  size: string;    // scale e.g. "240,000 sqft" or "18-unit building"
  caption: string; // image caption / placeholder label
  image?: { url: string; alt: string }; // optional card image
}

export interface Testimonial {
  q: string;        // quote text
  a: string;        // author name
  r: string;        // role
  company?: string | null; // company or location (optional, shown as secondary line)
  stars: number;    // 1–5
}

export interface FaqItem {
  q: string;
  a: string;
}

export interface FooterCol {
  h: string;           // column heading
  links: FooterLink[]; // v2.1: was string[]
}

export interface HeroContent {
  eyebrow: string;
  headline: string;
  headlineEmphasis: string | null; // substring of headline to render in accent color; null → no highlight
  sub: string;
  formLabel: string;
  placeholder: string;
  cta: string;
  secondaryCta: string;            // ghost link below form
  trust: string;
  badge: string | null;            // null → omit hero badge
  frictionReducers: string[];      // bullets under form; empty → omit
  heroBullets: Array<{ value: string; label: string }>;
}

export interface AboutContent {
  eyebrow: string;
  title: string;
  body: string;
  pillars: Pillar[];
  stats: Stat[];
}

export interface ServicesContent {
  eyebrow: string;
  title: string;
  sub: string;
  items: ServiceItem[];
}

export interface WorkContent {
  eyebrow: string;
  title: string;
  sub: string;
  projects: Project[];
  hidden: boolean; // true → hide section entirely
}

export interface TestimonialsContent {
  eyebrow: string;
  title: string;
  items: Testimonial[];
}

export interface FaqContent {
  eyebrow: string;
  title: string;
  sub: string;     // explanatory line under title
  items: FaqItem[];
}

export interface FinalCtaContent {
  eyebrow: string;
  headline: string;
  sub: string;
  cta: string;
  secondary: string | null; // null → omit "Or call…" line
  frictionReducers: string[];
}

export interface FooterContent {
  blurb: string;
  cols: FooterCol[];
  social: FooterLink[];    // v2.1: was string[]
  legalLinks: FooterLink[];
  legal: string;
}

export interface BrandPalette {
  accent:    string;
  accentFg?: string;   // text drawn on accent bg — defaults to "#ffffff"
  bg:        string;
  bgSoft:    string;
  ink:       string;
  inkSoft:   string;
  rule:      string;
}

export interface BrandTypography {
  fontSans:           string;
  fontHeading:        string;
  headingWeight:      number;
  bodyWeight:         number;
  headingTracking?:   string;
  headingLineHeight?: number;
}

export interface BrandContent {
  name:        string;
  short:       string;
  long:        string;
  established: string | null;
  tagline:     string;
  phone:       string;
  phoneHref:   string;
  email:       string;
  address:     string;
  license:     string | null;
  palette:     BrandPalette;
  typography:  BrandTypography;
}

export interface SeoContent {
  title: string;
  description: string;
  canonical: string;
  googleAnalyticsId: string | null;
  facebookPixelId: string | null;
}

export interface ExtensionsContent {
  trustBadges: string[] | null;
  reviewBadge: {
    rating: number;
    count: number;
    url: string;
  } | null;
  contactDetails: {
    address: string;
    mapsUrl: string | null;
  } | null;
  hours: Record<string, string> | null;
  bookingUrl: string | null;
  portalUrl: string | null;
}

export interface SiteImages {
  hero:         { portrait?: string; slides?: Array<{ url: string; alt: string }> };
  about:        { feature?: string };
  testimonials: { avatars?: string[] };
  footer:       { logoImage?: string };
}

export interface ContentMeta {
  schema_version: string;
  generated_at: string;
  variation: "D";
  is_placeholder: boolean;
  missing_fields: string[];
  selectedPlan: "starter" | "growth" | "enterprise";
  siteIndex?: number;       // 1-based; set for Enterprise sites only
  siteCount?: number;       // total cluster size; set for Enterprise sites only
  siblingSlugs?: string[];  // other slug names in the same Enterprise cluster
}

export interface SiteContent {
  brand:        BrandContent;
  nav:          NavItem[];
  announcement: string | null;
  trust:        { label: string; logos: string[] };
  hero:         HeroContent;
  about:        AboutContent;
  services:     ServicesContent;
  work:         WorkContent;
  testimonials: TestimonialsContent;
  faq:          FaqContent;
  finalCta:     FinalCtaContent;
  footer:       FooterContent;
  seo:          SeoContent;
  extensions:   ExtensionsContent;
  images:       SiteImages;
  _meta:        ContentMeta;
}

// ─── Backward-compat aliases (consumed by palette.ts / layout.tsx) ───────────

/** @deprecated Use BrandContent */
export type Brand = BrandContent;

// ─── Content ──────────────────────────────────────────────────────────────────

export const CONTENT: SiteContent = {

  // ── Brand ─────────────────────────────────────────────────────────────────
  brand: {
    name:        "Peak",
    short:       "Peak",
    long:        "Peak Home Services LLC",
    established: "Est. 2011",
    tagline:     "Reliable service, every season.",
    phone:       "(907) 555-0142",
    phoneHref:   "tel:+19075550142",
    email:       "owner@peakhomeservices.com",
    address:     "318 Glacier Ave, Juneau, AK 99801",
    license:     "AK-GC-2019-04817",

    palette: {
      accent:  "#1E6FBF",
      bg:      "#FFFFFF",
      bgSoft:  "#F0F5FB",
      ink:     "#0F1B2D",
      inkSoft: "#4A5568",
      rule:    "#CBD5E1",
    },

    typography: {
      fontSans:          "-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif",
      fontHeading:       "-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif",
      headingWeight:     700,
      bodyWeight:        400,
      headingTracking:   "-0.01em",
      headingLineHeight: 1.2,
    },
  },

  // ── Nav ───────────────────────────────────────────────────────────────────
  nav: [
    { label: "About",    href: "#about" },
    { label: "Services", href: "#services" },
    { label: "Work",     href: "#work" },
    { label: "Reviews",  href: "#testimonials" },
    { label: "FAQ",      href: "#faq" },
    { label: "Book",     href: "#cta" },
  ],

  // ── Announce bar ──────────────────────────────────────────────────────────
  announcement: "Now booking summer AC tune-ups — schedule before June 1 and save $40!",

  // ── Trust logos ───────────────────────────────────────────────────────────
  trust: {
    label: "Trusted by",
    logos: [
      "City of Juneau",
      "Bergmann Properties",
      "Juneau School District",
      "EPA 608 Certified",
      "NATE-Certified",
      "BBB Accredited",
      "Best of Juneau 2024",
    ],
  },

  // ── Hero ──────────────────────────────────────────────────────────────────
  hero: {
    eyebrow:          "Juneau's #1 Rated Home Services",
    headline:         "Comfort You Can Count On",
    headlineEmphasis: "Count On",
    sub:              "HVAC, plumbing, and emergency repairs — done right the first time by technicians you can trust.",
    formLabel:        "Get a free estimate — we'll reach out same day.",
    placeholder:      "Your email address",
    cta:              "Book a Free Estimate",
    secondaryCta:     "Call (907) 555-0142",
    trust:            "We're the only Juneau contractor offering same-day HVAC diagnostics with a price-lock guarantee.",
    badge:            "4.9 / 5 — 300+ reviews",
    frictionReducers: [
      "No hidden fees",
      "Same-day availability",
      "Licensed & insured",
      "Price-lock guarantee",
    ],

    heroBullets: [
      { value: "2,400+", label: "Jobs completed" },
      { value: "4.9",    label: "Average rating" },
      { value: "14 yrs", label: "In business" },
      { value: "24/7",   label: "Emergency line" },
    ],

  },

  // ── About ─────────────────────────────────────────────────────────────────
  about: {
    eyebrow: "Who We Are",
    title:   "Built on Trust, Driven by Results",
    body:    "Peak Home Services has been keeping Juneau homes comfortable since 2011. From routine maintenance to emergency callouts in the middle of winter, our team shows up fast and fixes it right. We believe in transparent pricing, honest advice, and work that lasts.",

    pillars: [
      { k: "shield", t: "Licensed & Insured",    d: "Every technician is fully licensed, bonded, and covered so you have zero liability." },
      { k: "clock",  t: "Same-Day Service",       d: "We keep trucks staged around Juneau to respond within hours — not days." },
      { k: "tag",    t: "Price-Lock Guarantee",   d: "The quote we give you is the price you pay. No invoice surprises." },
      { k: "star",   t: "4.9-Star Rated",         d: "Over 300 verified reviews across Google and Facebook from real Juneau customers." },
    ],

    stats: [
      { n: "14+",    l: "Years in business" },
      { n: "2,400+", l: "Jobs completed" },
      { n: "4.9",    l: "Average review rating" },
      { n: "24/7",   l: "Emergency support" },
    ],
  },

  // ── Services ──────────────────────────────────────────────────────────────
  services: {
    eyebrow: "What We Do",
    title:   "Full-Service Home Comfort",
    sub:     "From seasonal tune-ups to full system replacements, we handle it all under one roof.",

    items: [
      {
        n: "01",
        t: "HVAC Installation & Replacement",
        d: "We install and replace all major HVAC brands. Mini-splits, ducted systems, and heat pumps — sized right for Alaska's climate.",
        tag: "Heating & Cooling",
        image: {
          url: "https://picsum.photos/seed/peak-hvac/800/600",
          alt: "HVAC installation",
        },
      },
      {
        n: "02",
        t: "Plumbing Repair & Repiping",
        d: "From leaky faucets to whole-home repiping, our licensed plumbers handle residential and commercial jobs of any size.",
        tag: "Plumbing",
        image: {
          url: "https://picsum.photos/seed/peak-plumbing/800/600",
          alt: "Plumbing repair service",
        },
      },
      {
        n: "03",
        t: "Seasonal Maintenance Plans",
        d: "Annual tune-up programs that keep your systems efficient, your warranties valid, and your energy bills predictable year-round.",
        tag: "Maintenance",
      },
      {
        n: "04",
        t: "24/7 Emergency Repairs",
        d: "Pipes burst at 2am. Furnaces die on the coldest night of the year. Our emergency crew is always on call.",
        tag: "Emergency",
      },
    ],
  },

  // ── Work ──────────────────────────────────────────────────────────────────
  work: {
    eyebrow: "Our Work",
    title:   "Recent Projects",
    sub:     "A sample of installations and repairs we're proud to put our name on.",
    hidden:  false,

    projects: [
      {
        t:       "Bergmann Apartment Complex — Full HVAC Retrofit",
        loc:     "Downtown Juneau, AK",
        yr:      "2025",
        scope:   "Commercial retrofit",
        size:    "18-unit building",
        caption: "Replaced aging baseboard heat with a multi-zone mini-split system across all 18 units.",
        image: {
          url: "https://picsum.photos/seed/peak-work-1/800/600",
          alt: "Bergmann apartment HVAC retrofit",
        },
      },
      {
        t:       "Single-Family Plumbing Repipe",
        loc:     "Mendenhall Valley, AK",
        yr:      "2024",
        scope:   "Residential plumbing",
        size:    "2,100 sq ft",
        caption: "Full copper-to-PEX repipe completed in two days with zero drywall damage.",
        image: {
          url: "https://picsum.photos/seed/peak-work-2/800/600",
          alt: "Residential plumbing repipe project",
        },
      },
      {
        t:       "Juneau School District — Boiler Replacement",
        loc:     "Juneau, AK",
        yr:      "2024",
        scope:   "Commercial mechanical",
        size:    "3 buildings",
        caption: "Coordinated off-season boiler replacement across three district facilities with zero classroom disruption.",
        image: {
          url: "https://picsum.photos/seed/peak-work-3/800/600",
          alt: "School district boiler replacement",
        },
      },
    ],
  },

  // ── Testimonials ──────────────────────────────────────────────────────────
  testimonials: {
    eyebrow: "What Clients Say",
    title:   "Real Reviews from Real Customers",

    items: [
      {
        q:       "They showed up two hours after I called — on a Saturday — and had my furnace running before dinner. Incredibly professional and honest about pricing.",
        a:       "Mike R.",
        r:       "Homeowner",
        company: "Mendenhall Valley",
        stars:   5,
      },
      {
        q:       "We've used Peak for all three of our rental properties for five years. Never a bad experience. The price-lock guarantee is real — what they quote is what we pay.",
        a:       "Sandra T.",
        r:       "Property Manager",
        company: "Bergmann Properties",
        stars:   5,
      },
      {
        q:       "Fast, clean, and explained everything in plain English. My old contractor always made me feel like I was being upsold. Peak felt completely different.",
        a:       "James O.",
        r:       "Homeowner",
        company: "Douglas Island",
        stars:   5,
      },
    ],
  },

  // ── FAQ ───────────────────────────────────────────────────────────────────
  faq: {
    eyebrow: "Common Questions",
    title:   "Frequently Asked Questions",
    sub:     "Everything you need to know before booking.",

    items: [
      {
        q: "Do you offer free estimates?",
        a: "Yes — all diagnostic visits and project estimates are free with no obligation to book.",
      },
      {
        q: "How quickly can you respond to an emergency?",
        a: "Our emergency line operates 24/7. In most cases we can have a technician on-site within 2 hours anywhere in the Juneau area.",
      },
      {
        q: "What areas do you serve?",
        a: "We serve Juneau, Douglas, Mendenhall Valley, Auke Bay, and surrounding communities within the City and Borough of Juneau.",
      },
      {
        q: "Are your technicians licensed and insured?",
        a: "Yes. All technicians hold current Alaska contractor licenses and are covered by liability insurance and workers' compensation.",
      },
    ],
  },

  // ── Final CTA ─────────────────────────────────────────────────────────────
  finalCta: {
    eyebrow:  "Ready to Get Comfortable?",
    headline: "Book Your Free Estimate Today",
    sub:      "No pressure, no obligation — just an honest assessment of what your home needs and what it'll cost.",
    cta:      "Book a Free Estimate",
    secondary: "Call (907) 555-0142",
    frictionReducers: [
      "Free estimates",
      "Same-day availability",
      "No hidden fees",
    ],
  },

  // ── Footer ────────────────────────────────────────────────────────────────
  footer: {
    blurb: "Peak Home Services has been Juneau's go-to HVAC, plumbing, and home repair contractor since 2011. Licensed, insured, and always available when you need us most.",

    cols: [
      { h: "Services", links: [
        { label: "HVAC Installation",     href: "#services" },
        { label: "Plumbing Repair",       href: "#services" },
        { label: "Maintenance Plans",     href: "#services" },
        { label: "Emergency Repairs",     href: "#services" },
      ]},
      { h: "Company", links: [
        { label: "About Us",   href: "#about" },
        { label: "Our Work",   href: "#work" },
        { label: "Reviews",    href: "#testimonials" },
        { label: "FAQ",        href: "#faq" },
        { label: "Contact Us", href: "#cta" },
      ]},
    ],

    social: [
      { label: "Instagram", href: "https://instagram.com/peakhomeservicesjuneau" },
      { label: "Facebook",  href: "https://facebook.com/peakhomeservices" },
    ],

    legalLinks: [
      { label: "Privacy Policy",   href: "#" },
      { label: "Terms of Service", href: "#" },
      { label: "Cookie Policy",    href: "#" },
    ],

    legal: "© 2026 Peak Home Services LLC. All rights reserved.",
  },

  // ── SEO ───────────────────────────────────────────────────────────────────
  seo: {
    title:             "Peak Home Services | HVAC & Plumbing in Juneau, AK",
    description:       "Juneau's trusted HVAC, plumbing, and home services company. Same-day diagnostics, price-lock guarantee, and 24/7 emergency support.",
    canonical:         "https://peakhomeservices.com",
    googleAnalyticsId: null,
    facebookPixelId:   null,
  },

  // ── Extensions ────────────────────────────────────────────────────────────
  extensions: {
    trustBadges: [
      "EPA 608 Certified",
      "NATE-Certified Technicians",
      "BBB Accredited",
      "Best of Juneau 2023 & 2024",
    ],

    reviewBadge: null,

    contactDetails: {
      address: "318 Glacier Ave, Juneau, AK 99801",
      mapsUrl: "https://maps.google.com/?cid=123456789",
    },

    hours:      null,
    bookingUrl: "https://peakhomeservices.com/book",
    portalUrl:  null,
  },

  // ── Images ────────────────────────────────────────────────────────────────
  images: {
    hero: {
      portrait: "https://picsum.photos/seed/peak-hero-1/1600/900",
      slides: [
        {
          url: "https://picsum.photos/seed/peak-hero-1/1600/900",
          alt: "Peak Home Services team on the job",
        },
        {
          url: "https://picsum.photos/seed/peak-hero-2/1600/900",
          alt: "HVAC installation in progress",
        },
      ],
    },

    about: {
      feature: "https://picsum.photos/seed/peak-about/900/600",
    },

    testimonials: {},

    footer: {
      // logoImage intentionally absent — exercises the missing-image fallback in footer components
    },
  },

  // ── Meta ──────────────────────────────────────────────────────────────────
  _meta: {
    schema_version: "2.1",
    generated_at:   "2026-05-10T00:00:00Z",
    variation:      "D",
    is_placeholder: false,
    missing_fields: [
      "brand.typography",
      "extensions.hours",
      "footer.legalLinks",
      "images.logo",
      "seo.googleAnalyticsId",
      "seo.facebookPixelId",
    ],
    selectedPlan: "growth",
  },
};
