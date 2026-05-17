// E2E fixture: ENTERPRISE tier (2 sites).
// onboard.js should loop the 9 steps twice, create 2 GitHub repos / Vercel
// projects / Retell agents / Twilio numbers, and 1 SHARED Airtable base with
// a Site singleSelect column.

const sharedPalette = {
  accent: "#7C3AED",
  bg: "#FFFFFF",
  bgSoft: "#F5F3FF",
  ink: "#1E1B4B",
  inkSoft: "#4C1D95",
  rule: "#DDD6FE",
};
const sharedTypography = {
  fontSans: "-apple-system, BlinkMacSystemFont, sans-serif",
  fontHeading: "-apple-system, BlinkMacSystemFont, sans-serif",
  headingWeight: 700,
  bodyWeight: 400,
};

function makeMeta(siteIndex, siteCount, siblingSlugs) {
  return {
    schema_version: "2.1",
    generated_at: "2026-05-13T00:00:00Z",
    variation: "D",
    is_placeholder: true,
    missing_fields: [],
    selectedPlan: "enterprise",
    siteIndex,
    siteCount,
    siblingSlugs,
  };
}

export const INTAKE = {
  plan: "enterprise",
  siteCount: 2,
  sites: [
    {
      brand: {
        name: "E2E Enterprise — Anchorage",
        short: "e2e-ent-anc",
        long: "E2E Enterprise Holdings — Anchorage Branch",
        established: "2020",
        tagline: "Enterprise testing — site 1.",
        phone: "(907) 555-0301",
        phoneHref: "tel:+19075550301",
        email: "owner+e2eent-anc@juneaudigitaldesigns.com",
        address: "300 Test Blvd, Anchorage, AK 99501",
        license: null,
        palette: sharedPalette,
        typography: sharedTypography,
      },
      services: {
        items: [
          { n: "01", t: "Service 1A", d: "Description 1A.", tag: "Test" },
          { n: "02", t: "Service 1B", d: "Description 1B.", tag: "Test" },
        ],
      },
      faq: { items: [{ q: "Site 1?", a: "Anchorage." }] },
      seo: {
        title: "E2E Enterprise Anchorage",
        description: "Site 1 of 2.",
        canonical: "https://example.com",
      },
      _meta: makeMeta(1, 2, ["_e2e-enterprise-2"]),
    },
    {
      brand: {
        name: "E2E Enterprise — Juneau",
        short: "e2e-ent-jnu",
        long: "E2E Enterprise Holdings — Juneau Branch",
        established: "2020",
        tagline: "Enterprise testing — site 2.",
        phone: "(907) 555-0302",
        phoneHref: "tel:+19075550302",
        email: "owner+e2eent-jnu@juneaudigitaldesigns.com",
        address: "400 Test Way, Juneau, AK 99801",
        license: null,
        palette: sharedPalette,
        typography: sharedTypography,
      },
      services: {
        items: [
          { n: "01", t: "Service 2A", d: "Description 2A.", tag: "Test" },
          { n: "02", t: "Service 2B", d: "Description 2B.", tag: "Test" },
        ],
      },
      faq: { items: [{ q: "Site 2?", a: "Juneau." }] },
      seo: {
        title: "E2E Enterprise Juneau",
        description: "Site 2 of 2.",
        canonical: "https://example.com",
      },
      _meta: makeMeta(2, 2, ["_e2e-enterprise-1"]),
    },
  ],
};
