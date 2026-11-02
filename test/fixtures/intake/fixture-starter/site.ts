/**
 * A single-site Starter intake, for recording dry-run output only.
 *
 * Used for TWO recorded shapes, because the `--receptionist` flag overrides the mode in the
 * file (onboard.js:2563):
 *
 *   --receptionist forwarded  → Starter WITH a receptionist: full voice stack, email leads
 *   --receptionist declined   → web-only: site alone, no number, no agent, no call log
 *
 * That pairing is the point. Since the 2026-10-12 reprice the two differ ONLY in
 * receptionistMode, and "web-only" is not a fourth tier — it is this exact intake with a
 * different activation choice. Recording both from one file keeps them honestly comparable.
 *
 * Lives under test/fixtures/ rather than clients/ for the same reason as the other fixture
 * intakes: a dry run needs no client directory, and recordings captured against a real client
 * folder churn whenever that client's .env.local changes.
 *
 * NO TYPE ANNOTATIONS. loadIntake strips a fixed set of TS forms with plain regexes that also
 * do not know what a comment is, so this header describes the stripped syntax without quoting
 * it — see fixture-enterprise/site.ts, where quoting it broke the import twice.
 */

export const INTAKE = {
  plan: 'starter',
  receptionistMode: 'forwarded',
  // No SMS consent on file, so the clone drops its Twilio module entirely rather than being
  // left with an empty `to` — an unconfigured module errors on every run and enough errors
  // get the scenario auto-disabled, which would take the Airtable call log down with it.
  smsAlerts: null,
  sites: [
    {
      brand: {
        name: 'Fixture Electric LLC',
        short: 'fel',
        long: 'Fixture Electric, LLC',
        established: '2016',
        tagline: 'Licensed, insured, on time',
        phone: '(321) 555-0420',
        phoneHref: 'tel:+13215550420',
        email: 'owner@fixtureelectric.example.com',
        address: '42 Dynamo Ave, Kissimmee, FL 34741',
        license: 'EC13008000',
        palette: {
          accent: '#b45309',
          bg: '#ffffff',
          bgSoft: '#fafaf9',
          ink: '#1c1917',
          inkSoft: '#57534e',
          rule: '#e7e5e4',
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
        title: 'Residential electrical',
        sub: 'Panels, rewires, EV chargers',
        items: [{ n: '01', t: 'Panel upgrades', d: '100A to 200A service upgrades.', tag: 'Install' }],
      },
      faq: {
        eyebrow: 'Questions',
        title: 'Common questions',
        sub: 'The ones we get most',
        items: [{ q: 'Do you pull permits?', a: 'Always.' }],
      },
      seo: { title: null, description: null, canonical: null, googleAnalyticsId: null, facebookPixelId: null },
      _meta: {
        schema_version: '2.1',
        variation: 'D',
        is_placeholder: false,
        missing_fields: [],
        selectedPlan: 'starter',
      },
    },
  ],
};
