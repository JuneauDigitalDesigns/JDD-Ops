/**
 * A 2-site enterprise intake, for recording dry-run output only.
 *
 * Lives under test/fixtures/ rather than clients/ on purpose: a dry run never requires the
 * client directory to exist (writeClientSchema, writeClientEnvLocal and createRepoFromLocal
 * all return before touching disk), and `deriveBaseSlug` falls back to the containing folder
 * name when the path has no `clients/` segment. So this exercises the enterprise phase
 * sequence — the one with per-site tags and a shared Airtable base — without adding a fake
 * client to the real roster, where `/manage` would list it and the onboarding gate would have
 * to special-case it.
 *
 * Field coverage is deliberately complete: validateSite checks ~25 fields because the client
 * build runs with `strict`, and a short fixture is how the _e2e-starter intake once drifted to
 * a 3-field brand without anything noticing.
 *
 * NO TYPE ANNOTATIONS below, deliberately. loadIntake imports the schema as a data: URL after
 * stripping a fixed set of TS forms with plain regexes. Anything outside that set — a typed
 * function parameter, for instance — survives the strip and throws "Unexpected token". Real
 * client schemas stay inside the subset because they are generated; a hand-written fixture
 * has to as well.
 *
 * Those strip rules do not know what a comment is, which bit this very header twice while it
 * was being written. Prose describing the stripped syntax got stripped out of the prose, and
 * the phrase naming TS record types (the one starting with "inter") matched the block-removal
 * pattern and deleted everything from mid-sentence through the first object literal below.
 * So: describe the behavior, never quote the syntax, in any schema file.
 */

const palette = {
  accent: '#1f6feb',
  bg: '#ffffff',
  bgSoft: '#f6f8fa',
  ink: '#111418',
  inkSoft: '#57606a',
  rule: '#d8dee4',
};

const typography = {
  fontSans: 'Inter',
  fontHeading: 'Inter',
  headingWeight: 700,
  bodyWeight: 400,
};

const site = (n, short, city) => ({
  brand: {
    name: `Fixture Mechanical ${city}`,
    short,
    long: `Fixture Mechanical of ${city}, LLC`,
    established: '1998',
    tagline: 'Commercial HVAC, done once',
    phone: `(407) 555-12${n}0`,
    phoneHref: `tel:+140755512${n}0`,
    email: `${short}@example.com`,
    address: `${n}00 Industrial Blvd, ${city}, FL 3280${n}`,
    license: `CAC18${n}0000`,
    palette,
    typography,
  },
  nav: [{ label: 'Services', href: '/services' }],
  announcement: null,
  trust: { label: 'Trusted by', logos: [] },
  services: {
    eyebrow: 'What we do',
    title: 'Commercial HVAC',
    sub: 'Install, service, maintain',
    items: [{ n: '01', t: 'Rooftop units', d: 'Install and replace RTUs.', tag: 'Install' }],
  },
  faq: {
    eyebrow: 'Questions',
    title: 'Common questions',
    sub: 'The ones we get most',
    items: [{ q: 'Do you do emergency work?', a: 'Yes, 24/7.' }],
  },
  seo: { title: null, description: null, canonical: null, googleAnalyticsId: null, facebookPixelId: null },
  _meta: {
    schema_version: '2.1',
    variation: 'D',
    is_placeholder: false,
    missing_fields: [],
    selectedPlan: 'enterprise',
    siteIndex: n - 1,
    siteCount: 2,
  },
});

export const INTAKE = {
  plan: 'enterprise',
  // Stated, never inferred — onboard.js refuses to run without it.
  receptionistMode: 'forwarded',
  // Envelope-level: one owner, one consented cell, however many sites they run.
  smsAlerts: { consented: true, phone: '(407) 555-0100', consentedAt: '2026-10-20T15:00:00.000Z' },
  sites: [site(1, 'orl', 'Orlando'), site(2, 'tpa', 'Tampa')],
};
