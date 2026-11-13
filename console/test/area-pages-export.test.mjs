// Local SEO 5a (Xander's decisions of 2026-11-12, local-seo-architecture-decisions.md):
//   L2  town pages at /areas/<town>, spokes at /areas/<town>/<service>
//   L3  a URL the site stops serving gets a permanent redirect, kept for good
//   L4  never a town page or spoke for the main city
//   L5  the Services page title is "All {Trade} Services | {Brand}"
//   L6  a town page only for a town with real local facts (the @jdd/schema gate)
//   L14 caps per page type: service 11, town 10, spoke 15
// The gate itself is @jdd/schema's and is tested there; this pins how the console turns it into
// routes, page files, titles, structured data, the sitemap list and redirects.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isValidRoute, validateComposition, capFor, MAX_PAGES } from '../src/lib/pages.ts';
import { chosenAreaPages, chosenSpokePages, areaPageRefs } from '../src/app/c/[slug]/build/area-page-sync.ts';
import { syncAreaPages, areaPageRoutes, VERTICAL_TEMPLATES } from '../src/app/c/[slug]/build/vertical-templates.tsx';
import { sectionSlugAttrs, AREA_PAGE_SECTIONS } from '../src/lib/areaPageSections.ts';
import { buildPageSeo } from '../src/lib/pageSeo.ts';
import { scoreSite } from '../src/lib/scorePage.ts';
import { planRedirects, fallbackFor, writeRedirects, ledgerPath } from '../src/lib/redirects.ts';
import { writeCompositionManifest } from '../src/lib/composition-manifest.ts';

const photo = (town, extra = {}) => ({ t: '', loc: town, yr: null, scope: '', size: '', caption: `Job in ${town}`, image: { url: `/img/${town}-${Math.round(Math.random() * 1e9)}`, alt: town }, town, ...extra });
// A review of realistic length. A four-word one left the spoke below the 40% local share once its two
// approved link lines were counted (2026-11-12), which is the share measuring honestly, not a gate.
const review = (town, extra = {}) => ({ q: 'They found the frozen coil on our old unit and had the whole house cool again by dinner.', a: 'Dana P.', r: '', stars: 5, town, ...extra });

// Clermont is the main city (the address). Minneola has 2 photos + 1 review (a page). Groveland
// has 3 photos only (one kind: no page). The AC Repair spoke in Minneola has 2 shared facts.
const content = (over = {}) => ({
  brand: { name: 'Peak Air', address: '12 Main St, Clermont, FL 34711', phone: '(352) 555-0100' },
  seo: { title: '', description: 'Home.', canonical: 'https://peakair.com' },
  services: { items: [
    { t: 'AC Repair', slug: 'ac-repair', d: 'Cool again fast.', included: ['Diagnosis', 'Refrigerant check', 'Repair'], priceFrom: '$89' },
    { t: 'Duct Cleaning', slug: 'duct-cleaning', d: 'Cleaner air.' },
  ] },
  extensions: { serviceArea: ['Clermont', 'Minneola', 'Groveland'] },
  testimonials: { items: [review('Minneola', { service: 'ac-repair' })] },
  work: { projects: [photo('Minneola', { service: 'ac-repair' }), photo('Minneola'), photo('Groveland'), photo('Groveland'), photo('Groveland'), photo('Clermont'), photo('Clermont'), review('Clermont')].filter((x) => x.image) },
  faq: { items: [] },
  areaCopy: { minneola: { intro: 'We work in Minneola every week. Call to book a visit.', spokes: { 'ac-repair': { intro: 'We repair AC units in Minneola. Book online or call.' } } } },
  ...over,
});
const S = (categoryId, name) => ({ categoryId, name });
const page = (route, pageType, label, sections = [S('pageHeader', 'X'), S('trust', 'Y')]) => ({ route, pageType, label, templateId: 't', navVisible: false, sections });
const comp = (pages) => ({ chrome: { nav: S('nav', 'N'), footer: S('footer', 'F'), seo: S('seo', 'O') }, pages: [page('', 'home', 'Home', [S('hero', 'H')]), ...pages] });

test('L2: routes for town pages and spokes are valid; a third segment only under /areas', () => {
  assert.equal(isValidRoute('areas'), true);
  assert.equal(isValidRoute('areas/minneola'), true);
  assert.equal(isValidRoute('areas/minneola/ac-repair'), true);
  assert.equal(isValidRoute('services/ac-repair/minneola'), false);
  assert.equal(isValidRoute('areas/minneola/ac-repair/x'), false);
  assert.equal(isValidRoute('api/minneola'), false);
});

test('L14: each kind of page has its own cap, no longer one cap of 16 for everything', () => {
  assert.equal(capFor('service'), 11);
  assert.equal(capFor('area'), 10);
  assert.equal(capFor('spoke'), 15);
  assert.ok(MAX_PAGES >= 4 + 11 + 10 + 15);
  const svc = (n) => Array.from({ length: n }, (_, i) => page(`services/s${i}`, 'service', `S${i}`));
  const towns = (n) => Array.from({ length: n }, (_, i) => page(`areas/t${i}`, 'area', `T${i}`));
  assert.doesNotThrow(() => validateComposition(comp([page('services', 'services', 'Services'), ...svc(11), ...towns(10)])));
  assert.throws(() => validateComposition(comp(svc(12))), /at most 11 service pages/);
  assert.throws(() => validateComposition(comp(towns(11))), /at most 10 town pages/);
});

test('L4 + L6: the gate picks the towns; never the main city, never a one-kind town', () => {
  assert.deepEqual(chosenAreaPages(content()), [{ town: 'Minneola', slug: 'minneola' }]);
});

test('a spoke needs an approval AND the facts; no approval, no spoke', () => {
  assert.deepEqual(chosenSpokePages(content(), []), []);
  assert.deepEqual(chosenSpokePages(content(), [{ town: 'minneola', service: 'ac-repair' }]), [
    { town: 'Minneola', townSlug: 'minneola', service: 'ac-repair', label: 'AC Repair' },
  ]);
  // Approved, but Duct Cleaning has no page and no shared facts; Clermont is the main city.
  assert.deepEqual(chosenSpokePages(content(), [{ town: 'Minneola', service: 'duct-cleaning' }, { town: 'Clermont', service: 'ac-repair' }]), []);
});

test('content.areaPages lists the town pages that exist, with their spokes', () => {
  const c = comp([page('areas/minneola', 'area', 'Minneola'), page('areas/minneola/ac-repair', 'spoke', 'AC Repair'), page('areas/nowhere', 'area', 'Nowhere')]);
  assert.deepEqual(areaPageRefs(c, content()), [{ town: 'Minneola', slug: 'minneola', spokes: ['ac-repair'] }]);
});

test('syncAreaPages leaves a non-template site alone, and adds, keeps and removes a vertical\'s town pages', () => {
  // A composition that isn't a vertical template has no town page sections to build from.
  const custom = comp([]);
  assert.equal(syncAreaPages(custom, [{ town: 'Minneola', slug: 'minneola' }], []), custom);
  // Every vertical has its town pages since Templates built them (Xander approved the mockups
  // "HVAC Town Pages", 2026-11-12; test/town-pages.test.mjs pins the sections themselves).
  const hvacish = VERTICAL_TEMPLATES.hvac.build(); // a real HVAC composition, so templateIdFor recognises it
  const added = syncAreaPages(hvacish, [{ town: 'Minneola', slug: 'minneola' }], [{ townSlug: 'minneola', service: 'ac-repair', label: 'AC Repair' }, { townSlug: 'groveland', service: 'ac-repair', label: 'AC Repair' }]);
  assert.notEqual(added, hvacish);
  assert.deepEqual(areaPageRoutes(added), ['areas', 'areas/minneola', 'areas/minneola/ac-repair'], 'index, town page, and only the spoke under a live town page');
  const town = added.pages.find((p) => p.route === 'areas/minneola');
  assert.equal(town.pageType, 'area');
  assert.equal(town.label, 'Minneola');
  assert.equal(town.navVisible, false);
  const again = syncAreaPages(added, [{ town: 'Minneola', slug: 'minneola' }], []);
  assert.equal(again.pages.find((p) => p.route === 'areas/minneola'), town, 'an existing page is kept as it is');
  assert.deepEqual(areaPageRoutes(again), ['areas', 'areas/minneola']);
  const gone = syncAreaPages(again, [], []);
  assert.deepEqual(areaPageRoutes(gone), [], 'the auto-added index leaves with the last town page');
});

test('page files hand town sections their town, and a spoke\'s CTA its service', () => {
  assert.equal(sectionSlugAttrs({ pageType: 'area', route: 'areas/minneola' }, 'HvacTownBody'), ' townSlug="minneola"');
  assert.equal(sectionSlugAttrs({ pageType: 'spoke', route: 'areas/minneola/ac-repair' }, 'HvacTownHeader'), ' townSlug="minneola" serviceSlug="ac-repair"');
  assert.equal(sectionSlugAttrs({ pageType: 'areas', route: 'areas' }, 'HvacTownHeader'), '', 'the /areas index names no town');
  assert.equal(sectionSlugAttrs({ pageType: 'spoke', route: 'areas/minneola/ac-repair' }, 'HvacFinalCta'), ' serviceSlug="ac-repair"');
  assert.equal(sectionSlugAttrs({ pageType: 'area', route: 'areas/minneola' }, 'HvacFinalCta'), '');
  assert.equal(sectionSlugAttrs({ pageType: 'about', route: 'about' }, 'HvacFinalCta'), '');
});

const seoPages = (withIndex = true) => [
  { route: '', pageType: 'home', label: 'Home', sections: [{ categoryId: 'hero' }] },
  { route: 'services', pageType: 'services', label: 'Services', sections: [] },
  ...(withIndex ? [{ route: 'areas', pageType: 'areas', label: 'Service Areas', sections: [] }] : []),
  { route: 'areas/minneola', pageType: 'area', label: 'Minneola', sections: [] },
  { route: 'areas/minneola/ac-repair', pageType: 'spoke', label: 'AC Repair', sections: [] },
];

test('L5 and the approved town patterns: titles, canonicals and descriptions', () => {
  const s = buildPageSeo(content(), seoPages(), 'hvac');
  assert.equal(s.services.title, 'All HVAC Services | Peak Air');
  assert.equal(s['areas/minneola'].title, 'HVAC in Minneola | Peak Air');
  assert.equal(s['areas/minneola/ac-repair'].title, 'AC Repair in Minneola | Peak Air');
  assert.equal(s['areas/minneola'].canonical, 'https://peakair.com/areas/minneola', 'self canonical, so the sitemap lists it');
  assert.equal(s['areas/minneola/ac-repair'].canonical, 'https://peakair.com/areas/minneola/ac-repair');
  assert.equal(s['areas/minneola'].description, 'We work in Minneola every week.');
  assert.match(s['areas/minneola'].ogImage ?? '', /Minneola/, "a town page's social image is its own job there");
});

test('breadcrumbs follow "Home › Areas › {Town} › {Service}"; Areas only when the index exists', () => {
  const crumbs = (s, r) => s[r].jsonLd.find((n) => n['@type'] === 'BreadcrumbList').itemListElement.map((i) => i.name);
  const s = buildPageSeo(content(), seoPages(), 'hvac');
  assert.deepEqual(crumbs(s, 'areas/minneola'), ['Home', 'Areas', 'Minneola']);
  assert.deepEqual(crumbs(s, 'areas/minneola/ac-repair'), ['Home', 'Areas', 'Minneola', 'AC Repair']);
  const noIndex = buildPageSeo(content(), seoPages(false), 'hvac');
  assert.deepEqual(crumbs(noIndex, 'areas/minneola/ac-repair'), ['Home', 'Minneola', 'AC Repair']);
});

test('a spoke marks up this service in this one town, with no price and no FAQ it does not show', () => {
  const s = buildPageSeo(content(), seoPages(), 'hvac');
  const svc = s['areas/minneola/ac-repair'].jsonLd.find((n) => n['@type'] === 'Service');
  assert.deepEqual(svc.areaServed, [{ '@type': 'Place', name: 'Minneola' }]);
  assert.equal(svc.offers, undefined);
  assert.equal(s['areas/minneola/ac-repair'].jsonLd.some((n) => n['@type'] === 'FAQPage'), false);
  assert.deepEqual(s['areas/minneola'].jsonLd.map((n) => n['@type']), ['BreadcrumbList'], 'a town page: breadcrumb only, no LocalBusiness of its own');
});

test('L4/L6 at export: a main-city town page, a thin town page and an unqualified spoke are refused', () => {
  const pages = [
    { route: '', pageType: 'home', label: 'Home', sections: [] },
    { route: 'areas/clermont', pageType: 'area', label: 'Clermont', sections: [] },
    { route: 'areas/groveland', pageType: 'area', label: 'Groveland', sections: [] },
    { route: 'areas/minneola', pageType: 'area', label: 'Minneola', sections: [] },
    { route: 'areas/minneola/duct-cleaning', pageType: 'spoke', label: 'Duct Cleaning', sections: [] },
    { route: 'areas/minneola/ac-repair', pageType: 'spoke', label: 'AC Repair', sections: [] },
  ];
  const { hard } = scoreSite(content(), pages, buildPageSeo(content(), pages, 'hvac'));
  const areaHard = hard.filter((h) => /areas\//.test(h) && !/Duplicate|description|title/i.test(h));
  assert.ok(areaHard.some((h) => h.includes('/areas/clermont') && h.includes('main city')));
  assert.ok(areaHard.some((h) => h.includes('/areas/groveland') && h.includes('local facts')));
  assert.ok(areaHard.some((h) => h.includes('/areas/minneola/duct-cleaning')));
  assert.ok(!areaHard.some((h) => h.includes('/areas/minneola ') || h.includes('/areas/minneola/ac-repair')), 'the qualifying town page and spoke pass');
});

test('L3: every URL the site stops serving redirects to the closest live page, with no chains', () => {
  const live = new Set(['', 'services', 'areas', 'areas/minneola', 'services/ac-repair']);
  assert.equal(fallbackFor('areas/minneola/duct-cleaning', live), '/areas/minneola');
  assert.equal(fallbackFor('areas/groveland/ac-repair', live), '/services/ac-repair');
  assert.equal(fallbackFor('areas/groveland', live), '/areas');
  assert.equal(fallbackFor('areas/groveland', new Set([''])), '/');
  assert.equal(fallbackFor('services/old-name', live), '/services');
  assert.equal(fallbackFor('gallery', live), '/');

  const operator = { source: '/old-blog', destination: '/', permanent: true };
  const { redirects, published } = planRedirects(['services', 'areas/groveland', 'areas/minneola'], ['', 'services', 'areas/minneola'], [operator, { source: '/areas/minneola', destination: '/', permanent: true }]);
  assert.deepEqual(redirects, [operator, { source: '/areas/groveland', destination: '/', permanent: true }], 'the operator\'s redirect is kept; a live page loses its old redirect');
  assert.deepEqual(published, ['areas/groveland', 'areas/minneola', 'services'], 'the ledger only grows');
});

test('L3 on disk: vercel.json keeps its other keys and the operator\'s redirects across re-exports', () => {
  const dir = mkdtempSync(join(tmpdir(), 'jdd-redirects-'));
  try {
    writeFileSync(join(dir, 'vercel.json'), JSON.stringify({ cleanUrls: true, redirects: [{ source: '/old-blog', destination: '/', permanent: true }] }));
    // The previous export served a town page and a spoke (the manifest records it).
    writeCompositionManifest(dir, comp([page('areas/groveland', 'area', 'Groveland'), page('areas/groveland/ac-repair', 'spoke', 'AC Repair')]));
    writeRedirects(dir, comp([page('services', 'services', 'Services'), page('services/ac-repair', 'service', 'AC Repair')]));
    const v1 = JSON.parse(readFileSync(join(dir, 'vercel.json'), 'utf8'));
    assert.equal(v1.cleanUrls, true);
    assert.deepEqual(v1.redirects, [
      { source: '/old-blog', destination: '/', permanent: true },
      { source: '/areas/groveland', destination: '/', permanent: true },
      { source: '/areas/groveland/ac-repair', destination: '/services/ac-repair', permanent: true },
    ]);
    assert.ok(existsSync(ledgerPath(dir)));
    // Re-export with Groveland's page back: its redirect goes (it would hide the page); the spoke's stays.
    writeCompositionManifest(dir, comp([page('services', 'services', 'Services')]));
    writeRedirects(dir, comp([page('areas/groveland', 'area', 'Groveland')]));
    const v2 = JSON.parse(readFileSync(join(dir, 'vercel.json'), 'utf8'));
    assert.deepEqual(v2.redirects.map((r) => `${r.source}>${r.destination}`), ['/old-blog>/', '/areas/groveland/ac-repair>/areas/groveland', '/services>/', '/services/ac-repair>/']);
    // A broken vercel.json stops the export rather than being overwritten.
    writeFileSync(join(dir, 'vercel.json'), '{ not json');
    assert.throws(() => writeRedirects(dir, comp([])), /not valid JSON/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a fresh repo with nothing gone writes no vercel.json at all', () => {
  const dir = mkdtempSync(join(tmpdir(), 'jdd-redirects-'));
  try {
    mkdirSync(join(dir, '.studio'), { recursive: true });
    writeRedirects(dir, comp([page('services', 'services', 'Services')]));
    assert.equal(existsSync(join(dir, 'vercel.json')), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
