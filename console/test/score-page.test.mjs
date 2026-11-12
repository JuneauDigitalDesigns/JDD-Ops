// scorePage (SEO plan D13, Xander 2026-11-10): one pure scorer for the suite, the Studio and the
// export. Hard failures refuse the export: dashes, invented facts, duplicate titles, a wrong
// canonical, "near me", and a service page that doesn't earn its page or copies another. Preset
// copy and unsupported claims are D2's: a warning, never a refusal.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreSite } from '../src/lib/scorePage.ts';
import { buildPageSeo } from '../src/lib/pageSeo.ts';

const PAGES = [
  { route: '', pageType: 'home', label: 'Home', sections: [{ categoryId: 'hero' }, { categoryId: 'faq' }] },
  { route: 'about', pageType: 'about', label: 'About', sections: [{ categoryId: 'pageHeader' }] },
];

const site = (over = {}) => ({
  brand: { name: 'Peak Air', phone: '(352) 555-0100', address: '12 Main St, Clermont, FL 34711', license: null, established: '2011', tagline: 'Heating and cooling in Clermont.' },
  seo: { title: 'AC & Furnace Repair in Clermont | Peak Air', description: 'Peak Air repairs and installs heating and cooling systems for homes across Clermont and Groveland. Call today to book a visit.', canonical: 'https://peakair.com' },
  extensions: { serviceArea: ['Clermont', 'Groveland'], profiles: [{ kind: 'google', url: 'https://g.page/peak' }], responseTime: 'within 2 hours' },
  hero: { headline: 'AC and furnace repair in Clermont', sub: 'We fix heating and cooling, usually within 2 hours.' },
  about: { body: 'Family business since 2011.' },
  faq: { items: Array.from({ length: 6 }, (_, i) => ({ q: `Question ${'abcdef'[i]}?`, a: 'Yes, we do.' })) },
  services: { items: [] },
  subpages: { about: { header: {}, seo: { title: '', description: 'About Peak Air, a Clermont heating and cooling business. Who we are, how we work, and the towns we cover around Lake County.' } } },
  ...over,
});

const score = (c, pages = PAGES, preset = {}) => scoreSite(c, pages, buildPageSeo(c, pages, 'hvac'), { preset });

test('a clean site has no hard failures', () => {
  const r = score(site());
  assert.deepEqual(r.hard, [], r.hard.join('\n'));
  assert.equal(r.ok, true);
});

test('a dash in visible copy is a hard failure naming the field', () => {
  const r = score(site({ hero: { headline: 'AC repair in Clermont — fast', sub: 'x' } }));
  assert.ok(r.hard.some((h) => /dash/i.test(h) && h.includes('hero.headline')), r.hard.join('\n'));
  assert.equal(r.ok, false);
});

test('a number in generated copy that the facts do not hold is a hard failure', () => {
  const r = score(site({ hero: { headline: 'AC repair in Clermont', sub: 'Rated 4.9 by 300 neighbours, at your door in 45 minutes.' } }));
  const invented = r.hard.filter((h) => /not in the client's facts/.test(h)).join(' ');
  for (const n of ['4.9', '300', '45']) assert.ok(invented.includes(`"${n}"`), `${n} not flagged: ${invented}`);
  assert.ok(!invented.includes('"2"') && !invented.includes('"2011"'), 'facts-backed numbers must pass');
});

test('the same number in unchanged preset text only warns (D2)', () => {
  const preset = { hero: { sub: 'Rated 4.9 by 300 neighbours.' } };
  const r = score(site({ hero: { headline: 'AC repair in Clermont', sub: 'Rated 4.9 by 300 neighbours.' } }), PAGES, preset);
  assert.ok(!r.hard.some((h) => /facts/.test(h)), r.hard.join('\n'));
  assert.ok(r.soft.some((s) => /preset/i.test(s)), 'preset copy must still be reported');
});

test('"near me" is a hard failure', () => {
  const r = score(site({ hero: { headline: 'AC repair near me in Clermont', sub: 'x' } }));
  assert.ok(r.hard.some((h) => /near me/i.test(h)), r.hard.join('\n'));
});

test('two pages with the same title is a hard failure', () => {
  const pages = [...PAGES, { route: 'reviews', pageType: 'reviews', label: 'Reviews', sections: [] }, { route: 'gallery', pageType: 'gallery', label: 'Reviews', sections: [] }];
  const r = score(site(), pages);
  assert.ok(r.hard.some((h) => /Duplicate title/.test(h)), r.hard.join('\n'));
});

test('a canonical that is not an absolute URL is a hard failure; none at all only warns', () => {
  const bad = score(site({ seo: { ...site().seo, canonical: 'peakair.com' } }));
  assert.ok(bad.hard.some((h) => /canonical/i.test(h)), bad.hard.join('\n'));
  const none = score(site({ seo: { ...site().seo, canonical: '' } }));
  assert.ok(!none.hard.some((h) => /canonical/i.test(h)));
  assert.ok(none.soft.some((s) => /canonical/i.test(s)));
});

test('unsupported claims warn, never refuse (D2)', () => {
  const r = score(site({ hero: { headline: 'Same day AC repair in Clermont', sub: 'Licensed and insured.' } }));
  assert.equal(r.hard.length, 0, r.hard.join('\n'));
  assert.ok(r.soft.some((s) => /licensed/.test(s)));
});

test('findings: no city in the home headline (D8), title length, profile links', () => {
  const r = score(site({ hero: { headline: 'Heating and cooling done right', sub: 'x' }, extensions: { serviceArea: ['Clermont'] } }));
  assert.ok(r.soft.some((s) => /city/i.test(s) && /headline/i.test(s)), r.soft.join('\n'));
  assert.ok(r.soft.some((s) => /profile links/i.test(s)), r.soft.join('\n'));
});

// ── False positives from Tracewell's SEO check (2026-11-11): 13 blocking findings, 10 false ──
// brand.phone is stored "4075550177" and the copy writes "Call 407-555-0177", which split into
// "407", "555" and "0177": three blocking findings per mention. And "© 2026 Tracewell Heating &
// Air LLC." in footer.legal flagged the copyright year.
const NOW = new Date('2026-11-11T12:00:00Z');
const tracewell = (over = {}) => site({ brand: { ...site().brand, name: 'Tracewell Heating & Air', phone: '4075550177' }, ...over });
const invented = (c) => scoreSite(c, PAGES, buildPageSeo(c, PAGES, 'hvac'), { now: NOW }).hard.filter((h) => /not in the client's facts/.test(h));

test("the client's own phone, in any common format, is not an invented number", () => {
  for (const written of ['(407) 555-0177', '407-555-0177', '407.555.0177', '+1 407 555 0177', '4075550177', '1-407-555-0177']) {
    const c = tracewell({ hero: { headline: 'AC repair in Clermont', sub: `Call ${written} any time.` } });
    assert.deepEqual(invented(c), [], `"${written}" flagged`);
  }
  // Every Tracewell field that tripped, verbatim shape.
  const c = tracewell({
    hero: { headline: 'AC repair in Clermont', sub: 'x' },
    work: { sub: 'See recent jobs, then call 407-555-0177.' },
    finalCta: { secondary: 'Call 407-555-0177' },
  });
  assert.deepEqual(invented(c), []);
  // phoneHref is a phone fact too.
  const href = site({ brand: { ...site().brand, phone: '', phoneHref: 'tel:+14075550177' }, hero: { headline: 'AC repair in Clermont', sub: 'Call (407) 555-0177.' } });
  assert.deepEqual(invented(href), []);
});

test('a different phone, or a different number, is still flagged', () => {
  const other = invented(tracewell({ hero: { headline: 'AC repair in Clermont', sub: 'Call 407-555-0199 any time.' } })).join(' ');
  assert.ok(other.includes('"407"') && other.includes('"0199"'), other);
  const number = invented(tracewell({ hero: { headline: 'AC repair in Clermont', sub: 'Call 407-555-0177. Over 300 jobs done.' } })).join(' ');
  assert.ok(number.includes('"300"') && !number.includes('"0177"'), number);
});

test('the current year in a copyright line is not a claim; elsewhere it still is', () => {
  for (const legal of ['© 2026 Tracewell Heating & Air LLC.', 'Copyright 2026 Tracewell Heating & Air LLC.', 'Copyright © 2026 Tracewell.']) {
    assert.deepEqual(invented(tracewell({ footer: { legal } })), [], `"${legal}" flagged`);
  }
  const stray = invented(tracewell({ hero: { headline: 'AC repair in Clermont', sub: 'Serving Clermont since 2026.' } })).join(' ');
  assert.ok(stray.includes('"2026"'), 'a bare 2026 outside a copyright line must still be flagged');
  const mixed = invented(tracewell({ footer: { legal: '© 2026 Tracewell. Rated best of 2026.' } }));
  assert.equal(mixed.length, 1, mixed.join('\n'));
  const other = invented(tracewell({ footer: { legal: '© 2019 Tracewell Heating & Air LLC.' } })).join(' ');
  assert.ok(other.includes('"2019"'), 'only the current year is exempt');
});

const servicePage = { route: 'services/drain-cleaning', pageType: 'service', label: 'Drain Cleaning', sections: [] };
const servicePage2 = { route: 'services/water-heaters', pageType: 'service', label: 'Water Heaters', sections: [] };
const shared = 'We clear kitchen sinks, shower drains and main lines with a camera and a jetter, then we show you what we found.';

test('a service page whose service does not earn a page is a hard failure', () => {
  const c = site({ services: { items: [{ t: 'Drain Cleaning', slug: 'drain-cleaning' }] } });
  const r = score(c, [...PAGES, servicePage]);
  assert.ok(r.hard.some((h) => /does not have enough facts/.test(h)), r.hard.join('\n'));
});

test('two service pages sharing an 8-word run is a hard failure', () => {
  const svc = (t, slug) => ({ t, slug, included: ['a', 'b', 'c'], priceFrom: '$99', page: { intro: shared, faq: [] } });
  const c = site({ services: { items: [svc('Drain Cleaning', 'drain-cleaning'), svc('Water Heaters', 'water-heaters')] } });
  const r = score(c, [...PAGES, servicePage, servicePage2]);
  assert.ok(r.hard.some((h) => /shares an 8-word run/.test(h)), r.hard.join('\n'));
});
