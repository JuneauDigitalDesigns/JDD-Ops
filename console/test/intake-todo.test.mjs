// The intake's source chips and its Still to do list (intake redesign, approved 2026-11-10).
//
// The bug the source rule fixes: the old chip said "from intake" whenever the imported content
// had ANY value at the path. A client converted from a sales-call close is seeded with the
// vertical preset plus its name (lib/export.ts seedClientFolder), so every preset placeholder
// read "from intake" and nothing showed as missing. A value is the client's only when it
// differs from the preset's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sourceOf, seededByClose } from '../src/lib/intake-sources.ts';
import { intakeTodo, attentionByStep, servicePageHint, factsShort, BUSINESS_GROUPS } from '../src/lib/intake-todo.ts';
import { cameFromIntake } from '../src/lib/copy-brief/attention.ts';
import * as schema from '@jdd/schema';

// The real gate, from the package (lib/service-gate.ts passes the same functions in the UI).
const GATE = {
  servicePageFacts: schema.servicePageFacts, qualifiesForServicePage: schema.qualifiesForServicePage,
  FACTS_MIN: schema.FACTS_MIN, INCLUDED_MIN: schema.INCLUDED_MIN, TYPICAL_JOBS_MIN: schema.TYPICAL_JOBS_MIN,
};

const preset = {
  brand: { name: 'Your HVAC Co.', long: 'Your HVAC Company LLC', tagline: 'Comfort in every season.', established: '', phone: '(555) 000-0000', email: '', address: '', license: '' },
  extensions: { responseTime: 'under 60 minutes', serviceArea: ['Springfield'] },
  services: { items: [] },
  testimonials: { items: [] },
  _meta: { missing_fields: ['brand.phone'] },
};

// What seedClientFolder writes for a close: the preset, renamed. No brandDirection.
const closeSeed = {
  ...structuredClone(preset),
  brand: { ...preset.brand, name: 'Coastline Heating & Air' },
  _meta: { missing_fields: [] },
};

// What the onboarding form's mapper writes: real values, blanks flagged, a brandDirection.
const formSeed = {
  brand: { name: 'Coastline Heating & Air', long: '', tagline: '', established: '', phone: '(407) 555-0142', email: 'office@example.com', address: '1180 W Fairbanks Ave, Winter Park, FL 32789', license: '' },
  extensions: { responseTime: null, serviceArea: ['Winter Park', 'Maitland'] },
  services: { items: [] },
  testimonials: { items: [{ q: '', a: '', r: '', stars: 5 }] },
  _meta: { missing_fields: ['brand.established', 'brand.license', 'extensions.responseTime'], brandDirection: { differentiators: '' } },
};

const merge = (a, b) => {
  if (b === null || b === undefined) return a;
  if (Array.isArray(b)) return b.length ? b : a;
  if (typeof b !== 'object') return b === '' ? a : b;
  const out = { ...(a ?? {}) };
  for (const [k, v] of Object.entries(b)) out[k] = merge(a?.[k], v);
  return out;
};
const ctx = (imported, edits = {}, extra = {}) => ({
  imported, preset, edits, effective: merge(merge(structuredClone(preset), structuredClone(imported)), extra),
});

test('the old rule called a close-seeded preset placeholder "from intake"; the new one says Preset', () => {
  // The shipped behaviour, kept as evidence: any imported value counted as the client's.
  assert.equal(cameFromIntake(closeSeed, 'brand.tagline'), true);
  const c = ctx(closeSeed);
  assert.equal(seededByClose(closeSeed), true);
  assert.equal(sourceOf(c, 'brand.tagline'), 'preset');
  assert.equal(sourceOf(c, 'extensions.responseTime'), 'preset');
  assert.equal(sourceOf(c, 'brand.name'), 'close');
});

test('form values are Form; a blank the form flagged is Not given; an unflagged blank is Not asked', () => {
  const c = ctx(formSeed);
  assert.equal(seededByClose(formSeed), false);
  assert.equal(sourceOf(c, 'brand.phone'), 'form');
  assert.equal(sourceOf(c, 'brand.established'), 'notGiven');
  assert.equal(sourceOf(c, 'brand.email'), 'form');
  assert.equal(sourceOf(c, 'extensions.ownerName'), 'notAsked');
});

test('an operator edit is Console, including a whole-array write above the path', () => {
  const c = ctx(formSeed, { 'brand.established': '2011' }, { brand: { established: '2011' } });
  assert.equal(sourceOf(c, 'brand.established'), 'console');
  const arr = ctx(formSeed, { 'extensions.serviceArea': ['Oviedo'] }, { extensions: { serviceArea: ['Oviedo'] } });
  assert.equal(sourceOf(arr, 'extensions.serviceArea'), 'console');
});

test('Still to do lists preset and empty business facts, not supplied ones; optional ones do not count', () => {
  const items = intakeTodo(GATE, ctx(closeSeed));
  const keys = items.filter((i) => i.step === 'business').map((i) => i.key);
  assert.ok(keys.includes('brand.tagline'), 'a preset tagline is not the client\'s');
  assert.ok(keys.includes('extensions.responseTime'));
  assert.equal(keys.includes('brand.name'), false, 'the close supplied the name');
  const tagline = items.find((i) => i.key === 'brand.tagline');
  assert.equal(tagline.optional, true);
  const counts = attentionByStep(items);
  const required = items.filter((i) => i.step === 'business' && !i.optional).length;
  assert.equal(counts.business, required);
});

test('every business field the step renders is checked exactly once', () => {
  const paths = BUSINESS_GROUPS.flatMap((g) => g.fields.map((f) => f.path));
  assert.equal(new Set(paths).size, paths.length);
});

test('services use the shared gate: section-only services say how many facts short', () => {
  const content = {
    ...structuredClone(formSeed),
    services: { items: [
      { t: 'AC Repair', included: ['a', 'b', 'c'], typicalJobs: ['x', 'y'] },
      { t: 'Heat Pump', included: ['a', 'b', 'c'] },
      { t: 'Duct Cleaning' },
    ] },
  };
  assert.equal(servicePageHint(GATE, content, 0).page, true);
  assert.equal(factsShort(GATE, content, 1), 1, 'has the core fact, needs one more');
  assert.equal(factsShort(GATE, content, 2), 2, 'needs a core fact and one more');
  const items = intakeTodo(GATE, { imported: content, preset, edits: {}, effective: content });
  const svc = items.filter((i) => i.step === 'services');
  assert.deepEqual(svc.filter((i) => !i.optional).map((i) => i.label), ['Heat Pump', 'Duct Cleaning']);
  const own = svc.find((i) => i.label === 'AC Repair');
  assert.equal(own.optional, true);
  assert.match(own.detail, /areas \(adds an areas block on its page\)/);
});

test('no real reviews is a required item; reviews with no source are flagged, never hidden', () => {
  const none = intakeTodo(GATE, ctx(formSeed));
  assert.ok(none.some((i) => i.key === 'reviews.none' && !i.optional), 'blank slots are not reviews');
  const content = { ...structuredClone(formSeed), testimonials: { items: [{ q: 'Great work on our AC.', a: 'Dana P.', r: '', stars: 5 }] } };
  const items = intakeTodo(GATE, { imported: content, preset, edits: {}, effective: content });
  assert.equal(items.some((i) => i.key === 'reviews.none'), false);
  assert.ok(items.some((i) => i.key === 'reviews.unsourced' && !i.optional));
});

test('the service-area-business answer is required; false is an answer', () => {
  const a = intakeTodo(GATE, ctx(formSeed));
  assert.ok(a.some((i) => i.key === 'extensions.serviceAreaBusiness'));
  const content = { ...structuredClone(formSeed), extensions: { ...formSeed.extensions, serviceAreaBusiness: false } };
  const b = intakeTodo(GATE, { imported: content, preset, edits: {}, effective: content });
  assert.equal(b.some((i) => i.key === 'extensions.serviceAreaBusiness'), false);
});

test('unreviewed generated sections are listed under Review and counted', () => {
  const items = intakeTodo(GATE, { ...ctx(formSeed), unreviewed: ['Home · Services', 'Home · FAQ'] });
  assert.equal(attentionByStep(items).review, 2);
});

test('a preset star rating is a required item: it is an invented rating on a real business', () => {
  const withBadge = { ...structuredClone(preset), extensions: { ...preset.extensions, reviewBadge: { rating: 4.9, count: 340, url: '' } } };
  const effective = structuredClone(withBadge);
  effective.brand.name = 'Coastline Heating & Air';
  const items = intakeTodo(GATE, { imported: closeSeed, preset: withBadge, edits: {}, effective });
  const r = items.find((i) => i.key === 'extensions.reviewBadge');
  assert.ok(r, 'listed');
  assert.equal(r.status, 'preset');
  assert.equal(r.optional, false);
  assert.match(r.detail, /4\.9 from 340/);
  // The client's own rating is supplied and not listed.
  const own = { ...structuredClone(formSeed), extensions: { ...formSeed.extensions, reviewBadge: { rating: 4.8, count: 212, url: 'https://g.page/x' } } };
  const ok = intakeTodo(GATE, { imported: own, preset: withBadge, edits: {}, effective: own });
  assert.equal(ok.some((i) => i.key === 'extensions.reviewBadge'), false);
});
