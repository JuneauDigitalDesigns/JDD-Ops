import type { SiteContent } from '@/data/site';

export const CONTENT: SiteContent = {
  brand: {
    name:        "Your HVAC Co.",
    short:       "Your HVAC Co.",
    long:        "Your HVAC Company LLC",
    established: null,
    tagline:     "Comfort in every season.",
    phone:       "(555) 555-0100",
    phoneHref:   "tel:+15555550100",
    email:       "owner@yourhvaccompany.com",
    address:     "123 Main St, Your City, ST 00000",
    license:     null,

    // Decision 9: warm unbleached ground, warm charcoal ink, shared across every vertical.
    // Measured 2026-10-06: inkSoft on bg 7.59:1, on bgSoft 6.84:1, ink on bg 16.94:1.
    // `accent` / `accentFg` are this vertical's own and are not touched here.
    // Mockup-faithful palette for the HVAC vertical template (design/multipage-v1 — "Summit
    // Comfort"): warm-orange accent, cool navy structural accent, warm paper soft band, and
    // the mockup's deep ink/ink-soft. The bespoke Hvac* components read these as brand tokens,
    // so the template themes per client while matching the mockup by default.
    // Northstar "Premium Home Mockups" palette, verbatim: deep navy structure + warm action
    // accent + steel-blue bars. accent2 carries the steel-3 structural tone the bespoke
    // components use for the accent-bar gradient and icon tiles. This palette is navy, not warm,
    // and uses pure white bg — so it is exempt from palette-contrast.test.mjs's warmth/AA
    // heuristics (mockup-pinned; see that test). Mirrored to the T from the mockup :root.
    palette: {
      accent:   "#E0602C",
      accent2:  "#1E3A5F",
      accentFg: "#FFFFFF",
      bg:       "#FFFFFF",
      bgSoft:   "#F4F6F8",
      ink:      "#13293F",
      inkSoft:  "#4C5E74",
      rule:     "#E2E8F0",
    },
    // Mockup type pairing: Oswald (condensed display) + Inter (body), both loaded by the
    // template's fonts.loader.ts and the console font loader.
    typography: {
      fontSans:          "var(--font-inter), system-ui, sans-serif",
      fontHeading:       "var(--font-oswald), system-ui, sans-serif",
      headingWeight:     600,
      bodyWeight:        400,
      headingTracking:   "-0.01em",
      headingLineHeight: 1.04,
    },
  },

  nav: [
    { label: "About",    href: "#about" },
    { label: "Services", href: "#services" },
    { label: "Reviews",  href: "#testimonials" },
    { label: "FAQ",      href: "#faq" },
    { label: "Book",     href: "#cta" },
  ],

  announcement: "24/7 emergency HVAC service, call us any time, day or night!",

  trust: {
    // De-clawed: logos are client CLAIMS and must come from the client (onboarding
    // notableClients + brandsCarried → trust.logos). An empty list omits the band honestly.
    // Relabelled for HVAC (decision 29): the brands a shop installs are its strongest trust row.
    label: "Brands we install",
    logos: [],
  },

  hero: {
    eyebrow:          "Licensed & insured · 24/7 emergency service",
    headline:         "AC out? We can be there today.",
    headlineEmphasis: "today.",
    sub:              "Same-day repairs, honest flat-rate quotes, and technicians who show up on time. Keeping your city's homes comfortable since 2009.",
    formLabel:        "Tell us what is going on and we will call you right back.",
    placeholder:      "Your email address",
    cta:              "Book a visit",
    secondaryCta:     "Call (555) 555-0100",
    trust:            "NATE-certified technicians with same-day diagnostics and a price-lock guarantee.",
    // The hero overlay's 2-col ✓ reducer grid (HvacHero reads frictionReducers). Four, matching
    // the Northstar Standard hero. The badge stays null until the client supplies a verified one.
    badge:            null,
    frictionReducers: ["Same-day service", "Upfront flat-rate pricing", "Licensed & insured", "Veteran-owned & local"],
    heroBullets:      [],
  },

  about: {
    eyebrow: "About us",
    title:   "Family-owned comfort specialists you can actually reach.",
    body:    "We do HVAC the honest way: clear pricing, no upsells, and a real person on the phone. Every technician is background-checked, NATE-certified, and trained to leave your home cleaner than they found it.",
    pillars: [
      { k: "tag",   t: "Upfront flat-rate pricing", d: "You approve the price before we start. No surprises on the invoice." },
      { k: "seal",  t: "Certified technicians",     d: "NATE-certified, background-checked, and never subcontracted out." },
      { k: "clock", t: "Fast response",             d: "Same-day appointments and true 24/7 emergency coverage." },
    ],
    // The Standard stat band (HvacStatBand) renders these as four tiles under the hero.
    stats: [
      { n: "24/7",  l: "Emergency service, real humans" },
      { n: "18+",   l: "Years serving your area" },
      { n: "4.9★",  l: "From 180+ verified reviews" },
      { n: "12",    l: "Towns in our coverage area" },
    ],
  },

  services: {
    eyebrow: "What we do",
    title:   "Complete heating and cooling, done right.",
    sub:     "From a noisy 2 a.m. breakdown to a planned system upgrade, one local team handles it all.",
    items: [
      { n: "01", t: "Furnace Repair & Replacement", d: "Fast diagnosis and repair of all furnace makes and models. Emergency same-day service available.", tag: "Heating" },
      { n: "02", t: "AC Installation & Service",    d: "Central air, mini-splits, and heat pumps, sized right for your home and budget.", tag: "Cooling" },
      { n: "03", t: "Maintenance Plans",             d: "Annual tune-up programs that keep your system running efficiently and your warranty valid.", tag: "Maintenance" },
      { n: "04", t: "Duct Cleaning & Sealing",       d: "Improve air quality and reduce energy waste with professional duct cleaning and sealing.", tag: "Air Quality" },
      { n: "05", t: "Heat Pump Installation",        d: "Energy-efficient heating and cooling in one system. We install all major brands.", tag: "Heat Pump" },
      { n: "06", t: "24/7 Emergency Service",        d: "HVAC emergencies don't wait for business hours. Neither do we, call anytime.", tag: "Emergency" },
    ],
  },

  work: {
    eyebrow: "Recent work",
    title:   "Jobs we finished this month.",
    sub:     "Real installs and repairs across the towns we serve.",
    hidden:  false,
    // Template sample jobs (replaced at onboarding with the client's own).
    projects: [
      { t: "Full system replacement",   loc: "Clermont, FL",     yr: "2026", scope: "3-ton high-efficiency heat pump, one day turnaround.", size: "", caption: "Photo: install",     image: null },
      { t: "Ductless mini-split install", loc: "Winter Garden, FL", yr: "2026", scope: "Two-zone system for a converted garage suite.",       size: "", caption: "Photo: mini-split", image: null },
      { t: "Emergency AC repair",         loc: "Groveland, FL",     yr: "2026", scope: "Same-night compressor fix, family cooling again by 9 p.m.", size: "", caption: "Photo: repair",      image: null },
    ],
  },

  testimonials: {
    eyebrow: "Reviews",
    title:   "What our customers say.",
    // Empty by default — the HvacReviews component returns null on an empty list, so the
    // section is hidden until real reviews are supplied from intake or a website scan.
    // Copy generation is instructed not to invent reviews when this is empty.
    items: [],
  },

  faq: {
    eyebrow: "Common Questions",
    title:   "Frequently Asked Questions",
    sub:     "Everything you need to know before booking.",
    items: [
      { q: "How often should I service my HVAC system?", a: "We recommend a tune-up twice a year, once before heating season and once before cooling season. Regular maintenance extends equipment life and keeps your warranty valid." },
      { q: "What's the difference between R-410A and R-32 refrigerant?", a: "R-32 is the newer, more eco-friendly refrigerant with a lower global warming potential. New systems use R-32; if you have an older R-410A system we'll walk you through your options." },
      { q: "When should I repair vs. replace my system?", a: "If the repair cost exceeds 50% of a new system's cost, or your equipment is over 15 years old, replacement usually makes more financial sense. We'll give you an honest recommendation either way." },
      { q: "How can I improve my home's energy efficiency?", a: "Regular filter changes (every 1 to 3 months), sealing duct leaks, adding a programmable thermostat, and annual tune-ups are the highest-impact steps. We offer a free energy audit with any service call." },
      { q: "Do you offer maintenance plans?", a: "Yes, our plan covers two tune-ups per year, priority scheduling, discounts on parts and labor, and a no-breakdown guarantee for covered components." },
    ],
  },

  finalCta: {
    eyebrow:          "Get started",
    headline:         "Comfort restored the same day you call.",
    headlineEmphasis: "the same day you call.",
    sub:              "Book online or call now, a real person answers and we will get a technician scheduled, often the same day.",
    cta:              "Book a free estimate",
    secondary:        "Call (555) 555-0100",
    frictionReducers: ["Same-day service available", "Upfront flat-rate quotes", "Licensed & insured"],
  },

  footer: {
    blurb: "Licensed HVAC contractor providing heating, cooling, and air quality services. Emergency service available 24/7.",
    cols: [
      { h: "Services", links: [
        { label: "Furnace Repair",     href: "#services" },
        { label: "AC Installation",    href: "#services" },
        { label: "Maintenance Plans",  href: "#services" },
        { label: "Emergency Service",  href: "#services" },
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
    legal: "© 2026 Your HVAC Company LLC. All rights reserved.",
  },

  seo: {
    title:             "Your HVAC Company | Heating & Cooling Service",
    description:       "Licensed HVAC contractor offering furnace repair, AC installation, maintenance plans, and 24/7 emergency service.",
    canonical:         "", // never a sample: lib/placeholderCanonical.ts
    googleAnalyticsId: null,
    facebookPixelId:   null,
  },

  extensions: {
    // The dark trust band (HvacTrustBar) and the hero rating (HvacHero) read these. Seeded with
    // the mockup's claims as template sample content; onboarding replaces them with the client's.
    trustBadges: ["Licensed & insured · CAC1234567", "24/7 emergency service", "Financing available", "Satisfaction guaranteed"],
    reviewBadge: { rating: 4.9, count: 340, url: "" },
    contactDetails: {
      address: "123 Main St, Your City, ST 00000",
      mapsUrl: null,
    },
    hours:      null,
    bookingUrl: null,
    portalUrl:  null,
    // Towns served. Real onboarding fills this from the intake form — brand-intake splits
    // the operator's free-text list into an array — but no seed or preset ever set it, so
    // `areaServed` in the JSON-LD has been an empty array on every site shipped to date.
    // The preset carries an example so both that and <ServiceArea> have something real.
    // The Standard "Where we work" chips (HvacServiceArea). Real onboarding replaces these.
    serviceArea: [
      'Orlando',
      'Winter Park',
      'Kissimmee',
      'Apopka',
      'Sanford',
      'Oviedo',
      'Lake Mary',
      'Altamonte Springs',
      'Clermont',
      'Longwood',
      'Maitland',
      'Casselberry',
    ],
    // decision 29 (Phase 13): the specificity fields. Collected from intake, NEVER seeded with a
    // sample value - a blank is flagged in _meta.missing_fields, not invented.
    ownerName: null,
    brandsCarried: null,
    responseTime: null,
  },

  images: {
    hero: {
      portrait: "https://picsum.photos/seed/hvac-hero/1600/900",
      slides: [
        { url: "https://picsum.photos/seed/hvac-hero-1/1600/900", alt: "HVAC technician on the job" },
        { url: "https://picsum.photos/seed/hvac-hero-2/1600/900", alt: "AC installation in progress" },
      ],
    },
    about:        { feature: "https://picsum.photos/seed/hvac-about/900/600" },
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
