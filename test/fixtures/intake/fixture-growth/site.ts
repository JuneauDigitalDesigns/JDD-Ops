/**
 * A single-site Growth intake, for recording dry-run output only.
 *
 * Lives under test/fixtures/ rather than clients/ deliberately. The dry-run recordings feed
 * console/test/phase-contract.test.mjs, and they used to be captured against the real
 * clients/_e2e_test_growth — so they printed "Reusing existing Airtable base …" and changed
 * the moment that client's .env.local changed. A contract test that churns on unrelated state
 * is a test people learn to ignore.
 *
 * A dry run never needs the client directory to exist (writeClientSchema, writeClientEnvLocal
 * and createRepoFromLocal all return before touching disk), and deriveBaseSlug falls back to
 * the containing folder name when the path has no clients/ segment. So this exercises the full
 * Growth phase sequence with no provisioned state behind it.
 *
 * NO TYPE ANNOTATIONS. loadIntake imports the schema as a data: URL after stripping a fixed set
 * of TS forms with plain regexes; anything outside that set survives and throws. Those regexes
 * also do not know what a comment is, so this header describes the stripped syntax without
 * quoting it — see fixture-enterprise/site.ts, where quoting it broke the import twice.
 */

export const INTAKE = {
  plan: 'growth',
  // Stated, never inferred — onboard.js refuses to run without it. The --receptionist flag
  // overrides this at run time (onboard.js:2563), which is how one starter fixture covers both
  // the with-receptionist and the web-only shapes.
  receptionistMode: 'forwarded',
  smsAlerts: { consented: true, phone: '(407) 555-0100', consentedAt: '2026-10-20T15:00:00.000Z' },
  sites: [
    {
      brand: {
        name: 'Fixture Plumbing Co.',
        short: 'fpc',
        long: 'Fixture Plumbing Company, LLC',
        established: '2009',
        tagline: 'Fixed right, first time',
        phone: '(407) 555-1200',
        phoneHref: 'tel:+14075551200',
        email: 'owner@fixtureplumbing.example.com',
        address: '120 Trade St, Orlando, FL 32801',
        license: 'CFC1428000',
        palette: {
          accent: '#0f766e',
          bg: '#ffffff',
          bgSoft: '#f1f5f9',
          ink: '#0f172a',
          inkSoft: '#475569',
          rule: '#dbe2ea',
        },
        typography: {
          fontSans: 'Inter',
          fontHeading: 'Inter',
          headingWeight: 700,
          bodyWeight: 400,
        },
      },
      nav: [{ label: 'Services', href: '/services' }],
      announcement: null,
      trust: { label: 'Trusted by', logos: [] },
      services: {
        eyebrow: 'What we do',
        title: 'Residential plumbing',
        sub: 'Repairs, repipes, water heaters',
        items: [{ n: '01', t: 'Water heaters', d: 'Repair and replacement, tank or tankless.', tag: 'Install' }],
      },
      faq: {
        eyebrow: 'Questions',
        title: 'Common questions',
        sub: 'The ones we get most',
        items: [{ q: 'Do you charge for estimates?', a: 'Not for replacements.' }],
      },
      seo: { title: null, description: null, canonical: null, googleAnalyticsId: null, facebookPixelId: null },
      _meta: {
        schema_version: '2.1',
        variation: 'D',
        is_placeholder: false,
        missing_fields: [],
        selectedPlan: 'growth',
      },
    },
  ],
};
