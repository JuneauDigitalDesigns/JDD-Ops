// The copywriter for the local SEO page types (Xander, 2026-11-12: L2, L4, L6, L7, L9, L14):
// town pages at /areas/<town> and town + service pages at /areas/<town>/<service>.
//
// Each page is written from ITS OWN facts only: the photos and reviews tagged to that town (and
// that service, for a town + service page), the operator's town notes that carry a source link,
// and that service's Q5 "what changes the price" and Q6 "what happens on a typical visit". Nothing
// generic is sent, so a page cannot be padded, and a page whose facts don't pass the gate is never
// asked for. Local codes, permits and conditions are never generated (L9): an operator note without
// its source link never reaches the model at all.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCopySchema, ALL_SECTIONS } from '../src/lib/copy-schema.ts';
import { townPagesInstruction, townServicePagesInstruction } from '../src/lib/copy-brief/compile.ts';
import { applyGeneratedCopy } from '../src/lib/copy-brief/apply-generated.ts';
import { planRunSections, SKIP_REASONS } from '../src/lib/copy-brief/run-sections.ts';
import { RUN_GROUPS, SWITCHABLE } from '../src/lib/run-steps.ts';
import { labelFor } from '../src/lib/section-labels.ts';
import { buildReviewGroups, rewrittenTownKeys, townCopyBehind } from '../src/lib/copy-review-groups.ts';
import { resolveBrief } from '../src/lib/copy-brief/resolve.ts';
import { briefFactsText } from '../src/lib/copy-brief/brief-facts.ts';
import { BUILT_IN_VERTICALS } from '@jdd/schema';
import { sectionParts, partLabel } from '../src/lib/review-parts.ts';
import { pickTownPages, pickTownServicePages, TOWN_PAGES_MAX, TOWN_SERVICE_PAGES_MAX, townPageFacts, townServicePageFacts } from '../src/lib/townPages.ts';

const drain = {
  t: 'Drain Cleaning', slug: 'drain-cleaning', tag: 'Drains', d: 'Clear drains.',
  included: ['Camera inspection', 'Hydro jetting', 'Root cutting'], typicalJobs: ['Slow kitchen sink', 'Backed-up main line'],
  priceFrom: '$129', areas: ['Clermont', 'Minneola'], duration: 'Under an hour',
  priceFactors: ['How long the line is', 'Roots in the pipe'],
  typicalVisit: ['We run a camera down the line first', 'Then we clear it and show you the footage'],
};
const heater = {
  t: 'Water Heaters', slug: 'water-heaters', tag: 'Heaters', d: 'Heaters.',
  included: ['Tank swap', 'Tankless installs', 'Haul away'], typicalJobs: ['No hot water'],
  priceFactors: ['Tank or tankless'], typicalVisit: ['A same day look'],
};
const thin = { t: 'Gas Lines', slug: 'gas-lines', tag: 'Gas', d: 'Gas work.' };
const photo = (n, town, service, extra = {}) => ({ t: `Job ${n}`, loc: '', yr: '2025', scope: `Scope ${n}`, size: '', caption: '', image: { url: `/img/p${n}`, alt: '' }, town, service, ...extra });

const base = () => ({
  brand: { name: 'Peak Plumbing', phone: '(352) 555-0100', address: '12 Main St, Clermont, FL 34711' },
  extensions: {
    serviceArea: ['Clermont', 'Minneola', 'Groveland', 'Mascotte'],
    topTowns: ['Minneola'],
    townNotes: [
      { town: 'Minneola', text: 'Minneola homes on the north side are on septic.', url: 'https://example.gov/minneola-septic' },
      { town: 'Minneola', text: 'Water is hard here.' }, // no source link: never sent (L9)
      { town: 'Groveland', text: 'Groveland needs a permit for a water heater swap.', url: 'https://example.gov/groveland' },
    ],
    townServicePages: [
      { town: 'Minneola', service: 'drain-cleaning' },
      { town: 'Groveland', service: 'drain-cleaning' },
      { town: 'Minneola', service: 'gas-lines' },
      { town: 'Clermont', service: 'drain-cleaning' },
    ],
  },
  services: { eyebrow: '', title: '', sub: '', items: [{ ...drain }, { ...heater }, { ...thin }] },
  work: {
    eyebrow: '', title: '', sub: '',
    projects: [
      photo(1, 'Minneola', 'drain-cleaning', { t: 'Main line cleared on a 1970s ranch', size: '80 ft line' }),
      photo(2, 'Minneola', 'water-heaters', { t: 'Tankless swap' }),
      photo(3, 'Groveland', undefined),
      photo(4, 'Groveland', undefined),
      photo(5, 'Groveland', undefined),
      photo(6, 'Mascotte', 'drain-cleaning'),
      photo(7, 'Clermont', 'drain-cleaning'),
      photo(8, 'Clermont', 'drain-cleaning'),
      photo(9, 'Clermont', 'water-heaters'),
      photo(10, 'Minneola', 'drain-cleaning', { image: null }), // no photo: not a photo fact
    ],
  },
  testimonials: {
    eyebrow: '', title: '',
    items: [
      { q: 'They cleared our main line in an hour.', a: 'Dana R.', r: '', stars: 5, town: 'Minneola', service: 'drain-cleaning' },
      { q: 'Great work in Mascotte.', a: 'Lee', r: '', stars: 5, town: 'Mascotte' },
      { q: 'Clermont review.', a: 'Sam', r: '', stars: 5, town: 'Clermont', service: 'drain-cleaning' },
      { q: 'Clermont review 2.', a: 'Pat', r: '', stars: 5, town: 'Clermont' },
    ],
  },
  about: { eyebrow: '', title: '', body: '', pillars: [], stats: [] },
  hero: { headline: '', frictionReducers: [], heroBullets: [] },
  faq: { eyebrow: '', title: '', sub: '', items: [] },
  finalCta: { frictionReducers: [] },
  _meta: {},
});

// ── The gate (L4, L6, L14) ───────────────────────────────────────────────────────────────────

test('a town gets a page only with 3+ of its own facts of 2+ kinds, never the main city', () => {
  const towns = pickTownPages(base()).map((p) => p.town);
  // Minneola: 2 photos, 1 review, 1 sourced note. Groveland: 3 photos and a note = 2 kinds, so it
  // passes too. Mascotte: 2 facts. Clermont: the main city (L4), whatever it has.
  assert.deepEqual(towns, ['Minneola', 'Groveland']);
  assert.equal(TOWN_PAGES_MAX, 10);
  assert.equal(TOWN_SERVICE_PAGES_MAX, 15);
});

test('a note without its source link is not a town fact (L9)', () => {
  const c = base();
  c.extensions.townNotes = c.extensions.townNotes.filter((n) => n.town !== 'Groveland');
  c.extensions.townNotes.push({ town: 'Groveland', text: 'Unsourced.' });
  assert.deepEqual(pickTownPages(c).map((p) => p.town), ['Minneola'], 'three photos alone are one kind');
});

test('a town + service page needs approval and 2+ facts tagged to both', () => {
  const pages = pickTownServicePages(base()).map((p) => `${p.townSlug}/${p.service}`);
  // Groveland's photos name no service; gas-lines earns no service page; Clermont is the main city.
  assert.deepEqual(pages, ['minneola/drain-cleaning']);
});

// ── Facts per page: its own, and nothing generic ─────────────────────────────────────────────

test('a town page is given only that town\'s photos, reviews and sourced notes', () => {
  const f = townPageFacts(base(), base()).find((p) => p.town === 'Minneola');
  assert.equal(f.slug, 'minneola');
  assert.equal(f.basedIn, 'Clermont');
  assert.deepEqual(f.photos.map((p) => p.title), ['Main line cleared on a 1970s ranch', 'Tankless swap']);
  assert.deepEqual(f.reviews.map((r) => r.quote), ['They cleared our main line in an hour.']);
  assert.deepEqual(f.notes, [{ text: 'Minneola homes on the north side are on septic.', source: 'https://example.gov/minneola-septic' }]);
  const json = JSON.stringify(f);
  for (const other of ['Groveland', 'Mascotte', 'Water is hard here', 'Clermont review', 'Dana R.']) {
    assert.ok(!json.includes(other), `Minneola's facts must not carry ${other}`);
  }
});

test('a town + service page is given that town\'s facts for that service, plus Q5 and Q6', () => {
  const [f] = townServicePageFacts(base(), base());
  assert.equal(f.town, 'minneola');
  assert.equal(f.service, 'drain-cleaning');
  assert.deepEqual(f.priceFactors, drain.priceFactors);
  assert.deepEqual(f.typicalVisit, drain.typicalVisit);
  assert.equal(f.howLong, 'Under an hour');
  assert.deepEqual(f.photos.map((p) => p.title), ['Main line cleared on a 1970s ranch'], 'not the tankless swap');
  assert.deepEqual(f.reviews.map((r) => r.quote), ['They cleared our main line in an hour.']);
  // What the service page already carries stays there (it is what the duplicate check stops).
  const json = JSON.stringify(f);
  for (const hub of ['Camera inspection', 'Slow kitchen sink', '$129']) assert.ok(!json.includes(hub), `must not repeat ${hub}`);
});

// ── The instructions ─────────────────────────────────────────────────────────────────────────

test('the town page instruction asks for exactly the gated towns, from their own facts', () => {
  const line = townPagesInstruction(base());
  assert.match(line, /townPages/);
  for (const fact of ['"minneola"', '"groveland"', 'Main line cleared on a 1970s ranch', 'https://example.gov/minneola-septic', 'Clermont']) {
    assert.ok(line.includes(fact), `missing ${fact}`);
  }
  assert.ok(!line.includes('Water is hard here'), 'an unsourced note never reaches the model');
  assert.ok(!line.includes('"mascotte"'), 'a town without a page is not asked for');
  assert.ok(!/[–—]/.test(line), 'the instruction carries no dash');
});

test('the rules that keep a town page honest are in its instruction', () => {
  for (const line of [townPagesInstruction(base()), townServicePagesInstruction(base())]) {
    assert.match(line, /never state a local code, permit, rule or condition/i);
    assert.match(line, /near me/);
    assert.match(line, /no town lists/i);
    assert.match(line, /number/i);
    assert.match(line, /8 words/);
  }
  assert.match(townPagesInstruction(base()), /exactly 2 sentences/);
  assert.match(townPagesInstruction(base()), /Name the town once/);
});

test('the town + service instruction lists only the approved pages that pass', () => {
  const line = townServicePagesInstruction(base());
  assert.match(line, /townServicePages/);
  assert.ok(line.includes('How long the line is'));
  assert.ok(line.includes('We run a camera down the line first'));
  assert.ok(!line.includes('gas-lines') && !line.includes('"groveland"'));
  assert.ok(!/[–—]/.test(line));
});

test('no town passes, no instruction; no approved page passes, no instruction', () => {
  const c = base();
  c.work.projects = [];
  c.testimonials.items = [];
  assert.equal(townPagesInstruction(c), '');
  assert.equal(townServicePagesInstruction(c), '');
});

// ── The output schema: copy only, never a fact or an identity field (#79, #83) ───────────────

test('both sections are generable with a fixed shape and no identity fields', () => {
  assert.ok(ALL_SECTIONS.includes('townPages') && ALL_SECTIONS.includes('townServicePages'));
  const hub = buildCopySchema(['townPages'], false).properties.townPages.properties.items.items;
  assert.deepEqual(Object.keys(hub.properties).sort(), ['captions', 'intro', 'slug']);
  const spoke = buildCopySchema(['townServicePages'], false).properties.townServicePages.properties.items.items;
  assert.deepEqual(Object.keys(spoke.properties).sort(), ['expect', 'faq', 'intro', 'service', 'town']);
  assert.ok(!buildCopySchema(['townPages', 'townServicePages'], false).properties.brand, 'no brand in these chunks');
});

// ── Applying the reply ───────────────────────────────────────────────────────────────────────

test('town copy lands by slug, captions by photo, and nothing for a town without a page', () => {
  const out = applyGeneratedCopy(base(), { townPages: { items: [
    { slug: 'minneola', intro: 'Two sentences.', captions: ['Main line cleared.', ''] },
    { slug: 'mascotte', intro: 'Invented page.', captions: [] },
    { slug: 'clermont', intro: 'Main city.', captions: [] },
  ] } }, new Set(['townPages']));
  assert.deepEqual(Object.keys(out.townPages), ['minneola']);
  assert.deepEqual(out.townPages.minneola, {
    town: 'Minneola', intro: 'Two sentences.',
    captions: [{ image: '/img/p1', caption: 'Main line cleared.' }], // an empty caption is left out
  });
});

test('town + service copy lands under its town, and a town page run keeps it', () => {
  const b = base();
  const spoke = applyGeneratedCopy(b, { townServicePages: { items: [
    { town: 'minneola', service: 'drain-cleaning', intro: 'Spoke intro.', expect: ['Camera first.'], faq: [{ q: 'Do you do septic lines?', a: 'Yes.' }] },
    { town: 'minneola', service: 'gas-lines', intro: 'x', expect: [], faq: [] },
  ] } }, new Set(['townServicePages']));
  assert.deepEqual(spoke.townPages.minneola.services, {
    'drain-cleaning': { intro: 'Spoke intro.', expect: ['Camera first.'], faq: [{ q: 'Do you do septic lines?', a: 'Yes.' }] },
  });
  // A later town page run keeps the spoke copy already there, and vice versa.
  const hub = applyGeneratedCopy({ ...b, townPages: spoke.townPages }, { townPages: { items: [{ slug: 'minneola', intro: 'Hub.', captions: [] }] } }, new Set(['townPages']));
  assert.equal(hub.townPages.minneola.services['drain-cleaning'].intro, 'Spoke intro.');
  assert.equal(hub.townPages.minneola.intro, 'Hub.');
});

test('a town + service question the service page already answers is dropped', () => {
  const b = base();
  b.services.items[0].page = { intro: '', faq: [{ q: 'How long does it take?', a: 'Under an hour.' }] };
  b.extensions.customerQuestions = [{ q: 'Do you clear roots?', a: 'Yes.', service: 'drain-cleaning' }];
  const out = applyGeneratedCopy(b, { townServicePages: { items: [
    { town: 'minneola', service: 'drain-cleaning', intro: 'I.', expect: [], faq: [
      { q: 'How long does it take?', a: 'x' }, { q: 'do you clear roots', a: 'x' }, { q: 'Do you work on septic lines?', a: 'Yes.' },
    ] },
  ] } }, new Set(['townServicePages']));
  assert.deepEqual(out.townPages.minneola.services['drain-cleaning'].faq.map((f) => f.q), ['Do you work on septic lines?']);
});

// ── The Prompt panel: switches, and "Not written" with its reason ────────────────────────────

test('both sections sit under "Other pages" with their own labels', () => {
  const other = RUN_GROUPS.find((g) => g.label === 'Other pages');
  assert.deepEqual(other.sections, ['seo', 'subpages', 'servicePages', 'townPages', 'townServicePages']);
  assert.ok(SWITCHABLE.includes('townPages') && SWITCHABLE.includes('townServicePages'));
  assert.equal(labelFor('townPages'), 'Town pages');
  assert.equal(labelFor('townServicePages'), 'Town and service pages');
});

test('a section with no page to write is "Not written", with its reason', () => {
  const plan = planRunSections({
    requested: ['hero', 'townPages', 'townServicePages'], all: ALL_SECTIONS, subpages: [],
    hasServicePages: true, hasTownPages: false, hasTownServicePages: false,
  });
  assert.deepEqual(plan.sections, ['hero']);
  assert.deepEqual(plan.skipped, [
    { section: 'townPages', reason: SKIP_REASONS.noTownPages },
    { section: 'townServicePages', reason: SKIP_REASONS.noTownServicePages },
  ]);
  const ok = planRunSections({
    requested: ['townPages', 'townServicePages'], all: ALL_SECTIONS, subpages: [],
    hasServicePages: true, hasTownPages: true, hasTownServicePages: true,
  });
  assert.deepEqual(ok.sections, ['townPages', 'townServicePages']);
});

// ── The Review step ──────────────────────────────────────────────────────────────────────────

test('each town page and town + service page is reviewed on its own', () => {
  const groups = buildReviewGroups([
    { route: 'areas/minneola/drain-cleaning', label: 'Drain Cleaning in Minneola', pageType: 'townService' },
    { route: 'areas/minneola', label: 'Minneola', pageType: 'town' },
    { route: 'areas', label: 'Service Areas', pageType: 'areas' },
  ]);
  assert.deepEqual(groups.find((g) => g.route === 'areas/minneola').sections, ['townPages']);
  assert.deepEqual(groups.find((g) => g.route === 'areas/minneola/drain-cleaning').sections, ['townServicePages']);
  assert.deepEqual(groups.find((g) => g.route === 'areas').sections, ['subpages'], 'the Service Areas page is unchanged');
  const order = groups.map((g) => g.route);
  assert.ok(order.indexOf('areas/minneola') < order.indexOf('areas/minneola/drain-cleaning'), 'a town page comes before its own service pages');
});

test('review parts are the generated lines only, never the town or a photo', () => {
  const generated = { townPages: { minneola: {
    town: 'Minneola', intro: 'Hub intro.', captions: [{ image: '/img/p1', caption: 'Main line cleared.' }],
    services: { 'drain-cleaning': { intro: 'Spoke.', expect: ['Camera first.'], faq: [{ q: 'Q?', a: 'A.' }] } },
  } } };
  const hub = sectionParts('areas/minneola:townPages', generated, base());
  assert.deepEqual(hub.map((p) => p.path), ['townPages.minneola.intro', 'townPages.minneola.captions.0.caption']);
  assert.deepEqual(hub.map((p) => p.label), ['Intro', 'Photo 1 · Caption']);
  const spoke = sectionParts('areas/minneola/drain-cleaning:townServicePages', generated, base());
  assert.deepEqual(spoke.map((p) => p.path), [
    'townPages.minneola.services.drain-cleaning.intro',
    'townPages.minneola.services.drain-cleaning.expect.0',
    'townPages.minneola.services.drain-cleaning.faq.0.q',
    'townPages.minneola.services.drain-cleaning.faq.0.a',
  ]);
  assert.equal(partLabel('townPages.minneola.services.drain-cleaning.faq.0.q'), 'Question 1 · Question');
});

test('a run that rewrites a town page puts that page back up for review', () => {
  const before = { townPages: { minneola: { town: 'Minneola', intro: 'Old.', captions: [] } } };
  const after = { townPages: { minneola: { town: 'Minneola', intro: 'New.', captions: [], services: { 'drain-cleaning': { intro: 'S.', expect: [], faq: [] } } }, groveland: { town: 'Groveland', intro: 'G.', captions: [] } } };
  assert.deepEqual(rewrittenTownKeys(before, after).sort(), [
    'areas/groveland:townPages', 'areas/minneola/drain-cleaning:townServicePages', 'areas/minneola:townPages',
  ]);
  assert.deepEqual(rewrittenTownKeys(after, after), []);
});

test('the review gate finds town copy where it lives', () => {
  const generated = { townPages: { minneola: { town: 'Minneola', intro: 'I.', captions: [], services: { 'drain-cleaning': { intro: 'S.', expect: [], faq: [] } } } } };
  assert.equal(townCopyBehind('areas/minneola:townPages', generated), true);
  assert.equal(townCopyBehind('areas/minneola/drain-cleaning:townServicePages', generated), true);
  assert.equal(townCopyBehind('areas/groveland:townPages', generated), false);
  assert.equal(townCopyBehind('areas/minneola/water-heaters:townServicePages', generated), false);
  assert.equal(townCopyBehind('hero', generated), undefined, 'every other key is left to the existing rule');
});

// ── The Prompt panel's section instructions, and the SEO check's facts ───────────────────────

const ctxFor = (content) => ({
  vertical: BUILT_IN_VERTICALS.find((v) => v.id === 'plumbing') ?? BUILT_IN_VERTICALS[0],
  effective: content, imported: content, preset: {}, edits: {},
  brief: { blocks: {}, customFields: [] }, tickedSections: ['townPages', 'townServicePages'],
});

test('the Prompt panel offers each town section only when it has a page to write, with its instruction', () => {
  const entries = resolveBrief(ctxFor(base())).find((b) => b.id === 'sections').entries;
  const hub = entries.find((e) => e.section === 'townPages');
  const pair = entries.find((e) => e.section === 'townServicePages');
  assert.equal(hub.text, townPagesInstruction(base()));
  assert.equal(pair.text, townServicePagesInstruction(base()));
  const c = base();
  c.work.projects = [];
  c.testimonials.items = [];
  const none = resolveBrief(ctxFor(c)).find((b) => b.id === 'sections').entries.map((e) => e.section);
  assert.ok(!none.includes('townPages') && !none.includes('townServicePages'));
});

test('the SEO check is given the town facts the copywriter was given', () => {
  const facts = briefFactsText(ctxFor(base()));
  assert.ok(facts.includes('80 ft line'), 'a number from a town photo is a fact');
  assert.ok(facts.includes('How long the line is'));
  assert.ok(!facts.includes('Water is hard here'), 'an unsourced note is not');
});
