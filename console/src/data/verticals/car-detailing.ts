import type { SiteContent } from '@/data/site';

export const CONTENT: SiteContent = {
  brand: {
    name:        "Your Detailing Co.",
    short:       "Your Detailing Co.",
    long:        "Your Detailing Company LLC",
    established: null,
    tagline:     "Showroom quality, delivered to you.",
    phone:       "(555) 555-0100",
    phoneHref:   "tel:+15555550100",
    email:       "owner@yourdetailingco.com",
    address:     "123 Main St, Your City, ST 00000",
    license:     null,
    palette: {
      accent:   "#1A1A2E",
      accentFg: "#FFFFFF",
      bg:       "#FFFFFF",
      bgSoft:   "#F5F5F8",
      ink:      "#1A1A2E",
      inkSoft:  "#4A4A5A",
      rule:     "#E2E2E8",
    },
    typography: {
      fontSans:          "-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif",
      fontHeading:       "-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif",
      headingWeight:     700,
      bodyWeight:        400,
      headingTracking:   "-0.02em",
      headingLineHeight: 1.15,
    },
  },

  nav: [
    { label: "About",    href: "#about" },
    { label: "Services", href: "#services" },
    { label: "Reviews",  href: "#testimonials" },
    { label: "FAQ",      href: "#faq" },
    { label: "Book",     href: "#cta" },
  ],

  announcement: "Ceramic coating special — book this month and save $150 on any ceramic package.",

  trust: {
    label: "Why customers choose us",
    logos: [
      "Certified Detailers",
      "5-Star Rated",
      "100% Satisfaction",
      "Insured & Bonded",
      "Mobile Service Available",
    ],
  },

  hero: {
    eyebrow:          "Professional Auto Detailing",
    headline:         "Professional Detailing, Every Time",
    headlineEmphasis: "Every Time",
    sub:              "Interior detailing, exterior paint correction, ceramic coatings, and mobile service — we restore and protect your vehicle to showroom condition.",
    formLabel:        "Book your detailing session online.",
    placeholder:      "Your email address",
    cta:              "Book Online",
    secondaryCta:     "Call (555) 555-0100",
    trust:            "Certified detailers using professional-grade products on every vehicle — cars, trucks, SUVs, and exotics.",
    badge:            "Book Online",
    frictionReducers: [
      "Online booking",
      "Mobile service available",
      "Insured & bonded",
      "100% satisfaction",
    ],
    heroBullets: [
      { value: "500+",  label: "Vehicles detailed" },
      { value: "5★",    label: "Google rating" },
      { value: "4.9",   label: "Average review" },
      { value: "100%",  label: "Satisfaction" },
    ],
  },

  about: {
    eyebrow: "Who We Are",
    title:   "Detailing Done at the Highest Level",
    body:    "We started as car enthusiasts who weren't satisfied with the quality available locally. Every vehicle we touch is treated with the same attention to detail we'd demand on our own cars — professional-grade products, proven techniques, and a passion for perfection.",
    pillars: [
      { k: "shield", t: "Certified Detailers",     d: "Our team is trained and certified in paint correction, coatings, and interior restoration." },
      { k: "clock",  t: "Mobile Service",           d: "We come to your home or office — you don't have to rearrange your day around us." },
      { k: "tag",    t: "Pro-Grade Products",       d: "We use only professional-grade chemicals and equipment. No corner-cutting, ever." },
      { k: "star",   t: "100% Satisfaction",        d: "If you're not completely happy, we'll return and re-detail the affected area for free." },
    ],
    stats: [
      { n: "500+",  l: "Vehicles detailed" },
      { n: "5★",    l: "Google rating" },
      { n: "4.9",   l: "Average review score" },
      { n: "100%",  l: "Satisfaction guarantee" },
    ],
  },

  services: {
    eyebrow: "What We Offer",
    title:   "Complete Detailing Packages",
    sub:     "From a quick refresh to a full paint correction — we have a package for every vehicle and budget.",
    items: [
      { n: "01", t: "Interior Detailing",    d: "Deep clean of all interior surfaces — vacuuming, steam cleaning, leather conditioning, and odor elimination.", tag: "Interior" },
      { n: "02", t: "Exterior Hand Wash",    d: "Two-bucket hand wash, decontamination, and finishing wax. Safer and more thorough than any automatic wash.", tag: "Exterior" },
      { n: "03", t: "Ceramic Coating",       d: "Professional-grade ceramic coating that protects your paint for 2–5 years and makes washing effortless.", tag: "Protection" },
      { n: "04", t: "Paint Correction",      d: "Single- and multi-stage machine polishing to remove swirl marks, scratches, and oxidation from the clear coat.", tag: "Correction" },
      { n: "05", t: "Engine Bay Detailing",  d: "Safe and thorough engine bay cleaning and dressing for a professional under-hood appearance.", tag: "Engine Bay" },
      { n: "06", t: "Mobile Service",        d: "We bring our full detail suite to your driveway or office. Same quality, maximum convenience.", tag: "Mobile" },
    ],
  },

  work: {
    eyebrow: "Our Work",
    title:   "Before & After",
    sub:     "Results speak louder than words.",
    hidden:  true,
    projects: [],
  },

  testimonials: {
    eyebrow: "What Clients Say",
    title:   "Real Reviews from Real Customers",
    items: [
      { q: "My car looked better after the paint correction than it did when I bought it new. These guys are artists. Worth every penny.", a: "Chris D.", r: "Car Owner", company: null, stars: 5 },
      { q: "Booked the mobile service and they came to my office. Interior was immaculate when I finished my meeting. Couldn't be easier.", a: "Amanda F.", r: "Car Owner", company: null, stars: 5 },
      { q: "The ceramic coating has made maintenance so easy — water just beads off. Six months later the car still looks freshly detailed.", a: "Marcus P.", r: "Car Owner", company: null, stars: 5 },
    ],
  },

  faq: {
    eyebrow: "Common Questions",
    title:   "Frequently Asked Questions",
    sub:     "Everything you need to know before booking.",
    items: [
      { q: "How long does a full detail take?", a: "A full interior and exterior detail typically takes 3–5 hours depending on vehicle size and condition. Paint correction and ceramic coating packages can take one to two full days. We'll give you a time estimate when you book." },
      { q: "What's the difference between mobile and shop service?", a: "Mobile service brings our full equipment to your location — same products, same quality. Shop service is better for paint correction and coatings, which require controlled lighting and a covered workspace. Both options are offered." },
      { q: "How long does ceramic coating last?", a: "Our professional-grade ceramic coatings are rated for 2–5 years depending on the product tier and how well the car is maintained. With proper washing technique and annual maintenance, top-tier coatings can last even longer." },
      { q: "How often should I have my car detailed?", a: "Interior details every 3–6 months; exterior details every 1–3 months depending on driving conditions. Regular washing between sessions extends the life of your detail significantly. Our ceramic coating clients typically do a full detail once a year." },
      { q: "Can you remove pet hair and odors from the interior?", a: "Yes — pet hair removal and odor elimination are specialties of ours. We use a combination of specialized vacuums, steam treatment, enzymatic cleaners, and ozone treatment for persistent odors. Results are typically excellent." },
    ],
  },

  finalCta: {
    eyebrow:  "Ready to Transform Your Vehicle?",
    headline: "Book Your Detailing Session Online.",
    sub:      "Select your package, choose mobile or shop service, and pick a time that works for you — all online in under two minutes.",
    cta:      "Book Online",
    secondary: "Call (555) 555-0100",
    frictionReducers: ["Online booking", "Mobile service available", "100% satisfaction"],
  },

  footer: {
    blurb: "Professional auto detailing — interior, exterior, paint correction, and ceramic coatings. Mobile service available.",
    cols: [
      { h: "Services", links: [
        { label: "Interior Detailing", href: "#services" },
        { label: "Exterior Wash",      href: "#services" },
        { label: "Ceramic Coating",    href: "#services" },
        { label: "Paint Correction",   href: "#services" },
      ]},
      { h: "Company", links: [
        { label: "About Us",  href: "#about" },
        { label: "Reviews",   href: "#testimonials" },
        { label: "FAQ",       href: "#faq" },
        { label: "Book",      href: "#cta" },
      ]},
    ],
    social: [],
    legalLinks: [
      { label: "Privacy Policy",   href: "#" },
      { label: "Terms of Service", href: "#" },
    ],
    legal: "© 2026 Your Detailing Company LLC. All rights reserved.",
  },

  seo: {
    title:             "Your Detailing Company | Professional Auto Detailing",
    description:       "Professional auto detailing — interior, exterior, paint correction, ceramic coatings, and mobile service.",
    canonical:         "https://yourdetailingco.com",
    googleAnalyticsId: null,
    facebookPixelId:   null,
  },

  extensions: {
    trustBadges: [
      "Certified Detailers",
      "5-Star Google Rating",
      "100% Satisfaction Guarantee",
      "Insured & Bonded",
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
      portrait: "https://picsum.photos/seed/detailing-hero/1600/900",
      slides: [
        { url: "https://picsum.photos/seed/detailing-hero-1/1600/900", alt: "Car detailing in progress" },
        { url: "https://picsum.photos/seed/detailing-hero-2/1600/900", alt: "Showroom-quality finish" },
      ],
    },
    about:        { feature: "https://picsum.photos/seed/detailing-about/900/600" },
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
