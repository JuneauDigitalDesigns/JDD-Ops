import type { SiteContent } from '@/data/site';

export const CONTENT: SiteContent = {
  brand: {
    name:        "Your Plumbing Co.",
    short:       "Your Plumbing Co.",
    long:        "Your Plumbing Company LLC",
    established: null,
    tagline:     "Fast fixes, honest prices.",
    phone:       "(555) 555-0100",
    phoneHref:   "tel:+15555550100",
    email:       "owner@yourplumbingcompany.com",
    address:     "123 Main St, Your City, ST 00000",
    license:     null,
    palette: {
      accent:   "#1E6FA8",
      accentFg: "#FFFFFF",
      bg:       "#FFFFFF",
      bgSoft:   "#F0F6FB",
      ink:      "#0A1929",
      inkSoft:  "#3D5166",
      rule:     "#C3D9EC",
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

  announcement: "Same-day plumbing service available — call now and we'll be there today.",

  trust: {
    label: "Trusted by homeowners",
    logos: [
      "Licensed & Bonded",
      "Upfront Pricing",
      "Background Checked",
      "24/7 Emergency",
      "BBB Accredited",
    ],
  },

  hero: {
    eyebrow:          "Your City's Trusted Plumbing Pros",
    headline:         "Fast, Reliable Plumbing Service",
    headlineEmphasis: "Reliable",
    sub:              "Leaks, clogs, water heaters, and emergencies — fixed right the first time by licensed plumbers who show up when they say they will.",
    formLabel:        "Book same-day service — we respond within the hour.",
    placeholder:      "Your email address",
    cta:              "Book Same-Day Service",
    secondaryCta:     "Call (555) 555-0100",
    trust:            "Licensed and background-checked plumbers with upfront pricing and a satisfaction guarantee.",
    badge:            "Same-Day Service",
    frictionReducers: [
      "Upfront pricing",
      "Same-day availability",
      "Licensed & bonded",
      "Satisfaction guarantee",
    ],
    heroBullets: [
      { value: "24/7",   label: "Emergency line" },
      { value: "Same Day", label: "Service available" },
      { value: "4.9",    label: "Average rating" },
      { value: "100%",   label: "Satisfaction" },
    ],
  },

  about: {
    eyebrow: "Who We Are",
    title:   "Licensed Plumbers You Can Count On",
    body:    "No upsells, no surprises — just fast, professional plumbing from licensed technicians who respect your home and your time. We give you the price upfront, show up when promised, and don't leave until the job is done right.",
    pillars: [
      { k: "shield", t: "Licensed & Bonded",    d: "Every plumber is licensed, bonded, and background-checked for your peace of mind." },
      { k: "clock",  t: "Same-Day Service",      d: "We keep vans stocked and ready — most calls are addressed same-day." },
      { k: "tag",    t: "Upfront Pricing",       d: "You get the full price before any work begins. No hourly surprises on the invoice." },
      { k: "star",   t: "Satisfaction Guarantee", d: "If you're not satisfied, we come back and make it right — at no additional charge." },
    ],
    stats: [
      { n: "24/7",    l: "Emergency support" },
      { n: "Same Day", l: "Service available" },
      { n: "4.9★",    l: "Customer rating" },
      { n: "100%",    l: "Satisfaction guarantee" },
    ],
  },

  services: {
    eyebrow: "What We Do",
    title:   "Full-Service Residential Plumbing",
    sub:     "From a dripping faucet to a full bathroom remodel, our licensed plumbers handle it all.",
    items: [
      { n: "01", t: "Leak Detection & Repair",  d: "Pinpoint and fix leaks in pipes, fixtures, and fittings quickly to prevent water damage.", tag: "Repairs" },
      { n: "02", t: "Drain Clearing",           d: "Clogged drains cleared with professional equipment — not just chemicals. Works the first time.", tag: "Drains" },
      { n: "03", t: "Water Heater Services",    d: "Installation, repair, and replacement of tank and tankless water heaters. Same-day service available.", tag: "Water Heater" },
      { n: "04", t: "Pipe Installation",        d: "New pipes, repiping, and fixture installation for remodels and additions of any size.", tag: "Installation" },
      { n: "05", t: "Emergency Plumbing",       d: "Burst pipes, sewer backups, and flooding — we respond 24/7 because plumbing emergencies don't wait.", tag: "Emergency" },
      { n: "06", t: "Bathroom & Kitchen Remodel", d: "Plumbing rough-in and finish work for full remodels, additions, and fixture upgrades.", tag: "Remodel" },
    ],
  },

  work: {
    eyebrow: "Our Work",
    title:   "Recent Projects",
    sub:     "A sample of plumbing jobs we're proud of.",
    hidden:  true,
    projects: [],
  },

  testimonials: {
    eyebrow: "What Clients Say",
    title:   "Real Reviews from Real Customers",
    items: [
      { q: "Had a burst pipe at 6am. They answered immediately, were at our house within 45 minutes, and had it fixed before I had to leave for work. Incredible.", a: "Thomas W.", r: "Homeowner", company: null, stars: 5 },
      { q: "Finally found plumbers who give you the price before they start. No surprise invoice, no upsells. The drain clearing took 20 minutes and has stayed clear.", a: "Patricia L.", r: "Homeowner", company: null, stars: 5 },
      { q: "Replaced our old water heater with a tankless. They explained all the options, matched the best one for our home, and the installation was neat and fast.", a: "Andrew B.", r: "Homeowner", company: null, stars: 5 },
    ],
  },

  faq: {
    eyebrow: "Common Questions",
    title:   "Frequently Asked Questions",
    sub:     "Everything you need to know before booking.",
    items: [
      { q: "Can you really come the same day?", a: "In most cases, yes. We keep vans stocked and dispatchers available during business hours. For true emergencies — burst pipes, no hot water — we're available 24/7 and treat those as priority dispatches." },
      { q: "How do you find a leak without tearing up walls?", a: "We use pressure testing, acoustic leak detection, and thermal imaging to pinpoint leaks non-invasively. In most cases, we can locate the leak precisely before opening any wall, minimizing repair work." },
      { q: "How long does a water heater last?", a: "Tank water heaters typically last 8–12 years; tankless models last 15–20 years with proper maintenance. If yours is over 10 years old or you're seeing rust or inconsistent temperatures, it may be time to replace it." },
      { q: "Do you charge extra for emergency calls?", a: "Our after-hours rate is listed on our website and communicated before we dispatch — no surprise fees. For genuine emergencies, we believe getting help fast is more important than debating pricing at 2am." },
      { q: "Should I attempt plumbing repairs myself?", a: "Minor things like replacing a toilet flapper or a supply line are manageable DIY tasks. Anything involving drain lines, water main shut-offs, or pipe connections is best left to a licensed plumber — mistakes can cause serious water damage." },
    ],
  },

  finalCta: {
    eyebrow:  "Plumbing Problem?",
    headline: "Plumbing Problem? Call Now — Same Day.",
    sub:      "We're dispatching licensed plumbers across the area today. Get the price upfront, job done right, guaranteed.",
    cta:      "Book Same-Day Service",
    secondary: "Call (555) 555-0100",
    frictionReducers: ["Upfront pricing", "Same-day availability", "Satisfaction guaranteed"],
  },

  footer: {
    blurb: "Licensed plumbing contractor serving residential and commercial customers. Same-day service and 24/7 emergency response.",
    cols: [
      { h: "Services", links: [
        { label: "Leak Repair",       href: "#services" },
        { label: "Drain Clearing",    href: "#services" },
        { label: "Water Heater",      href: "#services" },
        { label: "Emergency Plumbing", href: "#services" },
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
    legal: "© 2026 Your Plumbing Company LLC. All rights reserved.",
  },

  seo: {
    title:             "Your Plumbing Company | Same-Day Plumbing Service",
    description:       "Licensed plumbing contractor offering same-day service for leaks, drain clearing, water heaters, and 24/7 emergency plumbing.",
    canonical:         "https://yourplumbingcompany.com",
    googleAnalyticsId: null,
    facebookPixelId:   null,
  },

  extensions: {
    trustBadges: [
      "Licensed & Bonded",
      "Upfront Pricing",
      "Background-Checked Technicians",
      "Satisfaction Guarantee",
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
      portrait: "https://picsum.photos/seed/plumbing-hero/1600/900",
      slides: [
        { url: "https://picsum.photos/seed/plumbing-hero-1/1600/900", alt: "Plumber at work" },
        { url: "https://picsum.photos/seed/plumbing-hero-2/1600/900", alt: "Plumbing repair service" },
      ],
    },
    about:        { feature: "https://picsum.photos/seed/plumbing-about/900/600" },
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
