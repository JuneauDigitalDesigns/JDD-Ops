// Per-page metadata and structured data (Xander's SEO decisions D7, D9, D10, 2026-11-10).
// What shipped on e2etestgrowth: About, Services and Contact all titled "Your HVAC Co.", all
// described "Comfort in every season.", all with a canonical pointing at HOME, a sitemap listing
// home only, and every page carrying the whole graph (generic LocalBusiness, every FAQ, every
// Service, 3 self-published Review nodes built from sample quotes).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPageSeo, businessNode, seoPagesSource, BUSINESS_TYPES } from '../src/lib/pageSeo.ts';

const content = (over = {}) => ({
  brand: { name: 'Peak Air', long: 'Peak Air Heating & Cooling', phone: '(352) 555-0100', email: 'hi@peak.com', address: '12 Main St, Clermont, FL 34711', established: null, license: null },
  seo: { title: 'Furnace & AC Repair in Clermont | Peak Air', description: 'Home description.', canonical: 'https://peakair.com' },
  extensions: { serviceArea: ['Clermont', 'Groveland'], hours: { all: 'Mon-Fri 8am - 5pm' }, profiles: [{ kind: 'google', url: 'https://maps.app.goo.gl/x' }, { kind: 'facebook', url: 'https://facebook.com/peakair' }], reviewBadge: { rating: 4.9, count: 120, url: '' } },
  services: { items: [
    { t: 'Furnace Repair', slug: 'furnace-repair', d: 'Heat back on fast.', priceFrom: '$89', areas: ['Clermont'], page: { intro: 'We fix furnaces in Clermont. Call to book.', faq: [{ q: 'How fast?', a: 'Usually today.' }] } },
    { t: 'AC Installation', d: 'New systems sized right.' },
  ] },
  faq: { items: [{ q: 'Do you service all brands?', a: 'Yes.' }] },
  testimonials: { items: [{ q: 'Great', a: 'Dana P.', r: 'Clermont', stars: 5 }] },
  subpages: {
    about: { header: {}, seo: { title: 'ignored', description: 'About description.' } },
    'services/furnace-repair': { header: {}, seo: { title: 'ignored', description: 'Furnace page description.' } },
  },
  images: { hero: { slides: [{ url: '/img/abc123', alt: 'Truck' }] } },
  ...over,
});

const pages = [
  { route: '', pageType: 'home', label: 'Home', sections: [{ categoryId: 'hero' }, { categoryId: 'faq' }] },
  { route: 'services', pageType: 'services', label: 'Services', sections: [{ categoryId: 'pageHeader' }, { categoryId: 'faq' }] },
  { route: 'about', pageType: 'about', label: 'About', sections: [{ categoryId: 'pageHeader' }] },
  { route: 'contact', pageType: 'contact', label: 'Contact', sections: [{ categoryId: 'pageHeader' }] },
  { route: 'services/furnace-repair', pageType: 'service', label: 'Furnace Repair', sections: [] },
];

test('D7 title patterns, one per page type', () => {
  const s = buildPageSeo(content(), pages, 'hvac');
  assert.equal(s[''].title, 'Furnace & AC Repair in Clermont | Peak Air', 'a generated home title in the approved form is kept');
  assert.equal(s.services.title, 'All HVAC Services | Peak Air', 'L5 (Xander, 2026-11-12): no city, so it stops overlapping home');
  assert.equal(s.about.title, 'About Peak Air | HVAC in Clermont');
  assert.equal(s.contact.title, 'Contact Peak Air | Clermont HVAC');
  assert.equal(s['services/furnace-repair'].title, 'Furnace Repair in Clermont | Peak Air');
});

test('a home title not in the approved form falls back to the pattern', () => {
  const s = buildPageSeo(content({ seo: { title: 'Your HVAC Company | Heating & Cooling Service', description: 'd', canonical: 'https://peakair.com' } }), pages, 'hvac');
  assert.equal(s[''].title, 'HVAC in Clermont | Peak Air');
});

test('without a city the city parts drop out', () => {
  const s = buildPageSeo(content({ brand: { name: 'Peak Air', address: '', phone: '' }, extensions: {} }), pages, 'hvac');
  assert.equal(s.services.title, 'All HVAC Services | Peak Air');
  assert.equal(s.about.title, 'About Peak Air | HVAC');
  assert.equal(s.contact.title, 'Contact Peak Air | HVAC');
  assert.equal(s['services/furnace-repair'].title, 'Furnace Repair | Peak Air');
});

test('every page has its own absolute canonical (never home), and its own description', () => {
  const s = buildPageSeo(content(), pages, 'hvac');
  assert.equal(s[''].canonical, 'https://peakair.com');
  assert.equal(s.about.canonical, 'https://peakair.com/about');
  assert.equal(s['services/furnace-repair'].canonical, 'https://peakair.com/services/furnace-repair');
  assert.equal(s.about.description, 'About description.');
  assert.equal(s['services/furnace-repair'].description, 'Furnace page description.');
  assert.equal(new Set(Object.values(s).map((p) => p.canonical)).size, pages.length);
  const none = buildPageSeo(content({ seo: { title: '', description: '', canonical: '' } }), pages, 'hvac');
  assert.equal(none.about.canonical, '', 'no base URL means no canonical, never a relative one');
});

test('D10: one business node of the vertical type, Twilio phone, sameAs, no self-published reviews', () => {
  const b = businessNode(content(), 'hvac');
  assert.equal(b['@type'], 'HVACBusiness');
  assert.equal(b['@id'], 'https://peakair.com#business');
  assert.equal(b.telephone, '(352) 555-0100');
  assert.deepEqual(b.sameAs, ['https://maps.app.goo.gl/x', 'https://facebook.com/peakair']);
  assert.equal(b.address.streetAddress, '12 Main St');
  assert.ok(!('aggregateRating' in b) && !('review' in b), 'self-published ratings are ineligible (Google review-snippet policy)');
  assert.deepEqual(BUSINESS_TYPES, { hvac: 'HVACBusiness', plumbing: 'Plumber', roofing: 'RoofingContractor', 'car-detailing': 'AutoWash', 'lawn-care': 'HomeAndConstructionBusiness', health: 'LocalBusiness' });
});

test('a service-area business never shows its street, in visible text or JSON-LD', () => {
  const b = businessNode(content({ extensions: { serviceAreaBusiness: true, serviceArea: ['Clermont'] } }), 'hvac');
  assert.equal(b.address.streetAddress, undefined);
  assert.equal(b.address.addressLocality, 'Clermont');
  assert.equal(b.address.addressRegion, 'FL');
  assert.equal(b.address.postalCode, '34711');
});

test('page nodes live on their own page: breadcrumbs, FAQ only where shown, Service on its page', () => {
  const s = buildPageSeo(content(), pages, 'hvac');
  const types = (r) => s[r].jsonLd.map((n) => n['@type']);
  assert.deepEqual(types(''), ['FAQPage'], 'home: its FAQ only; the business node is site-wide');
  assert.deepEqual(types('about'), ['BreadcrumbList'], 'no FAQ section on About, so no FAQPage');
  assert.deepEqual(types('services'), ['BreadcrumbList', 'FAQPage']);
  assert.deepEqual(types('services/furnace-repair'), ['BreadcrumbList', 'Service', 'FAQPage']);
  const svc = s['services/furnace-repair'].jsonLd.find((n) => n['@type'] === 'Service');
  assert.deepEqual(svc.provider, { '@id': 'https://peakair.com#business' });
  assert.deepEqual(svc.areaServed, [{ '@type': 'Place', name: 'Clermont' }], 'own towns only');
  assert.equal(svc.offers.priceSpecification.minPrice, 89);
  const crumbs = s['services/furnace-repair'].jsonLd[0].itemListElement.map((i) => i.name);
  assert.deepEqual(crumbs, ['Home', 'Services', 'Furnace Repair']);
  for (const r of Object.keys(s)) assert.ok(!s[r].jsonLd.some((n) => n['@type'] === 'Review'), `${r}: Review node`);
});

test('og image is the page image, else the hero, as a localized path', () => {
  const s = buildPageSeo(content(), pages, 'hvac');
  assert.equal(s.about.ogImage, '/img/abc123-1536.webp');
});

test('seoPagesSource is a typed module the client repo can import', () => {
  const src = seoPagesSource(buildPageSeo(content(), pages, 'hvac'), businessNode(content(), 'hvac'));
  assert.match(src, /export interface PageSeo \{/);
  assert.match(src, /export const PAGE_SEO: Record<string, PageSeo> = \{/);
  assert.match(src, /export const BUSINESS_JSONLD: Record<string, unknown> \| null = \{/);
  assert.ok(!src.includes('</script'), 'the data must not be able to close a script tag');
});
