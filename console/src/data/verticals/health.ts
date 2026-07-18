import type { SiteContent } from '@/data/site';

export const CONTENT: SiteContent = {
  brand: {
    name:        "Your Wellness Practice",
    short:       "Your Wellness Practice",
    long:        "Your Wellness Practice LLC",
    established: null,
    tagline:     "Care that meets you where you are.",
    phone:       "(555) 555-0123",
    phoneHref:   "tel:+15555550123",
    email:       "hello@yourwellnesspractice.com",
    address:     "123 Main St, Your City, ST 00000",
    license:     null,
    palette: {
      accent:   "#0E9C8A",
      accentFg: "#FFFFFF",
      bg:       "#FFFFFF",
      bgSoft:   "#F0FAF8",
      ink:      "#12211E",
      inkSoft:  "#52655F",
      rule:     "#D2E9E3",
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

  announcement: "Now accepting new clients — book a first visit online.",

  trust: {
    label: "Trusted by the community",
    logos: [
      "Licensed Practitioners",
      "Privacy-First Care",
      "Insured & Accredited",
      "5-Star Reviewed",
      "Community Partner",
    ],
  },

  hero: {
    eyebrow:          "Your City's Whole-Person Wellness Practice",
    headline:         "Feel Supported at Every Step",
    headlineEmphasis: "Every Step",
    sub:              "Personalized wellness care for your whole life — attentive practitioners, easy scheduling, and a calm, welcoming space.",
    formLabel:        "Request a first appointment — we'll follow up promptly.",
    placeholder:      "Your email address",
    cta:              "Book a First Visit",
    secondaryCta:     "Call (555) 555-0123",
    trust:            "Licensed practitioners, flexible scheduling, and care plans built around you.",
    badge:            "New clients welcome",
    frictionReducers: [
      "No referral needed",
      "Flexible scheduling",
      "Welcoming space",
      "Care built around you",
    ],
    heroBullets: [
      { value: "Same wk", label: "Appointments" },
      { value: "1:1",     label: "Personal care" },
      { value: "4.9",     label: "Average rating" },
      { value: "100%",    label: "Confidential" },
    ],
  },

  about: {
    eyebrow: "Who We Are",
    title:   "Wellness Care Built Around You",
    body:    "We're a whole-person wellness practice focused on helping you feel your best. From your first visit, our licensed practitioners take time to understand your goals and build a supportive plan you can actually stick with.",
    pillars: [
      { k: "shield", t: "Licensed & Insured",  d: "Our practitioners are fully licensed, insured, and committed to your privacy." },
      { k: "clock",  t: "Easy Scheduling",     d: "Flexible appointment times and simple online booking that fit your life." },
      { k: "star",   t: "Compassionate Team",  d: "A calm, judgment-free space where you're heard and supported." },
      { k: "tag",    t: "Transparent Pricing", d: "Clear costs and options up front — no surprises on your bill." },
    ],
    stats: [
      { n: "Same wk", l: "Appointment availability" },
      { n: "1:1",     l: "Personalized attention" },
      { n: "4.9★",    l: "Client rating" },
      { n: "100%",    l: "Confidential & private" },
    ],
  },

  services: {
    eyebrow: "What We Offer",
    title:   "Supportive Services for Whole-Person Wellness",
    sub:     "From your first consultation to ongoing support, we offer care designed around your goals.",
    items: [
      { n: "01", t: "Initial Wellness Consultation",   d: "A relaxed first visit to understand your goals and map out a plan together.", tag: "Consultation" },
      { n: "02", t: "Personalized Care Plans",         d: "Practical, step-by-step plans built around your lifestyle and needs.", tag: "Planning" },
      { n: "03", t: "Ongoing Wellness Support",        d: "Regular check-ins to keep you on track and adjust as things change.", tag: "Support" },
      { n: "04", t: "Lifestyle & Nutrition Guidance",  d: "Everyday guidance to help you build habits that feel sustainable.", tag: "Lifestyle" },
      { n: "05", t: "Stress & Recovery Sessions",      d: "Calming, restorative sessions to help you rest and recharge.", tag: "Recovery" },
      { n: "06", t: "Virtual & In-Person Visits",      d: "Flexible appointment options so care fits your schedule.", tag: "Telehealth" },
    ],
  },

  work: {
    eyebrow: "Our Work",
    title:   "Client Stories",
    sub:     "A look at the people we're proud to support.",
    hidden:  true,
    projects: [],
  },

  testimonials: {
    eyebrow: "What Clients Say",
    title:   "Real Stories from People We Support",
    items: [
      { q: "From my first visit I felt genuinely listened to. The plan they built actually fit my life, and I've stuck with it.", a: "Maria L.", r: "Client", company: null, stars: 5 },
      { q: "Booking was simple and the whole team is so kind. I always leave feeling calmer and more supported.", a: "David K.", r: "Client", company: null, stars: 5 },
      { q: "They took the time to understand my goals instead of rushing me through. It's made a real difference in how I feel day to day.", a: "Priya S.", r: "Client", company: null, stars: 5 },
    ],
  },

  faq: {
    eyebrow: "Common Questions",
    title:   "Frequently Asked Questions",
    sub:     "Everything you need to know before your first visit.",
    items: [
      { q: "Do I need a referral to book?", a: "No referral is needed — you can request a first appointment directly through our site or by phone." },
      { q: "What happens at a first visit?", a: "We'll talk through your goals and history, answer your questions, and outline a supportive plan together. There's no pressure and no rush." },
      { q: "Do you offer virtual appointments?", a: "Yes. We offer both in-person and virtual visits so you can choose what's most convenient for you." },
      { q: "Is my information kept private?", a: "Absolutely. We follow strict privacy practices and keep your information confidential." },
      { q: "How do I schedule or reschedule?", a: "You can book, reschedule, or cancel online anytime, or give us a call and we'll help you find a time that works." },
    ],
  },

  finalCta: {
    eyebrow:   "Ready When You Are",
    headline:  "Take the First Step Toward Feeling Better",
    sub:       "Booking a first visit is simple, and there's no pressure. We're here whenever you're ready to start.",
    cta:       "Book a First Visit",
    secondary: "Call (555) 555-0123",
    frictionReducers: ["No referral needed", "Flexible scheduling", "Welcoming space"],
  },

  footer: {
    blurb: "A whole-person wellness practice offering consultations, personalized care plans, and ongoing support. New clients always welcome.",
    cols: [
      { h: "Services", links: [
        { label: "Consultations",   href: "#services" },
        { label: "Care Plans",      href: "#services" },
        { label: "Ongoing Support", href: "#services" },
        { label: "Virtual Visits",  href: "#services" },
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
    legal: "© 2026 Your Wellness Practice LLC. All rights reserved.",
  },

  seo: {
    title:             "Your Wellness Practice | Whole-Person Wellness Care",
    description:       "Whole-person wellness practice offering consultations, personalized care plans, and ongoing support. New clients welcome — book online.",
    canonical:         "https://yourwellnesspractice.com",
    googleAnalyticsId: null,
    facebookPixelId:   null,
  },

  extensions: {
    trustBadges: [
      "Licensed Practitioners",
      "Privacy-First Care",
      "Insured & Accredited",
      "Community Trusted",
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
      portrait: "https://picsum.photos/seed/health-hero/1600/900",
      slides: [
        { url: "https://picsum.photos/seed/health-hero-1/1600/900", alt: "Welcoming wellness practice reception" },
        { url: "https://picsum.photos/seed/health-hero-2/1600/900", alt: "Practitioner meeting with a client" },
      ],
    },
    about:        { feature: "https://picsum.photos/seed/health-about/900/600" },
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
