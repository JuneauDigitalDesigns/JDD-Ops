// E2E negative fixture: ENTERPRISE with 4 sites — should be REJECTED by
// validateIntake (max is 3).
//
// Only used for verifying the upper-bound check; never live-provisioned.

const sharedPalette = {
  accent: "#DC2626",
  bg: "#FFFFFF",
  bgSoft: "#FEF2F2",
  ink: "#7F1D1D",
  inkSoft: "#991B1B",
  rule: "#FECACA",
};
const sharedTypography = {
  fontSans: "-apple-system, sans-serif",
  fontHeading: "-apple-system, sans-serif",
  headingWeight: 700,
  bodyWeight: 400,
};

function site(n) {
  return {
    brand: {
      name: `Overflow ${n}`,
      short: `overflow-${n}`,
      long: `Overflow Test ${n}`,
      established: null,
      tagline: `Site ${n}`,
      phone: `(907) 555-040${n}`,
      phoneHref: `tel:+1907555040${n}`,
      email: `o${n}@example.com`,
      address: `${n}00 Test`,
      license: null,
      palette: sharedPalette,
      typography: sharedTypography,
    },
    services: { items: [{ n: "01", t: "X", d: "X", tag: "X" }] },
    faq: { items: [{ q: "?", a: "." }] },
    seo: { title: `s${n}`, description: ".", canonical: "https://x" },
    _meta: {
      schema_version: "2.1",
      generated_at: "2026-05-13T00:00:00Z",
      variation: "D",
      is_placeholder: true,
      missing_fields: [],
      selectedPlan: "enterprise",
      siteIndex: n,
      siteCount: 4,
      siblingSlugs: [],
    },
  };
}

export const INTAKE = {
  plan: "enterprise",
  siteCount: 4,
  sites: [site(1), site(2), site(3), site(4)],
};
