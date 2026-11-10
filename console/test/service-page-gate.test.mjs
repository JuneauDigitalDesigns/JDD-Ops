// Which services earn their own page (service-page-spec.md §1, §2). A page per service is
// Xander's decision (2026-11-10); a page per service with nothing of its own to say is the
// thin/doorway pattern Google's spam policy describes. So a page needs `included` (3+) or
// `typicalJobs` (2+), plus at least one other real fact, and a service that misses stays a card
// on /services. This module is the ONE implementation: the export, the Studio's page wiring and
// intake-wizard's "needs N more facts" hint all import it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  serviceSlug,
  servicePageFacts,
  qualifiesForServicePage,
  pickServicePages,
} from '../src/lib/servicePages.ts';

const site = (items, extra = {}) => ({
  services: { items },
  extensions: { serviceArea: ['Clermont', 'Groveland', 'Minneola'], ...(extra.extensions ?? {}) },
  testimonials: { items: extra.reviews ?? [] },
  work: { projects: extra.projects ?? [] },
});

test('a bare service name earns no page', () => {
  const c = site([{ t: 'AC Repair' }]);
  assert.equal(qualifiesForServicePage(c, 0), false);
  assert.ok(servicePageFacts(c, 0).missing.includes('included'));
});

test('included (3+) alone is not enough: it needs one more fact', () => {
  const c = site([{ t: 'AC Repair', included: ['Diagnosis', 'Refrigerant check', 'Repair'] }]);
  assert.equal(qualifiesForServicePage(c, 0), false);
  const withPrice = site([{ t: 'AC Repair', included: ['Diagnosis', 'Refrigerant check', 'Repair'], priceFrom: '$89' }]);
  assert.equal(qualifiesForServicePage(withPrice, 0), true);
});

test('two included items do not count as the core fact', () => {
  const c = site([{ t: 'AC Repair', included: ['Diagnosis', 'Repair'], priceFrom: '$89', brands: ['Trane'] }]);
  assert.equal(qualifiesForServicePage(c, 0), false, 'needs included (3+) or typicalJobs (2+)');
});

test('typicalJobs (2+) plus a tagged real review qualifies', () => {
  const c = site([{ t: 'Drain Cleaning', slug: 'drain-cleaning', typicalJobs: ['Slow kitchen sink', 'Backed-up main line'] }], {
    reviews: [{ q: 'Cleared our main line in an hour.', a: 'Dana P.', service: 'drain-cleaning' }],
  });
  assert.equal(qualifiesForServicePage(c, 0), true);
  assert.ok(servicePageFacts(c, 0).have.includes('review'));
});

test('areas only count when they narrow the service area', () => {
  const all = site([{ t: 'Roof Repair', included: ['a', 'b', 'c'], areas: ['Clermont', 'Groveland', 'Minneola'] }]);
  assert.equal(qualifiesForServicePage(all, 0), false, 'every town is not a fact about this service');
  const some = site([{ t: 'Roof Repair', included: ['a', 'b', 'c'], areas: ['Clermont'] }]);
  assert.equal(qualifiesForServicePage(some, 0), true);
});

test('blank strings are not facts', () => {
  const c = site([{ t: 'AC Repair', included: ['', ' ', 'x', 'y'], priceFrom: '  ' }]);
  assert.equal(servicePageFacts(c, 0).count, 0);
});

test('pickServicePages keeps the richest services within the page cap, in original order', () => {
  const rich = (t, n) => ({ t, included: ['a', 'b', 'c'], typicalJobs: ['x', 'y'], priceFrom: '$1', brands: n ? ['B'] : [] });
  const c = site([
    { t: 'Thin' },
    rich('Second', false), // 3 facts
    rich('Third', true),   // 4 facts
    rich('Fourth', true),  // 4 facts
  ]);
  assert.deepEqual(pickServicePages(c, 10), [1, 2, 3]);
  assert.deepEqual(pickServicePages(c, 2), [2, 3], 'the two with most facts, in original order');
  assert.deepEqual(pickServicePages(c, 0), []);
});

test('serviceSlug: words only, no "&" or "and", at most 5 words, no dangling stop word', () => {
  assert.equal(serviceSlug({ t: 'Furnace Repair & Replacement' }, []), 'furnace-repair-replacement');
  assert.equal(serviceSlug({ t: 'Heating and Cooling' }, []), 'heating-cooling');
  assert.equal(serviceSlug({ t: 'Full Interior and Exterior Detail With Ceramic Coating' }, []), 'full-interior-exterior-detail');
});

test('serviceSlug: a stored slug wins, so renaming a service keeps its URL', () => {
  assert.equal(serviceSlug({ t: 'AC Repair (Same Day)', slug: 'ac-repair' }, []), 'ac-repair');
});

test('serviceSlug: collisions get -2, -3', () => {
  assert.equal(serviceSlug({ t: 'AC Repair' }, ['ac-repair']), 'ac-repair-2');
  assert.equal(serviceSlug({ t: 'AC Repair' }, ['ac-repair', 'ac-repair-2']), 'ac-repair-3');
});

test('serviceSlug: never empty, never "near me", never a city stuffed in by the slugger', () => {
  assert.equal(serviceSlug({ t: '&&&' }, []), 'service');
  assert.equal(serviceSlug({ t: 'Plumber Near Me' }, []), 'plumber');
});

test('an invalid stored slug is ignored rather than published', () => {
  assert.equal(serviceSlug({ t: 'AC Repair', slug: 'AC Repair!' }, []), 'ac-repair');
});

test('primaryCity: the address locality, then the first service area town, then nothing', async () => {
  const { primaryCity } = await import('../src/lib/servicePages.ts');
  const c = (address, serviceArea = []) => ({ brand: { address }, extensions: { serviceArea } });
  assert.equal(primaryCity(c('123 Main St, Clermont, FL 34711')), 'Clermont');
  // A service-area business hides the street on the site but still stores the full address.
  assert.equal(primaryCity(c('Clermont, FL 34711')), 'Clermont');
  assert.equal(primaryCity(c('', ['Groveland', 'Minneola'])), 'Groveland');
  assert.equal(primaryCity(c('123 Main St', ['Groveland'])), 'Groveland', 'a street alone is not a city');
  assert.equal(primaryCity(c('')), '');
});
