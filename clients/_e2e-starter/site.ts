// E2E fixture: STARTER tier.
// onboard.js should skip Retell/Twilio/Airtable steps and write
// LEAD_DELIVERY_MODE=email into .env.local.
//
// Safe to dry-run. Live run requires real creds; teardown.js will clean up.

export const INTAKE = {
  plan: "starter",
  siteCount: 1,
  sites: [
    {
      brand: {
        name: "E2E Starter Co",
        short: "e2e-starter",
        long: "E2E Starter Co LLC",
        established: null,
        tagline: "Testing the Starter tier.",
        phone: "(907) 555-0101",
        phoneHref: "tel:+19075550101",
        email: "owner+e2estarter@juneaudigitaldesigns.com",
        address: "100 Test Lane, Juneau, AK 99801",
        license: null,
        palette: {
          accent: "#3B82F6",
          bg: "#FFFFFF",
          bgSoft: "#F8FAFC",
          ink: "#0F172A",
          inkSoft: "#475569",
          rule: "#E2E8F0",
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
          { n: "01", t: "Service A", d: "Description A.", tag: "Test" },
          { n: "02", t: "Service B", d: "Description B.", tag: "Test" },
        ],
      },
      faq: { items: [{ q: "Is this a test?", a: "Yes." }] },
      seo: {
        title: "E2E Starter",
        description: "Starter tier fixture.",
        canonical: "https://example.com",
      },
      _meta: {
        schema_version: "2.1",
        generated_at: "2026-05-13T00:00:00Z",
        variation: "D",
        is_placeholder: true,
        missing_fields: [],
        selectedPlan: "starter",
      },
    },
  ],
};
