// lib/search-profile.js: what the nightly Search Console job is told about one site.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSearchProfile, serviceTerms, normalizeTerm, searchProfileKey } from '../lib/search-profile.js';
import { accountScope } from '../lib/account-store.js';

const img = { url: '/img/a', alt: 'x' };
const content = {
  brand: { address: '12 Main St, Clermont, FL 34711' },
  extensions: { serviceArea: ['Clermont', 'Minneola', 'Winter Garden'] },
  services: { items: [
    { t: 'AC Repair', d: 'x', typicalJobs: ['AC not cooling', 'Thermostat replacement'] },
    { t: 'Duct Cleaning near me', d: 'x' },
  ] },
  work: { projects: [
    { town: 'Minneola', image: img, service: 'ac-repair' },
    { town: 'minneola', image: img, service: 'ac-repair' },
    { town: 'Clermont', image: img },
  ] },
  testimonials: { items: [{ town: 'Minneola', q: 'Great' }] },
  areaPages: [{ town: 'Minneola', slug: 'minneola', spokes: ['ac-repair'] }],
};

test('the key is scoped by account, as every agency key with client data is', () => {
  assert.equal(searchProfileKey(accountScope('Owner@Example.com '), 'acme'), `jdd:seo:profile:v1:${accountScope('owner@example.com')}:acme`);
});

test('the main city is named and never a hub (L4); a town with 3 facts of 2 kinds is (L6)', () => {
  const p = buildSearchProfile(content, { siteSlug: 'acme', property: 'https://acme.vercel.app/', verifiedAt: '2026-11-13T00:00:00.000Z' });
  assert.equal(p.mainCity, 'Clermont');
  const byName = Object.fromEntries(p.towns.map((t) => [t.name, t]));
  assert.equal(byName.Clermont.hub, false);
  assert.equal(byName.Minneola.hub, true);
  assert.equal(byName.Minneola.facts, 3);
  assert.equal(byName['Winter Garden'].slug, 'winter-garden');
  assert.deepEqual(p.sharedFacts, { 'Minneola|ac-repair': 2 });
});

test('service terms carry the customer\'s words and drop "near me"', () => {
  assert.deepEqual(serviceTerms(content.services.items[0], 'ac-repair'), ['ac repair', 'ac not cooling', 'thermostat replacement']);
  assert.deepEqual(serviceTerms(content.services.items[1], 'duct-cleaning'), ['duct cleaning']);
  assert.equal(normalizeTerm('Café & Grill’s'), 'cafe and grills');
});

test('a re-export keeps the property, the verification time and each spoke\'s fold clock', () => {
  const first = buildSearchProfile(content, { siteSlug: 'acme', property: 'https://acme.vercel.app/', verifiedAt: '2026-11-13T00:00:00.000Z', now: new Date('2026-11-13T00:00:00Z') });
  const later = buildSearchProfile(content, { siteSlug: 'acme', previous: first, now: new Date('2027-03-01T00:00:00Z') });
  assert.equal(later.property, 'https://acme.vercel.app/');
  assert.equal(later.verifiedAt, '2026-11-13T00:00:00.000Z');
  assert.deepEqual(later.spokes, [{ town: 'Minneola', service: 'ac-repair', since: '2026-11-13T00:00:00.000Z' }]);
  assert.equal(later.updatedAt, '2027-03-01T00:00:00.000Z');
});
