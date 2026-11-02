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
    palette: {
      accent:   "#E05C2A",
      accentFg: "#FFFFFF",
      bg:       "#FFFFFF",
      bgSoft:   "#FFF6F2",
      ink:      "#1C1009",
      inkSoft:  "#6B5344",
      rule:     "#E8D5C8",
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
    { label: "Book",     href: "#cta" },
  ],

  announcement: "24/7 emergency HVAC service — call us any time, day or night!",

  trust: {
    label: "Certified by",
    logos: [
      "NATE Certified",
      "EPA 608 Certified",
      "Energy Star Partner",
      "BBB Accredited",
      "Licensed & Insured",
    ],
  },

  hero: {
    eyebrow:          "Your City's Trusted HVAC Experts",
    headline:         "Heating & Cooling You Can Count On",
    headlineEmphasis: "Count On",
    sub:              "Fast, reliable HVAC service — from emergency repairs to full system replacements. Licensed technicians, upfront pricing.",
    formLabel:        "Get a free estimate — we respond same day.",
    placeholder:      "Your email address",
    cta:              "Book a Free Estimate",
    secondaryCta:     "Call (555) 555-0100",
    trust:            "NATE-certified technicians with same-day diagnostics and a price-lock guarantee.",
    badge:            "24/7 Emergency Service",
    frictionReducers: [
      "No hidden fees",
      "Same-day availability",
      "Licensed & insured",
      "Price-lock guarantee",
    ],
    heroBullets: [
      { value: "24/7",  label: "Emergency line" },
      { value: "1 hr",  label: "Response time" },
      { value: "4.9",   label: "Average rating" },
      { value: "100%",  label: "Satisfaction" },
    ],
  },

  about: {
    eyebrow: "Who We Are",
    title:   "Local HVAC Experts You Can Trust",
    body:    "We keep homes and businesses comfortable year-round. From emergency furnace repairs on the coldest night of the year to full AC installations before summer, our NATE-certified technicians show up fast and fix it right the first time.",
    pillars: [
      { k: "shield", t: "Licensed & Insured",  d: "Every technician is fully licensed, bonded, and covered so you have zero liability." },
      { k: "clock",  t: "Same-Day Service",     d: "We keep trucks staged locally to respond within hours — not days." },
      { k: "tag",    t: "Upfront Pricing",      d: "We quote before we work. No invoice surprises — ever." },
      { k: "star",   t: "NATE Certified",       d: "All technicians hold current NATE certification, the gold standard in HVAC." },
    ],
    stats: [
      { n: "24/7",  l: "Emergency support" },
      { n: "1 hr",  l: "Avg. response time" },
      { n: "4.9★",  l: "Customer rating" },
      { n: "100%",  l: "Satisfaction guarantee" },
    ],
  },

  services: {
    eyebrow: "What We Do",
    title:   "Full-Service Heating & Cooling",
    sub:     "From annual tune-ups to emergency replacements, we handle every HVAC need under one roof.",
    items: [
      { n: "01", t: "Furnace Repair & Replacement", d: "Fast diagnosis and repair of all furnace makes and models. Emergency same-day service available.", tag: "Heating" },
      { n: "02", t: "AC Installation & Service",    d: "Central air, mini-splits, and heat pumps — sized right for your home and budget.", tag: "Cooling" },
      { n: "03", t: "Maintenance Plans",             d: "Annual tune-up programs that keep your system running efficiently and your warranty valid.", tag: "Maintenance" },
      { n: "04", t: "Duct Cleaning & Sealing",       d: "Improve air quality and reduce energy waste with professional duct cleaning and sealing.", tag: "Air Quality" },
      { n: "05", t: "Heat Pump Installation",        d: "Energy-efficient heating and cooling in one system. We install all major brands.", tag: "Heat Pump" },
      { n: "06", t: "24/7 Emergency Service",        d: "HVAC emergencies don't wait for business hours. Neither do we — call anytime.", tag: "Emergency" },
    ],
  },

  work: {
    eyebrow: "Our Work",
    title:   "Recent Projects",
    sub:     "A sample of installations and repairs we're proud to put our name on.",
    hidden:  true,
    projects: [],
  },

  testimonials: {
    eyebrow: "What Clients Say",
    title:   "Real Reviews from Real Customers",
    items: [
      { q: "Called at 11pm on a Friday when our furnace died. They had a tech at our door within an hour and fixed it that night. Incredible service.", a: "Michael R.", r: "Homeowner", company: null, stars: 5 },
      { q: "Have used them for three years now. Always on time, always honest. When our AC needed a part they sourced it same-day.", a: "Sandra T.", r: "Homeowner", company: null, stars: 5 },
      { q: "Quoted us $800 less than two other companies for a new heat pump. Installation was clean and the system has been perfect.", a: "James O.", r: "Homeowner", company: null, stars: 5 },
    ],
  },

  faq: {
    eyebrow: "Common Questions",
    title:   "Frequently Asked Questions",
    sub:     "Everything you need to know before booking.",
    items: [
      { q: "How often should I service my HVAC system?", a: "We recommend a tune-up twice a year — once before heating season and once before cooling season. Regular maintenance extends equipment life and keeps your warranty valid." },
      { q: "What's the difference between R-410A and R-32 refrigerant?", a: "R-32 is the newer, more eco-friendly refrigerant with a lower global warming potential. New systems use R-32; if you have an older R-410A system we'll walk you through your options." },
      { q: "When should I repair vs. replace my system?", a: "If the repair cost exceeds 50% of a new system's cost, or your equipment is over 15 years old, replacement usually makes more financial sense. We'll give you an honest recommendation either way." },
      { q: "How can I improve my home's energy efficiency?", a: "Regular filter changes (every 1–3 months), sealing duct leaks, adding a programmable thermostat, and annual tune-ups are the highest-impact steps. We offer a free energy audit with any service call." },
      { q: "Do you offer maintenance plans?", a: "Yes — our plan covers two tune-ups per year, priority scheduling, discounts on parts and labor, and a no-breakdown guarantee for covered components." },
    ],
  },

  finalCta: {
    eyebrow:  "Ready to Get Comfortable?",
    headline: "HVAC Emergency? We're Available 24/7.",
    sub:      "Whether it's a breakdown at 2am or you're planning a new system, we're here to help. Get a free estimate with no obligation.",
    cta:      "Book a Free Estimate",
    secondary: "Call (555) 555-0100",
    frictionReducers: ["Free estimates", "Same-day availability", "No hidden fees"],
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
    canonical:         "https://yourhvaccompany.com",
    googleAnalyticsId: null,
    facebookPixelId:   null,
  },

  extensions: {
    trustBadges: [
      "NATE Certified Technicians",
      "EPA 608 Certified",
      "Energy Star Partner",
      "BBB Accredited",
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
