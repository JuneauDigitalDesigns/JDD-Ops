// The copywriter for the local SEO page types (Xander, 2026-11-12: L2, L4, L6, L7, L9, L14):
// town pages at /areas/<town> and town + service pages at /areas/<town>/<service>.
//
// The shape is @jdd/schema v1.34.0's, settled by the Local SEO session with Templates: the
// copywriter writes ONLY each page's intro (content.areaCopy) and its meta description
// (subpages[route].seo.description). Every other block renders from the client's tagged facts, so
// only they count toward the 40% local share; no captions, no "what to expect", no FAQ. The H1 and
// title are fixed patterns built by pageSeo.
//
// Each page is written from ITS OWN facts only: the jobs and reviews tagged to that town (and that
// service, for a town + service page), the operator's town notes that carry a source link, and that
// service's Q5 "what changes the price" and Q6 "what happens on a typical visit". Nothing generic
// is sent, so a page cannot be padded. Which pages exist is the schema's gate, never a copy here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BUILT_IN_VERTICALS } from '@jdd/schema';
import { buildCopySchema, ALL_SECTIONS } from '../src/lib/copy-schema.ts';
import { townPagesInstruction, townServicePagesInstruction } from '../src/lib/copy-brief/compile.ts';
import { applyGeneratedCopy } from '../src/lib/copy-brief/apply-generated.ts';
import { planRunSections, SKIP_REASONS } from '../src/lib/copy-brief/run-sections.ts';
import { RUN_GROUPS, SWITCHABLE } from '../src/lib/run-steps.ts';
import { labelFor } from '../src/lib/section-labels.ts';
import { buildReviewGroups, rewrittenPageKeys, rewrittenTownKeys, townCopyBehind } from '../src/lib/copy-review-groups.ts';
import { sectionParts, partLabel, applyParts } from '../src/lib/review-parts.ts';
import { resolveBrief } from '../src/lib/copy-brief/resolve.ts';
import { briefFactsText } from '../src/lib/copy-brief/brief-facts.ts';
import { pickTownPages, pickTownServicePages, townPageFacts, townServicePageFacts } from '../src/lib/townPages.ts';

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
      { town: 'Minneola', text: 'Minneola homes on the north side are on septic.', sourceUrl: 'https://example.gov/minneola-septic' },
      { town: 'Minneola', text: 'Water is hard here.' }, // no source link: never sent (L9)
      { town: 'Groveland', text: 'Groveland needs a permit for a water heater swap.', sourceUrl: 'https://example.gov/groveland' },
    ],
  },
  // The export's routing list (written from the composition): the spokes Phase 3 approved.
  areaPages: [
    { town: 'Minneola', slug: 'minneola', spokes: ['drain-cleaning', 'gas-lines'] },
    { town: 'Groveland', slug: 'groveland', spokes: ['drain-cleaning'] },
    { town: 'Mascotte', slug: 'mascotte', spokes: ['drain-cleaning'] },
  ],
  services: { eyebrow: '', title: '', sub: '', items: [{ ...drain }, { ...heater }, { ...thin }] },
  work: {
    eyebrow: '', title: '', sub: '',
    projects: [
      photo(1, 'Minneola', 'drain-cleaning', { t: 'Main line cleared on a 1970s ranch', size: '80 ft line' }),
      photo(2, 'minneola ', 'water-heaters', { t: 'Tankless swap' }), // a tag in another case still counts
      photo(3, 'Groveland', undefined),
      photo(4, 'Groveland', undefined),
      photo(5, 'Groveland', undefined),
      photo(6, 'Mascotte', 'drain-cleaning'),
      photo(7, 'Clermont', 'drain-cleaning'),
      photo(8, 'Clermont', 'drain-cleaning'),
      photo(9, 'Clermont', 'water-heaters'),
      photo(10, 'Minneola', 'drain-cleaning', { image: null }), // no photo: not a job fact
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
  subpages: { about: { header: { eyebrow: 'E', title: 'About', sub: '', cta: null }, seo: { title: 'About | Peak', description: 'About.' } } },
  about: { eyebrow: '', title: '', body: '', pillars: [], stats: [] },
  hero: { headline: '', frictionReducers: [], heroBullets: [] },
  faq: { eyebrow: '', title: '', sub: '', items: [] },
  finalCta: { frictionReducers: [] },
  _meta: {},
});

// ── Which pages: the schema's gate, nothing re-implemented ────────────────────────────────────

test('the copywriter writes for exactly the towns the schema gives a page', () => {
  // Minneola: 2 jobs, 1 review, 1 sourced note. Groveland: 3 jobs and a sourced note. Mascotte: 2
  // facts. Clermont: the main city (L4), whatever it has.
  assert.deepEqual(pickTownPages(base()), [{ town: 'Minneola', slug: 'minneola' }, { town: 'Groveland', slug: 'groveland' }]);
});

test('the town gate is @jdd/schema\'s, never a copy', () => {
  const src = readFileSync(fileURLToPath(new URL('../src/lib/townPages.ts', import.meta.url)), 'utf8');
  assert.match(src, /pickAreaPages\(content, PAGE_CAPS\.area\)/);
  assert.match(src, /qualifiesForSpokePage\(/);
  assert.ok(!/AREA_FACTS_MIN|>= *3\b/.test(src), 'no gate threshold of its own');
});

test('a note without its source link is not a town fact (L9)', () => {
  const c = base();
  c.extensions.townNotes = c.extensions.townNotes.filter((n) => n.town !== 'Groveland');
  c.extensions.townNotes.push({ town: 'Groveland', text: 'Unsourced.' });
  assert.deepEqual(pickTownPages(c).map((p) => p.town), ['Minneola'], 'three jobs alone are one kind');
});

test('a town + service page is written only when the export lists it and its facts pass', () => {
  // gas-lines earns no service page; Groveland's jobs name no service; Mascotte has no town page.
  assert.deepEqual(pickTownServicePages(base()).map((p) => `${p.townSlug}/${p.service}`), ['minneola/drain-cleaning']);
  const c = base();
  delete c.areaPages;
  assert.deepEqual(pickTownServicePages(c), [], 'nothing listed (until Phase 3), nothing written');
});

// ── Facts per page: its own, and nothing generic ─────────────────────────────────────────────

test('a town page is given only that town\'s jobs, reviews and sourced notes', () => {
  const f = townPageFacts(base()).find((p) => p.town === 'Minneola');
  assert.equal(f.slug, 'minneola');
  assert.equal(f.basedIn, 'Clermont');
  assert.deepEqual(f.servicesHere, ['Drain Cleaning']);
  assert.deepEqual(f.jobs.map((p) => p.title), ['Main line cleared on a 1970s ranch', 'Tankless swap']);
  assert.deepEqual(f.reviews, [{ quote: 'They cleared our main line in an hour.', service: 'Drain Cleaning' }]);
  assert.deepEqual(f.notes, [{ text: 'Minneola homes on the north side are on septic.', source: 'https://example.gov/minneola-septic' }]);
  const json = JSON.stringify(f);
  for (const other of ['Groveland', 'Mascotte', 'Water is hard here', 'Clermont review', 'Dana R.', '/img/']) {
    assert.ok(!json.includes(other), `Minneola's facts must not carry ${other}`);
  }
});

test('a town + service page is given that town\'s facts for that service, plus Q5 and Q6', () => {
  const [f] = townServicePageFacts(base());
  assert.equal(f.town, 'minneola');
  assert.equal(f.service, 'drain-cleaning');
  assert.deepEqual(f.priceFactors, drain.priceFactors);
  assert.deepEqual(f.typicalVisit, drain.typicalVisit);
  assert.equal(f.howLong, 'Under an hour');
  assert.deepEqual(f.jobs.map((p) => p.title), ['Main line cleared on a 1970s ranch'], 'not the tankless swap');
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

test('the rules that keep a town page honest are in both instructions', () => {
  for (const line of [townPagesInstruction(base()), townServicePagesInstruction(base())]) {
    assert.match(line, /never state a local code, permit, rule or condition/i);
    assert.match(line, /near me/);
    assert.match(line, /no town lists/i);
    assert.match(line, /number/i);
    assert.match(line, /8 words/);
    assert.match(line, /exactly 2 sentences/);
    assert.match(line, /Name the town once/);
    assert.match(line, /do not repeat the page heading/);
    assert.match(line, /155 characters/);
    assert.ok(!/caption|faq|expect:/i.test(line), 'no captions, questions or "what to expect" (settled shape)');
    assert.ok(!/[–—]/.test(line));
  }
});

test('the town + service instruction lists only the listed pages that pass', () => {
  const line = townServicePagesInstruction(base());
  assert.match(line, /townServicePages/);
  assert.ok(line.includes('How long the line is'));
  assert.ok(line.includes('We run a camera down the line first'));
  assert.ok(!line.includes('gas-lines') && !line.includes('"groveland"'));
});

test('no town passes, no instruction; nothing listed, no instruction', () => {
  const c = base();
  c.work.projects = [];
  c.testimonials.items = [];
  assert.equal(townPagesInstruction(c), '');
  assert.equal(townServicePagesInstruction(c), '');
});

// ── The output schema: intros and descriptions only, never a fact or an identity field ───────

test('both sections are generable with a fixed shape and no identity fields', () => {
  assert.ok(ALL_SECTIONS.includes('townPages') && ALL_SECTIONS.includes('townServicePages'));
  const hub = buildCopySchema(['townPages'], false).properties.townPages.properties.items.items;
  assert.deepEqual(Object.keys(hub.properties).sort(), ['intro', 'seoDescription', 'slug']);
  const spoke = buildCopySchema(['townServicePages'], false).properties.townServicePages.properties.items.items;
  assert.deepEqual(Object.keys(spoke.properties).sort(), ['intro', 'seoDescription', 'service', 'town']);
  assert.ok(!buildCopySchema(['townPages', 'townServicePages'], false).properties.brand, 'no brand in these chunks');
});

// ── Applying the reply ───────────────────────────────────────────────────────────────────────

test('a town intro lands in areaCopy and its description in that page\'s SEO, and nothing for a town without a page', () => {
  const out = applyGeneratedCopy(base(), { townPages: { items: [
    { slug: 'minneola', intro: ' Two sentences. ', seoDescription: 'Drain cleaning and water heaters in Minneola. Call today.' },
    { slug: 'mascotte', intro: 'Invented page.', seoDescription: 'x' },
    { slug: 'clermont', intro: 'Main city.', seoDescription: 'x' },
  ] } }, new Set(['townPages']));
  assert.deepEqual(out.areaCopy, { minneola: { intro: 'Two sentences.' } });
  assert.deepEqual(out.subpages['areas/minneola'], { seo: { description: 'Drain cleaning and water heaters in Minneola. Call today.' } }, 'no title or H1 is written');
  assert.equal(out.subpages['areas/mascotte'], undefined);
  assert.deepEqual(out.subpages.about, base().subpages.about, 'other pages are untouched');
  assert.equal(out.areaPages, undefined, 'the routing list is the export\'s, never written here');
});

test('a spoke intro lands under its town, and a town page run keeps it', () => {
  const b = base();
  const spoke = applyGeneratedCopy(b, { townServicePages: { items: [
    { town: 'minneola', service: 'drain-cleaning', intro: 'Spoke intro.', seoDescription: 'Spoke description.' },
    { town: 'minneola', service: 'gas-lines', intro: 'x', seoDescription: 'x' },
  ] } }, new Set(['townServicePages']));
  assert.deepEqual(spoke.areaCopy, { minneola: { intro: '', spokes: { 'drain-cleaning': { intro: 'Spoke intro.' } } } });
  assert.equal(spoke.subpages['areas/minneola/drain-cleaning'].seo.description, 'Spoke description.');
  assert.equal(spoke.subpages['areas/minneola/gas-lines'], undefined);
  const hub = applyGeneratedCopy({ ...b, areaCopy: spoke.areaCopy, subpages: spoke.subpages },
    { townPages: { items: [{ slug: 'minneola', intro: 'Hub.', seoDescription: 'Hub description.' }] } }, new Set(['townPages']));
  assert.equal(hub.areaCopy.minneola.spokes['drain-cleaning'].intro, 'Spoke intro.');
  assert.equal(hub.areaCopy.minneola.intro, 'Hub.');
  assert.equal(hub.subpages['areas/minneola/drain-cleaning'].seo.description, 'Spoke description.');
});

test('a town run and a page header run in one go both land', () => {
  const out = applyGeneratedCopy(base(), {
    subpages: { items: [{ route: 'about', eyebrow: 'E2', title: 'About us', sub: 'S', seoTitle: 'T', seoDescription: 'D' }] },
    townPages: { items: [{ slug: 'minneola', intro: 'Hub.', seoDescription: 'Hub description.' }] },
  }, new Set(['subpages', 'townPages']), { subpageRoutes: ['about'] });
  assert.equal(out.subpages.about.header.title, 'About us');
  assert.equal(out.subpages['areas/minneola'].seo.description, 'Hub description.');
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

const ctxFor = (content) => ({
  vertical: BUILT_IN_VERTICALS.find((v) => v.id === 'plumbing') ?? BUILT_IN_VERTICALS[0],
  effective: content, imported: content, preset: {}, edits: {},
  brief: { blocks: {}, customFields: [] }, tickedSections: ['townPages', 'townServicePages'],
});

test('the Prompt panel offers each town section only when it has a page to write, with its instruction', () => {
  const entries = resolveBrief(ctxFor(base())).find((b) => b.id === 'sections').entries;
  assert.equal(entries.find((e) => e.section === 'townPages').text, townPagesInstruction(base()));
  assert.equal(entries.find((e) => e.section === 'townServicePages').text, townServicePagesInstruction(base()));
  const c = base();
  c.work.projects = [];
  c.testimonials.items = [];
  const none = resolveBrief(ctxFor(c)).find((b) => b.id === 'sections').entries.map((e) => e.section);
  assert.ok(!none.includes('townPages') && !none.includes('townServicePages'));
});

test('the SEO check is given the town facts the copywriter was given', () => {
  const facts = briefFactsText(ctxFor(base()));
  assert.ok(facts.includes('80 ft line'), 'a number from a town job is a fact');
  assert.ok(facts.includes('How long the line is'));
  assert.ok(!facts.includes('Water is hard here'), 'an unsourced note is not');
});

// ── The Review step ──────────────────────────────────────────────────────────────────────────

test('each town page and town + service page is reviewed on its own', () => {
  const groups = buildReviewGroups([
    { route: 'areas/minneola/drain-cleaning', label: 'Drain Cleaning in Minneola', pageType: 'spoke' },
    { route: 'areas/minneola', label: 'Minneola', pageType: 'area' },
    { route: 'areas', label: 'Service Areas', pageType: 'areas' },
  ]);
  assert.deepEqual(groups.find((g) => g.route === 'areas/minneola').sections, ['townPages']);
  assert.deepEqual(groups.find((g) => g.route === 'areas/minneola/drain-cleaning').sections, ['townServicePages']);
  assert.deepEqual(groups.find((g) => g.route === 'areas').sections, ['subpages'], 'the Service Areas page is unchanged');
  const order = groups.map((g) => g.route);
  assert.ok(order.indexOf('areas/minneola') < order.indexOf('areas/minneola/drain-cleaning'), 'a town page comes before its own service pages');
});

const GENERATED = {
  areaCopy: { minneola: { intro: 'Hub intro.', spokes: { 'drain-cleaning': { intro: 'Spoke.' } } } },
  subpages: {
    'areas/minneola': { seo: { description: 'Hub description.' } },
    'areas/minneola/drain-cleaning': { seo: { description: 'Spoke description.' } },
  },
};

test('review parts are the intro and the description, nothing else', () => {
  const hub = sectionParts('areas/minneola:townPages', GENERATED, base());
  assert.deepEqual(hub.map((p) => p.path), ['areaCopy.minneola.intro', 'subpages.areas/minneola.seo.description']);
  assert.deepEqual(hub.map((p) => p.label), ['Intro', 'SEO · Description']);
  const spoke = sectionParts('areas/minneola/drain-cleaning:townServicePages', GENERATED, base());
  assert.deepEqual(spoke.map((p) => p.path), ['areaCopy.minneola.spokes.drain-cleaning.intro', 'subpages.areas/minneola/drain-cleaning.seo.description']);
  assert.equal(partLabel('areaCopy.minneola.spokes.drain-cleaning.intro'), 'Intro');
  assert.deepEqual(sectionParts('areas/groveland:townPages', GENERATED, base()), [], 'nothing generated, nothing to tick');
});

test('regenerating a ticked town part takes only that part', () => {
  const fresh = {
    areaCopy: { minneola: { intro: 'New hub intro.', spokes: { 'drain-cleaning': { intro: 'New spoke.' } } } },
    subpages: { 'areas/minneola': { seo: { description: 'New description.' } } },
  };
  const w = applyParts(GENERATED, fresh, ['subpages.areas/minneola.seo.description'], {});
  assert.equal(w.sections.subpages['areas/minneola'].seo.description, 'New description.');
  assert.equal(w.sections.subpages['areas/minneola/drain-cleaning'].seo.description, 'Spoke description.', 'unticked stays');
  assert.equal(w.sections.areaCopy, undefined, 'the intro was not ticked');
});

test('a run that rewrites a town page puts that page, and only it, back up for review', () => {
  const before = { areaCopy: { minneola: { intro: 'Old.' } }, subpages: {} };
  const after = {
    areaCopy: { minneola: { intro: 'New.', spokes: { 'drain-cleaning': { intro: 'S.' } } }, groveland: { intro: 'G.' } },
    subpages: { 'areas/groveland': { seo: { description: 'D.' } } },
  };
  assert.deepEqual(rewrittenTownKeys(before, after).sort(), [
    'areas/groveland:townPages', 'areas/minneola/drain-cleaning:townServicePages', 'areas/minneola:townPages',
  ]);
  assert.deepEqual(rewrittenTownKeys(after, after), []);
  // A description-only change counts too.
  const desc = { ...after, subpages: { 'areas/groveland': { seo: { description: 'D2.' } } } };
  assert.deepEqual(rewrittenTownKeys(after, desc), ['areas/groveland:townPages']);
  // ...and is never read as a page header (which these pages don't have).
  assert.deepEqual(rewrittenPageKeys(after, desc), []);
});

test('the review gate finds town copy where it lives', () => {
  assert.equal(townCopyBehind('areas/minneola:townPages', GENERATED), true);
  assert.equal(townCopyBehind('areas/minneola/drain-cleaning:townServicePages', GENERATED), true);
  assert.equal(townCopyBehind('areas/groveland:townPages', GENERATED), false);
  assert.equal(townCopyBehind('areas/minneola/water-heaters:townServicePages', GENERATED), false);
  assert.equal(townCopyBehind('hero', GENERATED), undefined, 'every other key is left to the existing rule');
});
