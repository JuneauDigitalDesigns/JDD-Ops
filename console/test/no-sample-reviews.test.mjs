// No sample review ever reaches a client site (operator decision, 2026-11-10). Companion to
// no-generated-testimonials.test.mjs, which stops the copywriter writing quotes. This one stops
// the other source: the industry presets and the default seed, which carried sample quotes
// ("Michael R.", "Sandra T.", ...). `effective = preset <- imported <- generated` lets a preset
// quote through wherever a client's own reviews are missing, and an old preset's quotes were
// baked into both e2e fixtures' site.ts. https://e2etestgrowth.vercel.app/ showed them under
// "Real Reviews from Real Customers", with schema.org Review markup.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { presetFor, VERTICALS } from '../src/lib/verticals.ts';
import { stripSampleReviews, RETIRED_SAMPLE_QUOTES } from '../src/lib/sampleReviews.ts';

const src = (rel) => readFileSync(fileURLToPath(new URL(`../src/${rel}`, import.meta.url)), 'utf8');
const filled = (c) => (c.testimonials?.items ?? []).filter((t) => t.q?.trim());

test('no industry preset carries a review quote', () => {
  for (const v of VERTICALS) {
    assert.deepEqual(filled(presetFor(v.id)).map((t) => t.a), [], `${v.id} preset still ships sample reviews`);
  }
});

test('the default seed carries no review quote', () => {
  // Read as source: importing data/site.ts under tsx trips @jdd/schema's package exports.
  const s = src('data/site.ts');
  const i = s.indexOf('testimonials: {');
  assert.ok(i > 0, 'default seed has no testimonials block');
  const block = s.slice(i, s.indexOf('faq', i));
  assert.ok(!/\bq:\s*["'][^"']/.test(block), 'the default seed still ships a sample review');
});

test('stripSampleReviews removes a baked-in sample quote and keeps a real one', () => {
  const real = { q: 'Came out the same afternoon and explained everything.', a: 'Dana P.', r: 'Clermont', company: null, stars: 5 };
  // Verbatim from clients/_e2e_test_growth/repo/src/data/site.ts (the deprecated HVAC preset).
  const baked = { q: 'Called at 11pm on a Friday when our furnace died. They had a tech at our door within an hour and fixed it that night. Incredible service.', a: 'Michael R.', r: 'Homeowner', company: null, stars: 5 };
  const content = { testimonials: { eyebrow: 'E', title: 'T', items: [baked, real] } };
  const { content: out, removed } = stripSampleReviews(content);
  assert.equal(removed, 1);
  assert.deepEqual(out.testimonials.items, [real]);
  assert.equal(content.testimonials.items.length, 2, 'input must not be mutated');
});

test('the match ignores punctuation and dash differences between preset revisions', () => {
  // car-detailing's quote exists in two revisions: "easy — water" (deprecated) and "easy, water".
  const variant = { q: '  The ceramic coating has made maintenance so easy... water just beads off. Six months later the car still looks freshly detailed ', a: 'Marcus P.', r: 'Car Owner', company: null, stars: 5 };
  assert.equal(stripSampleReviews({ testimonials: { eyebrow: '', title: '', items: [variant] } }).removed, 1);
});

test('every quote the presets ever shipped is on the retired list', () => {
  // The list must outlive the presets: a quote deleted from a preset is still baked into any
  // client exported while it was there.
  assert.ok(RETIRED_SAMPLE_QUOTES.length >= 23, `only ${RETIRED_SAMPLE_QUOTES.length} retired quotes listed`);
  for (const needle of ['Michael R.', 'Mike R.', 'Chris D.', 'Maria L.', 'Jennifer T.', 'Thomas W.', 'David K.']) {
    assert.ok(RETIRED_SAMPLE_QUOTES.some((r) => r.a === needle), `${needle}'s sample quote is not retired`);
  }
});

test('content with no testimonials passes through untouched', () => {
  const c = { brand: { name: 'x' } };
  assert.deepEqual(stripSampleReviews(c), { content: c, removed: 0 });
});

test('the export strips sample reviews before it writes site.ts, on every branch', () => {
  // Both writeSiteContent calls (Studio content, direct vertical-preset call) go through it.
  // Each branch builds `shipped` through the strip (and, since the SEO check, scores it), then
  // writes exactly that object: two writeSiteContent calls and the copySiteData seed branch.
  const s = src('app/api/build/export/route.ts');
  const writes = s.match(/writeSiteContent\(/g) ?? [];
  const built = s.match(/const shipped = withoutSampleReviews\(/g) ?? [];
  assert.ok(writes.length >= 2, 'expected the two writeSiteContent calls');
  assert.equal(built.length, 3, 'every branch must build its content through withoutSampleReviews');
  assert.equal((s.match(/writeSiteContent\(repoRoot, slug, shipped\)/g) ?? []).length, writes.length, 'a writeSiteContent call writes something other than the stripped content');
  assert.match(s, /copySiteData\(repoRoot, slug, \(\) => shipped\)/, 'the copySiteData branch skips the sample-review strip');
});

test("the Studio's effective content drops sample reviews, so the preview matches the export", () => {
  assert.match(src('app/c/[slug]/build/BuildWizard.tsx'), /stripSampleReviews\(/);
});
