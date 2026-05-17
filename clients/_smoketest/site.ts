// Smoke-test fixture for onboard.js step 1 validation only.
// Not a real client. Do NOT run full provisioning against this slug.

export const CONTENT = {
  brand: {
    name: "Smoke Test Co",
    short: "Smoke",
    long: "Smoke Test Co LLC",
    established: null,
    tagline: "We test things.",
    phone: "(907) 555-0123",
    phoneHref: "tel:+19075550123",
    email: "owner@smoketest.example",
    address: "1 Test Lane, Juneau, AK 99801",
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
  services: { items: [{ n: "01", t: "Test service", d: "Testing.", tag: "Test" }] },
  faq: { items: [{ q: "Is this real?", a: "No — smoke test only." }] },
  seo: { title: "Smoke Test", description: "n/a", canonical: "https://example.com" },
  _meta: {
    schema_version: "2.1",
    generated_at: "2026-05-12T00:00:00Z",
    variation: "D",
    is_placeholder: true,
    missing_fields: ["work.projects", "testimonials.items"],
    selectedPlan: "growth",
  },
};
