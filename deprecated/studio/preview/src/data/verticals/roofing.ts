import type { SiteContent } from '@/data/site';

export const CONTENT: SiteContent = {
  brand: {
    name:        "Your Roofing Co.",
    short:       "Your Roofing Co.",
    long:        "Your Roofing Company LLC",
    established: null,
    tagline:     "Protecting what matters most.",
    phone:       "(555) 555-0100",
    phoneHref:   "tel:+15555550100",
    email:       "owner@yourroofingcompany.com",
    address:     "123 Main St, Your City, ST 00000",
    license:     null,
    palette: {
      accent:   "#475569",
      accentFg: "#FFFFFF",
      bg:       "#FFFFFF",
      bgSoft:   "#F6F7F9",
      ink:      "#0F1923",
      inkSoft:  "#4A5568",
      rule:     "#CBD5E1",
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

  nav: [
    { label: "About",    href: "#about" },
    { label: "Services", href: "#services" },
    { label: "Reviews",  href: "#testimonials" },
    { label: "FAQ",      href: "#faq" },
    { label: "Quote",    href: "#cta" },
  ],

  announcement: "Storm damage? We offer free same-day inspections — call now.",

  trust: {
    label: "Certified by",
    logos: [
      "GAF Certified",
      "Insurance Claims Specialist",
      "30-Year Warranty",
      "Licensed & Bonded",
      "BBB Accredited",
    ],
  },

  hero: {
    eyebrow:          "Your City's Trusted Roofing Contractor",
    headline:         "Expert Roofing — Done Right",
    headlineEmphasis: "Done Right",
    sub:              "Roof replacements, storm repairs, and gutter installations — done on time, on budget, and backed by a 30-year workmanship warranty.",
    formLabel:        "Get a free roof estimate — no obligation.",
    placeholder:      "Your email address",
    cta:              "Get a Free Estimate",
    secondaryCta:     "Call (555) 555-0100",
    trust:            "GAF-certified installers with a 30-year workmanship warranty and insurance claims assistance.",
    badge:            "Free Estimate",
    frictionReducers: [
      "Free inspections",
      "Insurance claims help",
      "30-year warranty",
      "Licensed & insured",
    ],
    heroBullets: [
      { value: "500+",   label: "Roofs replaced" },
      { value: "30 yr",  label: "Workmanship warranty" },
      { value: "4.9",    label: "Average rating" },
      { value: "100%",   label: "Satisfaction" },
    ],
  },

  about: {
    eyebrow: "Who We Are",
    title:   "Roofing You Can Rely On",
    body:    "We've protected homes and businesses in this area for years. From storm damage repairs to full roof replacements, our GAF-certified crew delivers quality work, clear communication, and a warranty that actually means something.",
    pillars: [
      { k: "shield", t: "Licensed & Bonded",       d: "Fully licensed, bonded, and insured — protecting you and your property on every job." },
      { k: "clock",  t: "Fast Turnaround",          d: "Most residential re-roofs completed in one to two days with minimal disruption." },
      { k: "tag",    t: "Insurance Specialists",    d: "We work directly with insurance adjusters to simplify storm-damage claims." },
      { k: "star",   t: "30-Year Warranty",         d: "GAF-certified installation backed by a 30-year workmanship and materials warranty." },
    ],
    stats: [
      { n: "500+",  l: "Roofs replaced" },
      { n: "30 yr", l: "Warranty coverage" },
      { n: "4.9★",  l: "Customer rating" },
      { n: "100%",  l: "Satisfaction guarantee" },
    ],
  },

  services: {
    eyebrow: "What We Do",
    title:   "Complete Roofing Solutions",
    sub:     "From full replacements to emergency repairs, we handle every roofing need with the same attention to detail.",
    items: [
      { n: "01", t: "Roof Replacement",     d: "Complete tear-off and re-roof using premium GAF shingles. Most jobs completed in one to two days.", tag: "Replacement" },
      { n: "02", t: "Storm Damage Repair",  d: "Fast response to wind, hail, and water damage. We document everything for your insurance claim.", tag: "Storm Repair" },
      { n: "03", t: "Gutter Installation",  d: "Seamless gutters, guards, and downspout extensions to protect your foundation and landscaping.", tag: "Gutters" },
      { n: "04", t: "Roof Inspection",      d: "Thorough inspection with written report and photo documentation. Free for homeowners.", tag: "Inspection" },
      { n: "05", t: "Flat Roofing",         d: "TPO, EPDM, and modified bitumen systems for commercial and low-slope residential applications.", tag: "Commercial" },
      { n: "06", t: "Emergency Tarping",    d: "24/7 emergency tarping to protect your home after sudden storm damage while repairs are arranged.", tag: "Emergency" },
    ],
  },

  work: {
    eyebrow: "Our Work",
    title:   "Recent Projects",
    sub:     "A sample of roofs we've installed and repaired.",
    hidden:  true,
    projects: [],
  },

  testimonials: {
    eyebrow: "What Clients Say",
    title:   "Real Reviews from Real Customers",
    items: [
      { q: "After the hailstorm, they were on my roof the next morning for an inspection and handled the entire insurance claim. New roof looks amazing.", a: "David K.", r: "Homeowner", company: null, stars: 5 },
      { q: "Got three quotes and theirs was competitive, but they were the only ones who could start within the week. Done in a day and a half — spotless cleanup.", a: "Karen M.", r: "Homeowner", company: null, stars: 5 },
      { q: "The 30-year warranty was the deciding factor. They explained every step and checked in with us throughout the job. Highly recommended.", a: "Robert S.", r: "Homeowner", company: null, stars: 5 },
    ],
  },

  faq: {
    eyebrow: "Common Questions",
    title:   "Frequently Asked Questions",
    sub:     "Everything you need to know before booking.",
    items: [
      { q: "How long does a roof typically last?", a: "Asphalt shingles last 20–30 years depending on the product grade and climate. Premium shingles with proper ventilation can last 30–50 years. We'll tell you honestly where your roof stands during the inspection." },
      { q: "Does insurance cover roof replacement?", a: "If the damage is from a covered peril (storm, hail, wind), homeowners insurance typically covers replacement minus your deductible. We work with adjusters regularly and can help document your claim." },
      { q: "How do I know if I have storm damage?", a: "Common signs include missing or curling shingles, granule loss in gutters, dents on flashing and gutters, and interior water stains. Our free inspection will identify all damage with photo documentation." },
      { q: "What warranty do you offer?", a: "We offer a 30-year workmanship warranty on all installations plus the manufacturer's materials warranty (up to lifetime on premium shingles). Both warranties are transferable if you sell the home." },
      { q: "When is the best time to replace a roof?", a: "Spring and fall are ideal — mild temperatures allow for proper shingle adhesion. However, we install year-round and can work within most weather conditions. Summer is our busiest season; book early for the best scheduling." },
    ],
  },

  finalCta: {
    eyebrow:  "Ready to Protect Your Home?",
    headline: "Get Your Free Roof Inspection Today.",
    sub:      "No pressure, no obligation — just an honest assessment of your roof's condition and what it will take to fix it.",
    cta:      "Get a Free Estimate",
    secondary: "Call (555) 555-0100",
    frictionReducers: ["Free inspections", "Insurance claims help", "30-year warranty"],
  },

  footer: {
    blurb: "GAF-certified roofing contractor specializing in roof replacements, storm repairs, and gutter installations.",
    cols: [
      { h: "Services", links: [
        { label: "Roof Replacement",   href: "#services" },
        { label: "Storm Damage Repair", href: "#services" },
        { label: "Gutters",            href: "#services" },
        { label: "Emergency Tarping",  href: "#services" },
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
    legal: "© 2026 Your Roofing Company LLC. All rights reserved.",
  },

  seo: {
    title:             "Your Roofing Company | Roof Replacement & Repair",
    description:       "GAF-certified roofing contractor offering roof replacements, storm damage repair, gutter installation, and free inspections.",
    canonical:         "https://yourroofingcompany.com",
    googleAnalyticsId: null,
    facebookPixelId:   null,
  },

  extensions: {
    trustBadges: [
      "GAF Certified Installer",
      "Insurance Claims Specialist",
      "30-Year Workmanship Warranty",
      "Licensed & Bonded",
    ],
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
      portrait: "https://picsum.photos/seed/roofing-hero/1600/900",
      slides: [
        { url: "https://picsum.photos/seed/roofing-hero-1/1600/900", alt: "Roofing crew at work" },
        { url: "https://picsum.photos/seed/roofing-hero-2/1600/900", alt: "New roof installation" },
      ],
    },
    about:        { feature: "https://picsum.photos/seed/roofing-about/900/600" },
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
