// Which services the Studio gives a page, and what the export writes so the site links to them
// (service-page-spec.md §1, §2, §8; orchestrator 2026-11-10: "The export must now write
// content.servicePages so client sites link to their service pages").
//
// The gate (lib/servicePages.ts) decides; the composition follows (template-visual-upgrade's
// syncServicePages adds and removes the pages); the export writes the composition's slugs into
// content.servicePages, which the menu, cards, related links and footer read, and stores each
// paged service's slug once, so a later rename keeps its URL.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chosenServicePages, withStoredSlugs } from '../src/app/c/[slug]/build/service-page-sync.ts';

const rich = (t, extra = {}) => ({ t, included: ['a', 'b', 'c'], priceFrom: '$99', ...extra });
const content = (items) => ({ services: { items }, extensions: {}, testimonials: { items: [] }, work: { projects: [] } });
const comp = (others, service = []) => ({
  chrome: {},
  pages: [
    ...Array.from({ length: others }, (_, i) => ({ route: i ? `p${i}` : '', pageType: i ? 'about' : 'home', label: `P${i}`, sections: [] })),
    ...service.map((s) => ({ route: `services/${s}`, pageType: 'service', label: s, sections: [] })),
  ],
});

test('only services that earn a page are chosen, in their own order, with their own names', () => {
  const c = content([rich('Drain Cleaning'), { t: 'Gas Lines' }, rich('Water Heaters', { slug: 'water-heaters' })]);
  assert.deepEqual(chosenServicePages(c, comp(4)), [
    { slug: 'drain-cleaning', label: 'Drain Cleaning' },
    { slug: 'water-heaters', label: 'Water Heaters' },
  ]);
});

test('the page cap counts the non-service pages only (existing service pages do not use up slots)', () => {
  const items = Array.from({ length: 14 }, (_, i) => rich(`Service ${i + 1}`));
  // 16 pages max, 5 other pages: 11 service pages, whatever service pages already exist.
  assert.equal(chosenServicePages(content(items), comp(5)).length, 11);
  assert.equal(chosenServicePages(content(items), comp(5, ['service-1', 'service-2'])).length, 11);
});

test('a thin client gets no service pages', () => {
  assert.deepEqual(chosenServicePages(content([{ t: 'Gas Lines' }]), comp(4)), []);
});

test('the export stores the slug of every paged service once, and leaves the rest alone', () => {
  const c = content([{ t: 'Drain Cleaning', d: 'x' }, { t: 'Gas Lines' }, { t: 'Water Heaters', slug: 'kept-slug' }]);
  const out = withStoredSlugs(c, ['drain-cleaning', 'kept-slug']);
  assert.equal(out.services.items[0].slug, 'drain-cleaning');
  assert.equal(out.services.items[0].d, 'x');
  assert.equal(out.services.items[1].slug, undefined, 'no page, no stored slug');
  assert.equal(out.services.items[2].slug, 'kept-slug', 'a stored slug is never re-derived');
});

test('the export writes content.servicePages from the composition and stores the slugs', () => {
  const s = readFileSync(fileURLToPath(new URL('../src/app/api/build/export/route.ts', import.meta.url)), 'utf8');
  assert.match(s, /content\.servicePages = servicePageSlugs\(composition\)/);
  assert.match(s, /withStoredSlugs\(/);
});

test('the Studio keeps the composition in line with the gate', () => {
  const s = readFileSync(fileURLToPath(new URL('../src/app/c/[slug]/build/BuildWizard.tsx', import.meta.url)), 'utf8');
  assert.match(s, /syncServicePages\(siteComposition, chosenServicePages\(effective, siteComposition\)\)/);
});
