// A client with no rating, badges, stats or hero eyebrow never shows the preset's (2026-11-11).
//
// What shipped: the Studio's effective content is `preset <- imported <- generated <- edits`, and
// the merge reads null and [] as "missing". The HVAC preset carries `reviewBadge: { rating: 4.9,
// count: 340 }`, four trust badges ("24/7 emergency service", "Financing available", ...) and a stat
// band with "4.9★ From 180+ verified reviews" and "18+ Years serving your area", so a client who gave
// none of them was shown, in the hero, the reviews band, the trust strip, the footer and the final
// call to action, as 4.9 stars from 340 reviews with badges and stats nobody had claimed. Every other
// vertical's presets have carried a "4.9★ Customer rating" stat, and the plumbing, roofing and health
// heroes open on "Your City's ...". Operator decision (2026-11-11): a client with no real value shows
// nothing. Found while fixing the identity fall-through (preset-identity-no-fallthrough).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { presetFor, VERTICALS } from '../src/lib/verticals.ts';
import { deepMerge } from '@jdd/ui/merge';
import { effectiveContent } from '../src/lib/effectiveContent.ts';
import { stripPresetIdentity, isSampleList, isSampleRating, RETIRED_SAMPLE_TEXT } from '../src/lib/presetIdentity.ts';

// tsx compiles JSX to classic React.createElement calls (see lead-form-prefill.test.mjs).
globalThis.React = React;

const get = (o, path) => path.split('.').reduce((c, k) => (c == null ? undefined : c[k]), o);
const LISTS = ['extensions.trustBadges', 'trust.logos', 'about.stats', 'hero.heroBullets'];
const PLACE = /your city|your area|your town|your neighbou?rhood/i;

// A client who skipped the rating, badges and stats questions, with no copy generated yet.
const NO_CLAIMS = {
  brand: { name: 'Tracewell Heating & Air', short: 'Tracewell Heating & Air', long: 'Tracewell Heating & Air', phone: '4075550177', phoneHref: 'tel:4075550177' },
  hero: { eyebrow: null, sub: null, heroBullets: [] },
  about: { stats: [] },
  trust: { logos: [] },
  work: { sub: null },
  extensions: { reviewBadge: null, trustBadges: [], serviceArea: ['Winter Park'] },
};

/** No rating, preset list or placeholder place, judged against the preset's own values (not the
 *  list under test) and by a scan for any rating or placeholder place left anywhere. */
function assertNoPresetClaims(out, v, where) {
  const preset = presetFor(v);
  assert.equal(out.extensions.reviewBadge ?? null, null, `${where}: ${v} shows the preset's rating`);
  for (const path of LISTS) {
    const p = get(preset, path);
    if (Array.isArray(p) && p.length) assert.notDeepEqual(get(out, path), p, `${where}: ${v} ${path} is the preset's`);
    assert.deepEqual(get(out, path) ?? [], [], `${where}: ${v} ${path} is not empty`);
  }
  const text = JSON.stringify(out);
  assert.ok(!/★|\b4\.9\b|\b340\b/.test(text), `${where}: ${v} still carries a rating: ${text.match(/.{40}(★|\b4\.9\b|\b340\b).{40}/)?.[0]}`);
  assert.ok(!PLACE.test(text.replace(/"address":"[^"]*"/g, '')), `${where}: ${v} names a placeholder place: ${text.match(new RegExp(`.{40}(${PLACE.source}).{20}`, 'i'))?.[0]}`);
}

const render = async (path, content) => {
  const { default: C } = await import(`../src/components/catalog/${path}`);
  return renderToStaticMarkup(React.createElement(C, { content }));
};
const HVAC_BLOCKS = ['hero/HvacHero.tsx', 'hero/HeroSplit.tsx', 'trust/TrustBadges.tsx', 'trust/TrustReviewsAggregate.tsx', 'stats/HvacStatBand.tsx', 'footer/HvacFooter.tsx', 'finalCta/HvacFinalCta.tsx', 'testimonials/HvacReviews.tsx'];

test("the Studio's effective content gives a client with no rating, badges, stats or eyebrow none of the preset's", () => {
  for (const { id } of VERTICALS) assertNoPresetClaims(effectiveContent(id, NO_CLAIMS, null, {}), id, 'Studio');
});

test('what the export writes carries none of them either, and the blocks that read them render nothing', async () => {
  for (const { id } of VERTICALS) {
    // A direct API call skips the Studio: only the export's own gate cleans the raw merge.
    assertNoPresetClaims(stripPresetIdentity(deepMerge(presetFor(id), NO_CLAIMS)).content, id, 'export');
  }
  const shipped = effectiveContent('hvac', NO_CLAIMS, null, {});
  for (const block of HVAC_BLOCKS) {
    const html = await render(block, shipped);
    for (const sample of ['340', '4.9', 'verified reviews', 'Financing available', '24/7 emergency service', 'Years serving your area']) {
      assert.ok(!html.includes(sample), `${block} renders "${sample}" for a client with none`);
    }
  }
  // Nothing true to show: the trust strips drop out entirely rather than render an empty shell.
  assert.equal(await render('trust/TrustBadges.tsx', shipped), '');
  assert.equal(await render('trust/TrustReviewsAggregate.tsx', shipped), '');
  assert.equal(await render('stats/HvacStatBand.tsx', shipped), '');
  // An emptied eyebrow or sub leaves no empty paragraph (and its margin) behind. HVAC's sub and
  // plumbing's "Your City's" eyebrow are the ones that fell through.
  const BLOCKS = ['hero/DetailHero.tsx', 'hero/HeroFormFocus.tsx', 'hero/HeroOverlap.tsx', 'hero/HeroSplit.tsx', 'hero/HvacHero.tsx', 'hero/LawnHero.tsx', 'hero/PlumbingHero.tsx', 'hero/RoofingHero.tsx', 'work/RecentJobsGrid.tsx', 'work/WorkMasonry.tsx', 'work/WorkSpotlight.tsx'];
  for (const id of ['hvac', 'plumbing']) {
    const c = effectiveContent(id, NO_CLAIMS, null, {});
    assert.equal(id === 'hvac' ? c.hero.sub : c.hero.eyebrow, '', `${id}: the placeholder-place copy is not stripped`);
    const bare = { ...c, hero: { ...c.hero, sub: '', eyebrow: '' }, work: { ...c.work, sub: '', hidden: false, projects: c.work.projects?.length ? c.work.projects : [{ t: 'Job', img: '' }] } };
    for (const block of BLOCKS) {
      const html = await render(block, bare);
      // A paragraph with no text in it, the empty edit span (<p><span></span></p>) included.
      const empty = /<p[^>]*>(?:\s|<[^>]+>)*<\/p>/;
      assert.ok(!empty.test(html), `${block} renders an empty paragraph: ${html.match(empty)?.[0]}`);
    }
  }
});

test("a client's own rating, badges and stats survive untouched, sample words and all", async () => {
  const own = {
    ...NO_CLAIMS,
    about: { stats: [{ n: '4.9★', l: 'Customer rating' }, { n: '14', l: 'Years in Winter Park' }] },
    trust: { logos: ['Carrier', 'Trane'] },
    hero: { ...NO_CLAIMS.hero, eyebrow: 'Winter Park heating and cooling' },
    extensions: {
      ...NO_CLAIMS.extensions,
      // Tracewell's real badge and rating (clients/tracewell-heating-air/site.ts), and a list that
      // shares items with sample lists without being one.
      reviewBadge: { rating: 4.8, count: 57, url: 'https://maps.app.goo.gl/TwTestE2E0001' },
      trustBadges: ['TW Test Award 2025', 'BBB Accredited', 'Fully Insured'],
    },
  };
  for (const { id } of VERTICALS) {
    const out = effectiveContent(id, own, null, {});
    assert.deepEqual(out.extensions.reviewBadge, own.extensions.reviewBadge);
    assert.deepEqual(out.extensions.trustBadges, own.extensions.trustBadges);
    assert.deepEqual(out.trust.logos, ['Carrier', 'Trane']);
    assert.deepEqual(out.about.stats.map(({ n, l }) => ({ n, l })), own.about.stats);
    assert.equal(out.hero.eyebrow, own.hero.eyebrow);
  }
  // The preset's own numbers, from a client who links to the reviews behind them, are the client's.
  const linked = { rating: 4.9, count: 340, url: 'https://g.page/r/tracewell' };
  assert.deepEqual(effectiveContent('hvac', { ...own, extensions: { ...own.extensions, reviewBadge: linked } }, null, {}).extensions.reviewBadge, linked);
  const hero = await render('hero/HvacHero.tsx', effectiveContent('hvac', own, null, {}));
  assert.ok(hero.includes('4.8') && hero.includes('57'), "the client's own rating no longer renders");
});

test("every preset's rating, lists and placeholder-place copy are on the list", () => {
  for (const { id } of VERTICALS) {
    const preset = presetFor(id);
    const badge = preset.extensions?.reviewBadge;
    if (badge) assert.ok(isSampleRating(badge), `${id} reviewBadge ${JSON.stringify(badge)} is not on the list`);
    for (const path of LISTS) {
      const list = get(preset, path);
      if (Array.isArray(list) && list.length) assert.ok(isSampleList(path, list), `${id} ${path} is not on the list`);
    }
    for (const path of Object.keys(RETIRED_SAMPLE_TEXT)) {
      const value = get(preset, path);
      if (typeof value === 'string' && PLACE.test(value)) assert.ok(RETIRED_SAMPLE_TEXT[path].includes(value), `${id} ${path} "${value}" is not on the list`);
    }
  }
});
