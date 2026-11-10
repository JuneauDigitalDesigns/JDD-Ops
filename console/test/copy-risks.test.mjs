// SEO plan D2 (Xander, 2026-11-10): preset copy and claims the client's facts don't support are
// NOT a go-live block. They are a loud warning at the end of the intake wizard, before the build.
// copyRisks is the one detector; intake-wizard's final step (and the Studio) render its output.
// What it must catch is what shipped on e2etestgrowth: the HVAC preset's "NATE-certified",
// "price-lock guarantee", "100% satisfaction", and a scaffold promising "same day".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyRisks } from '../src/lib/copyRisks.ts';

const preset = {
  hero: { headline: 'Comfort restored the same day you call.', sub: 'NATE-certified technicians.' },
  about: { body: 'Family-owned since 1998.' },
  faq: { items: [{ q: 'Do you offer plans?', a: 'Yes, with a price-lock guarantee.' }] },
};

const base = (over = {}) => ({
  brand: { name: 'Peak Air', license: null, established: null, address: '1 Main St, Clermont, FL' },
  extensions: { trustBadges: null, responseTime: null, hours: null },
  _meta: { brandDirection: { differentiators: '' } },
  hero: { headline: '', sub: '' },
  about: { body: '' },
  faq: { items: [] },
  ...over,
});

test('copy still equal to the preset is listed by path', () => {
  const c = base({ hero: { ...preset.hero }, faq: { items: [{ ...preset.faq.items[0] }] } });
  const r = copyRisks(c, preset);
  assert.deepEqual(r.presetCopy.map((x) => x.path).sort(), ['faq.items.0.a', 'faq.items.0.q', 'hero.headline', 'hero.sub']);
});

test('a claim the facts do not support is listed with the claim it makes', () => {
  const c = base({ hero: { headline: 'AC repair in Clermont, same day', sub: 'NATE-certified, licensed and insured.' } });
  const claims = copyRisks(c, preset).unsupportedClaims.map((x) => `${x.path}:${x.claim}`);
  assert.ok(claims.includes('hero.headline:same day'), claims.join(' | '));
  assert.ok(claims.includes('hero.sub:certified'), claims.join(' | '));
  assert.ok(claims.includes('hero.sub:licensed'), claims.join(' | '));
  assert.ok(claims.includes('hero.sub:insured'), claims.join(' | '));
});

test('a claim the facts DO support is not listed', () => {
  const c = base({
    brand: { name: 'Peak Air', license: 'CAC1817400', established: '2011', address: '' },
    extensions: { trustBadges: ['NATE Certified'], responseTime: 'same day', hours: null },
    _meta: { brandDirection: { differentiators: 'Licensed and insured, family-owned' } },
    hero: { headline: 'Same day AC repair in Clermont', sub: 'NATE-certified, licensed and insured. Family-owned since 2011.' },
  });
  assert.deepEqual(copyRisks(c, preset).unsupportedClaims, []);
});

test('every unsupported claim from the shipped e2e HVAC copy is caught', () => {
  const c = base({
    hero: { headline: 'HVAC Emergency? We are available 24/7.', sub: 'Upfront pricing, no hidden fees and a 100% satisfaction guarantee.' },
    about: { body: 'Free estimates on every visit, with a 10-year warranty.' },
  });
  const claims = new Set(copyRisks(c, preset).unsupportedClaims.map((x) => x.claim));
  for (const want of ['24/7', 'no hidden fees', 'satisfaction', 'guarantee', 'free estimate', 'warranty', 'upfront pricing']) {
    assert.ok(claims.has(want), `missed "${want}" (got ${[...claims].join(', ')})`);
  }
});

test('brand, contact, links, images and _meta are never scanned', () => {
  const c = base({ brand: { name: 'Same Day Plumbing', license: null, established: null, address: '' }, seo: { canonical: 'https://24-7.example.com' } });
  assert.deepEqual(copyRisks(c, preset).unsupportedClaims, []);
});
