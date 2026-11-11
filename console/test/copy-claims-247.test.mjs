// The claims panel (Still to do -> "Claims not in the client's facts") catches the 24/7 and
// emergency-service promise in other words, and in the SEO description.
//
// The bug (Tracewell Heating & Air, 2026-11-11). The client's hours are Mon to Fri, 8am to 5pm and
// they never ticked emergency service. The run's copy promised it anyway, and the panel only knew
// the literal "24/7": it missed "day or night", "Emergency calls any time", "Emergency HVAC service"
// and "Emergency help day or night" (seo.description, a root it never scanned). The fixture is the
// real draft and the real model output.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deepMerge } from '@jdd/ui/merge';
import { presetFor } from '../src/lib/verticals.ts';
import { copyRisks } from '../src/lib/copyRisks.ts';

const draft = JSON.parse(readFileSync(new URL('./fixtures/copy-brief/tracewell-draft.json', import.meta.url), 'utf8'));
const preset = presetFor('hvac');

/** The site as the run left it: preset <- the client's intake <- the generated copy. */
const site = (imported = draft.imported) => deepMerge(deepMerge(preset, imported), draft.generated);

/** Every string in the run that promised 24/7 or emergency service, by path. */
const PROMISES = {
  announcement: '24/7 emergency HVAC service in Winter Park. Call us any time, day or night.',
  'hero.badge': '24/7 emergency service',
  'hero.headline': 'Heating and air repair in Winter Park, day or night',
  'hero.headlineEmphasis': 'day or night',
  'hero.frictionReducers.2': 'Emergency calls any time',
  'hero.heroBullets.2.value': '24/7',
  'hero.heroBullets.2.label': 'Emergency HVAC service',
  'about.story.3': null,
  'faq.items.1.a': null,
  'services.items.0.page.faq.1.a': null,
  'seo.description': null,
};

const flagged = (content) => {
  const r = copyRisks(content, preset);
  return new Set(r.unsupportedClaims.filter((c) => c.claim === '24/7' || c.claim === 'emergency service').map((c) => c.path));
};

test('the fixture still carries every one of the promises', () => {
  const c = site();
  for (const [path, text] of Object.entries(PROMISES)) {
    const v = path.split('.').reduce((o, k) => o?.[k], c);
    assert.equal(typeof v, 'string', `${path} missing`);
    if (text) assert.equal(v, text);
  }
});

test('every 24/7 or emergency promise is flagged for a client who offers neither', () => {
  const got = flagged(site());
  const missed = Object.keys(PROMISES).filter((p) => !got.has(p));
  assert.deepEqual(missed, [], `missed: ${missed.join(', ')}`);
});

test('none is flagged for a client whose hours include the wizard\'s emergency line', () => {
  // juneau-digital-designs onboarding wizard: hoursLine() joins the hours and EMERGENCY_LINE.
  const imported = structuredClone(draft.imported);
  imported.extensions.hours = { all: 'Mon to Fri, 8am to 5pm. Emergency calls answered 24/7' };
  const got = flagged(site(imported));
  assert.deepEqual([...got], [], `flagged although the client offers it: ${[...got].join(', ')}`);
});

test('none is flagged for a client open 24/7', () => {
  const imported = structuredClone(draft.imported);
  imported.extensions.hours = { all: 'Open 24/7' };
  assert.deepEqual([...flagged(site(imported))], []);
});

test('the preset\'s own 24/7 badge never supports the claim', () => {
  // A client with no badges of their own: the merged content carries the preset's
  // "24/7 emergency service" badge, and it used to count as the client's fact.
  const imported = structuredClone(draft.imported);
  imported.extensions.trustBadges = null;
  const got = flagged(site(imported));
  assert.ok(got.has('hero.badge') && got.has('announcement'), [...got].join(', '));
});

test('SEO title and description are scanned, canonical and ids are not', () => {
  const c = site();
  c.seo = { ...c.seo, title: 'Emergency HVAC service | Tracewell', canonical: 'https://247-emergency-service.example.com', googleAnalyticsId: 'G-24/7' };
  const paths = copyRisks(c, preset).unsupportedClaims.map((x) => x.path);
  assert.ok(paths.includes('seo.title') && paths.includes('seo.description'));
  assert.ok(!paths.some((p) => p === 'seo.canonical' || p === 'seo.googleAnalyticsId'));
});
