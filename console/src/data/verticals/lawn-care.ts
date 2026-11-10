import type { SiteContent } from '@/data/site';

export const CONTENT: SiteContent = {
  brand: {
    name:        "Your Lawn Care Co.",
    short:       "Your Lawn Co.",
    long:        "Your Lawn Care Company LLC",
    established: null,
    tagline:     "A lawn you'll love, all season long.",
    phone:       "(555) 555-0100",
    phoneHref:   "tel:+15555550100",
    email:       "owner@yourlawncare.com",
    address:     "123 Main St, Your City, ST 00000",
    license:     null,

    // Decision 9: warm unbleached ground, warm charcoal ink, shared across every vertical.
    // Measured 2026-10-06: inkSoft on bg 7.59:1, on bgSoft 6.84:1, ink on bg 16.94:1.
    // `accent` / `accentFg` are this vertical's own and are not touched here.
    palette: {
      accent:   "#2F7A33",
      // accent2 = the emphasis colour (headline emphasis, review pill, CTA eyebrow and offer ribbon
      // on dark), editable in the Studio. Sun gold, from the 2026-11-09 approved premium mockup.
      accent2:  "#E8B33A",
      accentFg: "#FFFFFF",
      bg:       "#FAF7F2",
      bgSoft:   "#F1EBE2",
      ink:      "#1A1512",
      inkSoft:  "#584E45",
      rule:     "#DFD6C9",
    },
    typography: {
      fontSans:          "var(--font-inter), system-ui, sans-serif",
      fontHeading:       "var(--font-oswald), system-ui, sans-serif",
      headingWeight:     600,
      bodyWeight:        400,
      headingTracking:   "0.005em",
      headingLineHeight: 1.0,
    },
  },

  nav: [
    { label: "About",    href: "#about" },
    { label: "Services", href: "#services" },
    { label: "Reviews",  href: "#testimonials" },
    { label: "FAQ",      href: "#faq" },
    { label: "Quote",    href: "#cta" },
  ],

  announcement: "Spring lawn treatments are booking fast, reserve your spot today!",

  trust: {
    label: "Our promise",
    logos: [], // de-clawed — certifications come from onboarding (notableClients)
  },

  hero: {
    eyebrow:          "Your Neighborhood Lawn Experts",
    headline:         "A Greener Lawn Starts Here",
    headlineEmphasis: "Greener",
    sub:              "Professional mowing, fertilization, aeration, and seasonal treatments, reliable weekly service that keeps your lawn looking its best all year.",
    formLabel:        "Get a free lawn quote, no obligation.",
    placeholder:      "Your email address",
    cta:              "Get a Free Quote",
    secondaryCta:     "Call (555) 555-0100",
    trust:            "Locally owned and operated with eco-friendly products and a 100% satisfaction guarantee.",
    // De-clawed: badge, friction reducers and hero stats are unverified claims — client-supplied at onboarding.
    badge:            null,
    frictionReducers: [],
    heroBullets:      [],
  },

  about: {
    eyebrow: "Who We Are",
    title:   "Locally Grown Lawn Care",
    body:    "We're a locally owned lawn care company that takes pride in the neighborhoods we serve. We use eco-friendly products, keep a consistent weekly schedule, and treat every lawn like it's our own, because our reputation depends on yours looking great.",
    pillars: [
      { k: "shield", t: "Fully Insured",          d: "We carry full liability insurance on every job, your property is always protected." },
      { k: "clock",  t: "Reliable Scheduling",    d: "Weekly service on a consistent day. If we're delayed by weather, we notify you in advance." },
      { k: "tag",    t: "Eco-Friendly Products",   d: "We use low-impact fertilizers and pesticides that are safe for kids, pets, and pollinators." },
      { k: "star",   t: "Satisfaction Guarantee",  d: "Not happy with a visit? We'll come back and re-do the work at no charge." },
    ],
    stats: [
      { n: "200+",  l: "Lawns maintained" },
      { n: "Eco",   l: "Certified products" },
      { n: "4.9★",  l: "Customer rating" },
      { n: "100%",  l: "Satisfaction guarantee" },
    ],
  },

  services: {
    eyebrow: "What We Do",
    title:   "Full-Season Lawn Care",
    sub:     "Weekly maintenance, seasonal treatments, and everything your lawn needs to thrive.",
    items: [
      { n: "01", t: "Lawn Mowing",              d: "Regular weekly or bi-weekly mowing, edging, and blowing, on the same day, every time.", tag: "Maintenance" },
      { n: "02", t: "Fertilization",            d: "Custom fertilization programs matched to your grass type and local soil conditions.", tag: "Treatments" },
      { n: "03", t: "Core Aeration",            d: "Relieve soil compaction to improve root depth, water absorption, and fertilizer uptake.", tag: "Aeration" },
      { n: "04", t: "Leaf Removal",             d: "Fall cleanups and ongoing leaf removal to keep your lawn clean through winter.", tag: "Seasonal" },
      { n: "05", t: "Weed Control & Treatments", d: "Pre-emergent and post-emergent weed control programs that prevent re-infestation season to season.", tag: "Weed Control" },
      { n: "06", t: "Landscape Edging",         d: "Clean, precise edging along beds, walks, and driveways to give your lawn a professional finish.", tag: "Detail" },
    ],
  },

  work: {
    eyebrow: "Our Work",
    title:   "Before & After",
    sub:     "Real results from real customers in your neighborhood.",
    hidden:  true,
    projects: [],
  },

  testimonials: {
    eyebrow: "What Clients Say",
    title:   "Real Reviews from Real Customers",
    // Empty by default (operator decision, 2026-11-10): a review is a real customer's words,
    // supplied by the client, never a sample. The reviews section is hidden until there are real
    // ones. The quotes this used to carry are in lib/sampleReviews.ts, which strips them from any
    // client that still has them baked in.
    items: [],
  },

  faq: {
    eyebrow: "Common Questions",
    title:   "Frequently Asked Questions",
    sub:     "Everything you need to know before booking.",
    items: [
      { q: "How often should my lawn be mowed?", a: "During the growing season, most lawns benefit from weekly mowing. We adjust cut height and frequency based on grass type and growth rate, and we can switch to bi-weekly service during slow-growth periods." },
      { q: "Are your products safe for kids and pets?", a: "Yes. We use EPA-registered, low-toxicity products and follow labeled re-entry intervals. We'll always let you know when you can safely return to treated areas, typically 1 to 2 hours after application dries." },
      { q: "When is the best time to aerate?", a: "For cool-season grasses (fescue, bluegrass, rye): fall is ideal. For warm-season grasses (Bermuda, zoysia, St. Augustine): late spring to early summer. Aerating at the right time maximizes recovery and benefit." },
      { q: "What does a weed control program include?", a: "Our program includes a pre-emergent application in early spring to prevent crabgrass and other annuals, followed by post-emergent treatments throughout the season to knock out any weeds that do appear." },
      { q: "Can you over-seed a thin or patchy lawn?", a: "Absolutely. We pair aeration with over-seeding for the best germination results. Fall is the ideal time for cool-season grasses. We select seed varieties appropriate for your specific sun/shade conditions." },
    ],
  },

  finalCta: {
    eyebrow:          "Ready for a Better Lawn?",
    headline:         "Ready for a Greener Lawn? Let's Talk.",
    headlineEmphasis: null,
    sub:      "Get a free, no-pressure quote for weekly service, seasonal treatments, or a one-time spring clean-up.",
    cta:      "Get a Free Quote",
    secondary: "Call (555) 555-0100",
    frictionReducers: [], // de-clawed — client-supplied at onboarding
  },

  footer: {
    blurb: "Locally owned lawn care company offering mowing, fertilization, aeration, weed control, and seasonal services.",
    cols: [
      { h: "Services", links: [
        { label: "Lawn Mowing",     href: "#services" },
        { label: "Fertilization",   href: "#services" },
        { label: "Core Aeration",   href: "#services" },
        { label: "Weed Control",    href: "#services" },
      ]},
      { h: "Company", links: [
        { label: "About Us",  href: "#about" },
        { label: "Reviews",   href: "#testimonials" },
        { label: "FAQ",       href: "#faq" },
        { label: "Contact",   href: "#cta" },
      ]},
    ],
    social: [],
    legalLinks: [
      { label: "Privacy Policy",   href: "#" },
      { label: "Terms of Service", href: "#" },
    ],
    legal: "© 2026 Your Lawn Care Company LLC. All rights reserved.",
  },

  seo: {
    title:             "Your Lawn Care Company | Lawn Mowing & Treatments",
    description:       "Locally owned lawn care company offering mowing, fertilization, aeration, weed control, and seasonal lawn treatments.",
    canonical:         "https://yourlawncare.com",
    googleAnalyticsId: null,
    facebookPixelId:   null,
  },

  extensions: {
    trustBadges: null, // de-clawed — certifications come from onboarding
    reviewBadge: null,
    contactDetails: {
      address: "123 Main St, Your City, ST 00000",
      mapsUrl: null,
    },
    hours:      null,
    bookingUrl: null,
    portalUrl:  null,
  },

  images: {
    hero: {
      portrait: "https://picsum.photos/seed/lawn-hero/1600/900",
      slides: [
        { url: "https://picsum.photos/seed/lawn-hero-1/1600/900", alt: "Lawn care crew at work" },
        { url: "https://picsum.photos/seed/lawn-hero-2/1600/900", alt: "Freshly mowed lawn" },
      ],
    },
    about:        { feature: "https://picsum.photos/seed/lawn-about/900/600" },
    testimonials: {},
    footer:       {},
  },

  _meta: {
    schema_version: "2.1",
    generated_at:   "2026-06-11T00:00:00Z",
    variation:      "D",
    is_placeholder: true,
    missing_fields: ["brand.name", "brand.phone", "brand.email", "brand.address", "seo.canonical"],
    selectedPlan: "growth",
  },
};
