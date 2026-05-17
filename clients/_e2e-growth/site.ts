// E2E fixture: GROWTH tier.
// onboard.js should run all 9 steps: GitHub repo, Retell agent, Twilio number,
// Airtable base (1), Vercel env sync.

export const INTAKE = {
  plan: "growth",
  siteCount: 1,
  sites: [
    {
      brand: {
        name: "E2E Growth Co",
        short: "e2e-growth",
        long: "E2E Growth Co LLC",
        established: "2024",
        tagline: "Testing the Growth tier.",
        phone: "(907) 555-0202",
        phoneHref: "tel:+19075550202",
        email: "owner+e2egrowth@juneaudigitaldesigns.com",
        address: "200 Test Ave, Juneau, AK 99801",
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
          { n: "01", t: "HVAC Install", d: "Install HVAC systems.", tag: "Heating" },
          { n: "02", t: "Plumbing Repair", d: "Fix leaks and pipes.", tag: "Plumbing" },
          { n: "03", t: "Emergency Repair", d: "24/7 emergency service.", tag: "Emergency" },
          { n: "04", t: "Maintenance Plans", d: "Yearly tune-ups.", tag: "Maintenance" },
        ],
      },
      faq: {
        items: [
          { q: "Do you offer free estimates?", a: "Yes, all estimates are free." },
          { q: "Are you licensed?", a: "Yes, fully licensed and insured." },
          { q: "What areas do you serve?", a: "Juneau and surrounding communities." },
        ],
      },
      testimonials: {
        items: [
          { q: "Great service!", a: "Mike R.", r: "Homeowner", company: null, stars: 5 },
          { q: "Very professional.", a: "Sarah T.", r: "Property Manager", company: null, stars: 5 },
        ],
      },
      seo: {
        title: "E2E Growth Co",
        description: "Growth tier fixture.",
        canonical: "https://example.com",
      },
      _meta: {
        schema_version: "2.1",
        generated_at: "2026-05-13T00:00:00Z",
        variation: "D",
        is_placeholder: true,
        missing_fields: [],
        selectedPlan: "growth",
      },
    },
  ],
};
