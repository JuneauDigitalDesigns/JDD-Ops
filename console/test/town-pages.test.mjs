// Town pages (/areas/<town>), town + service pages (/areas/<town>/<service>) and the /areas index,
// built as Xander approved the mockups "HVAC Town Pages" on 2026-11-12 ("Build as shown", wording
// T1 to T5 approved word for word, and "drop the extra word" for the doubled "service"). With the
// service page additions he approved the same day: "What affects the price" and
// "{Service} in nearby towns".
//
// The rules these pin, each one a way the page could quietly become a doorway page:
// - the page says only what is tagged to the town: its job photos (the client's caption and the
//   town), its reviews, its sourced notes, the services with pages, and one generated intro;
// - every body block carries a data-src marker and no body text sits outside one, so the local
//   SEO lead's built-HTML check can prove it (and the 40% share in scorePage.ts counts exactly
//   what is drawn);
// - each section is hidden when it has no data, and a page that isn't in content.areaPages
//   renders nothing at all;
// - links go only to pages that exist: a spoke only when areaPages lists it.
// Every trade's real components are rendered.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { areaPageFacts, spokePageFacts, canonicalTown as schemaCanonicalTown } from '@jdd/schema';

import { CONTENT as HVAC } from '../src/data/verticals/hvac.ts';
import { localShare } from '../src/lib/scorePage.ts';
import { TRADE_LABELS, buildPageSeo } from '../src/lib/pageSeo.ts';
import { AREA_PAGE_SECTIONS, sectionSlugAttrs } from '../src/lib/areaPageSections.ts';
import { VERTICAL_TEMPLATES, syncAreaPages } from '../src/app/c/[slug]/build/vertical-templates.tsx';
import {
  AREA_WORDS, aboutOurService, canonicalTown, townJobs, townReviews, townNotes,
} from '../src/lib/townLinks.ts';

// tsx compiles JSX to classic React.createElement calls (see lead-form-prefill.test.mjs).
globalThis.React = React;

const CONSOLE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OPS = path.resolve(CONSOLE, '..');
const read = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const decode = (s) => s.replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&rsaquo;|›/g, '›');
const text = (html) => decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const words = (s) => s.toLowerCase().replace(/[^a-z0-9'\s]+/g, ' ').split(/\s+/).filter(Boolean);

/** vertical id -> the catalog prefix of its components. */
const TRADES = { hvac: 'Hvac', roofing: 'Roofing', plumbing: 'Plumbing', 'lawn-care': 'Lawn', 'car-detailing': 'Detail' };
const SLUG = 'ac-installation-service';

/** Tracewell, main city Winter Park, with Maitland facts: 2 job photos (one of them AC), 1 review,
 *  1 sourced note and 1 note with no source (which must never show). Oviedo has a page too. */
function tracewell(over = {}) {
  const c = structuredClone(HVAC);
  c.brand = { ...c.brand, name: 'Tracewell Heating & Air', address: '120 Park Ave, Winter Park, FL 32789', phone: '(407) 555-0177', phoneHref: 'tel:+14075550177' };
  c.services.items = [
    { n: '01', t: 'AC Installation & Service', tag: 'Cooling', slug: SLUG, image: { url: '/img/aaaaaaaaaaaaaaaa', alt: 'AC' }, priceFactors: ['The size of the home', 'How hard the unit is to reach'] },
    { n: '02', t: 'Furnace Repair', tag: 'Heating', slug: 'furnace-repair', image: { url: '/img/bbbbbbbbbbbbbbbb', alt: 'Furnace' } },
    { n: '03', t: 'Duct Sealing', tag: 'Air', slug: 'duct-sealing' }, // no page: never listed
  ];
  c.servicePages = [SLUG, 'furnace-repair'];
  c.extensions = { ...c.extensions, serviceArea: ['Winter Park', 'Maitland', 'Oviedo', 'Orlando'], townNotes: [
    { town: 'maitland', text: 'Maitland requires a permit for every new condenser.', sourceUrl: 'https://www.itsmymaitland.com/permits' },
    { town: 'Maitland', text: 'A note with no source must never show.', sourceUrl: '' },
  ] };
  c.work = { ...c.work, projects: [
    { t: '', loc: 'Maitland', caption: 'Condenser swap beside the lake', image: { url: '/img/1111111111111111', alt: 'Condenser' }, town: 'Maitland', service: SLUG },
    { t: '', loc: 'Maitland', caption: 'Attic return sealed', image: { url: '/img/2222222222222222', alt: 'Attic' }, town: 'Maitland', service: 'duct-sealing' },
    { t: '', loc: 'Oviedo', caption: 'Oviedo job', image: { url: '/img/3333333333333333', alt: 'Oviedo' }, town: 'Oviedo', service: SLUG },
    { t: '', loc: 'Maitland', caption: 'No photo, no job', image: { url: '' }, town: 'Maitland' },
  ] };
  c.testimonials = { ...c.testimonials, items: [
    { q: 'On time and the new system is quiet.', a: 'Dana P.', r: 'Maitland', stars: 5, town: 'Maitland', service: SLUG },
    { q: 'Great in Oviedo.', a: 'Lee R.', r: '', stars: 5, town: 'Oviedo' },
  ] };
  c.areaPages = [{ town: 'Maitland', slug: 'maitland', spokes: [SLUG] }, { town: 'Oviedo', slug: 'oviedo', spokes: [] }];
  c.areaCopy = {
    maitland: { intro: 'Tracewell installs and repairs heating and cooling in Maitland. Call to book a visit.', spokes: { [SLUG]: { intro: 'We install central air in Maitland. Call to book a visit.' } } },
  };
  return { ...c, ...over };
}

async function render(rel, props) {
  const mod = await import(`../src/components/catalog/${rel}`);
  return renderToStaticMarkup(React.createElement(mod.default, props));
}
const header = (p, props) => render(`pageHeader/${p}TownHeader.tsx`, props);
const body = (p, props) => render(`trust/${p}TownBody.tsx`, props);

/** The HTML with every data-src block cut out: what the built-HTML check sees as unmarked. */
function unmarked(html) {
  let out = html;
  for (;;) {
    const m = /<(section|div|aside|ul|figure|p)\b[^>]*\bdata-src="[a-z]+"[^>]*>/.exec(out);
    if (!m) return out;
    // Cut from the opening tag to its matching close (same tag name, nesting-aware).
    const tag = m[1];
    const re = new RegExp(`<${tag}\\b[^>]*>|</${tag}>`, 'g');
    re.lastIndex = m.index;
    let depth = 0;
    let end = out.length;
    for (let x; (x = re.exec(out)); ) {
      depth += x[0].startsWith('</') ? -1 : 1;
      if (depth === 0) { end = x.index + x[0].length; break; }
    }
    out = out.slice(0, m.index) + out.slice(end);
  }
}

// ── The shared helpers ─────────────────────────────────────────────────────────

test('townLinks.ts and TownPage.tsx are byte-identical in the console and the template', () => {
  for (const f of ['townLinks.ts', 'TownPage.tsx']) {
    assert.equal(read(path.join(OPS, 'template/src/lib', f)), read(path.join(CONSOLE, 'src/lib', f)), f);
  }
});

test('the client-side fact helpers count exactly what the @jdd/schema gate counts', () => {
  const c = tracewell();
  for (const town of ['Maitland', 'maitland', 'Oviedo', 'Orlando', 'Nowhere']) {
    assert.equal(canonicalTown(c, town), schemaCanonicalTown(c, town), town);
    const t = schemaCanonicalTown(c, town);
    const f = areaPageFacts(c, t);
    assert.equal(townJobs(c, t).length, f.jobs, `${town} jobs`);
    assert.equal(townReviews(c, t).length, f.reviews, `${town} reviews`);
    assert.equal(townNotes(c, t).length, f.notes, `${town} notes`);
    const s = spokePageFacts(c, t, 0);
    assert.equal(townJobs(c, t, SLUG).length, s.jobs, `${town} spoke jobs`);
    assert.equal(townReviews(c, t, SLUG).length, s.reviews, `${town} spoke reviews`);
  }
  // The unsourced note and the photo with no image are left out, as the gate leaves them out.
  assert.deepEqual(townNotes(c, 'Maitland').map((n) => n.text), ['Maitland requires a permit for every new condenser.']);
  assert.deepEqual(townJobs(c, 'Maitland').map((j) => j.caption), ['Condenser swap beside the lake', 'Attic return sealed']);
});

test('"About our {service} service" drops the doubled word (Xander, 2026-11-12)', () => {
  assert.equal(aboutOurService('AC Installation & Service'), 'About our AC installation & service');
  assert.equal(aboutOurService('Drain Cleaning'), 'About our drain cleaning service');
  assert.equal(aboutOurService('HVAC Services'), 'About our HVAC services');
  assert.equal(aboutOurService('Full Detail'), 'About our full detail service');
});

test('the approved words are exactly as approved', () => {
  assert.equal(AREA_WORDS.home, 'Home');
  assert.equal(AREA_WORDS.areas, 'Areas');
  assert.equal(AREA_WORDS.areasWeServe, 'Areas we serve');
  assert.equal(AREA_WORDS.source, 'Source');
  assert.equal(AREA_WORDS.ourServicesIn('Maitland'), 'Our services in Maitland');
  assert.equal(AREA_WORDS.recentJobsIn('Maitland'), 'Recent jobs in Maitland');
  assert.equal(AREA_WORDS.customersSay('Maitland'), 'What our Maitland customers say');
  assert.equal(AREA_WORDS.workingIn('Maitland'), 'Working in Maitland');
  assert.equal(AREA_WORDS.moreWorkIn('Maitland'), 'More of our work in Maitland');
  assert.equal(AREA_WORDS.inTown('AC Installation & Service', 'Maitland'), 'AC Installation & Service in Maitland');
  assert.equal(AREA_WORDS.nearbyTowns('AC Installation & Service'), 'AC Installation & Service in nearby towns');
  assert.equal(AREA_WORDS.priceFactors, 'What affects the price');
});

// ── Headers ────────────────────────────────────────────────────────────────────

for (const [vertical, P] of Object.entries(TRADES)) {
  test(`${P}TownHeader: town page H1 "{Trade} in {Town}", breadcrumb "Home › Areas › {Town}", the intro`, async () => {
    const html = await header(P, { content: tracewell(), townSlug: 'maitland' });
    const h1 = text(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)[1]);
    assert.equal(h1, `${TRADE_LABELS[vertical]} in Maitland`);
    assert.equal(text(/<nav aria-label="Breadcrumb"[\s\S]*?<\/nav>/.exec(html)[0]), 'Home › Areas › Maitland');
    assert.match(html, /href="\/areas"/);
    assert.match(text(html), /Tracewell installs and repairs heating and cooling in Maitland\. Call to book a visit\./);
    assert.match(html, /data-src="intro"/);
    assert.match(html, /href="tel:\+14075550177"/);
  });

  test(`${P}TownHeader: town + service H1 "{Service} in {Town}", breadcrumb "Home › Areas › {Town} › {Service}"`, async () => {
    const html = await header(P, { content: tracewell(), townSlug: 'maitland', serviceSlug: SLUG });
    assert.equal(text(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)[1]), 'AC Installation & Service in Maitland');
    assert.equal(text(/<nav aria-label="Breadcrumb"[\s\S]*?<\/nav>/.exec(html)[0]), 'Home › Areas › Maitland › AC Installation & Service');
    assert.match(html, /href="\/areas\/maitland"/);
    assert.match(text(html), /We install central air in Maitland\./);
  });

  test(`${P}TownHeader: the /areas index reads "Areas we serve" under "Home › Areas"`, async () => {
    const html = await header(P, { content: tracewell(), data: { eyebrow: '', title: 'Ignored', sub: '', cta: null } });
    assert.equal(text(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)[1]), 'Areas we serve');
    assert.equal(text(/<nav aria-label="Breadcrumb"[\s\S]*?<\/nav>/.exec(html)[0]), 'Home › Areas');
    assert.doesNotMatch(html, /Ignored/);
  });

  test(`${P}TownHeader and ${P}TownBody render nothing for a town or spoke the site has no page for`, async () => {
    const c = tracewell();
    assert.equal(await header(P, { content: c, townSlug: 'orlando' }), '');
    assert.equal(await body(P, { content: c, townSlug: 'orlando' }), '');
    assert.equal(await header(P, { content: c, townSlug: 'oviedo', serviceSlug: SLUG }), '', 'Oviedo lists no spoke');
    assert.equal(await body(P, { content: c, townSlug: 'oviedo', serviceSlug: SLUG }), '');
    assert.equal(await header(P, { content: tracewell({ areaPages: null }), townSlug: 'maitland' }), '');
  });

  // ── Bodies ───────────────────────────────────────────────────────────────────

  test(`${P}TownBody: the four approved sections, from Maitland's own facts only`, async () => {
    const html = await body(P, { content: tracewell(), townSlug: 'maitland' });
    const t = text(html);
    for (const h of ['Our services in Maitland', 'Recent jobs in Maitland', 'What our Maitland customers say', 'Working in Maitland']) {
      assert.ok(t.includes(h), h);
    }
    // Services with pages only; AC goes to its Maitland page (listed), furnace to its service page.
    assert.match(html, new RegExp(`href="/areas/maitland/${SLUG}"`));
    assert.match(html, /href="\/services\/furnace-repair"/);
    assert.doesNotMatch(t, /Duct Sealing/);
    // Each job: the client's caption and the town. Nothing from Oviedo, no unsourced note.
    assert.ok(t.includes('Condenser swap beside the lake'));
    assert.ok(t.includes('Attic return sealed'));
    assert.doesNotMatch(t, /Oviedo/);
    assert.doesNotMatch(t, /No photo, no job|never show/);
    assert.ok(t.includes('On time and the new system is quiet.'));
    assert.ok(t.includes('Maitland requires a permit for every new condenser.'));
    assert.match(html, /<a [^>]*href="https:\/\/www\.itsmymaitland\.com\/permits"[^>]*>Source<\/a>/);
  });

  test(`${P}TownBody: each section is hidden when the town has no data for it`, async () => {
    const c = tracewell();
    c.testimonials.items = [];
    c.extensions.townNotes = [];
    c.servicePages = [];
    const t = text(await body(P, { content: c, townSlug: 'maitland' }));
    assert.ok(t.includes('Recent jobs in Maitland'));
    for (const h of ['Our services in', 'customers say', 'Working in']) assert.ok(!t.includes(h), h);
  });

  test(`${P}TownBody: no body text outside a data-src block, and the blocks say only what the 40% share counts`, async () => {
    const c = tracewell();
    const html = await body(P, { content: c, townSlug: 'maitland' });
    assert.equal(text(unmarked(html)), '', 'text outside every data-src block');
    for (const k of ['services', 'job', 'review', 'note']) assert.match(html, new RegExp(`data-src="${k}"`), k);
    // Inside the blocks, past the approved headings and the reviewer's name, every word is one the
    // share counts: job captions and town lines, review quotes, sourced notes and service names.
    const counted = html
      .replace(/<h2[\s\S]*?<\/h2>/g, ' ')
      .replace(/<figcaption data-attribution[\s\S]*?<\/figcaption>/g, ' ')
      .replace(/>Source</g, '><');
    const s = localShare(c, 'areas/maitland');
    const intro = words(c.areaCopy.maitland.intro).length;
    assert.equal(words(text(counted)).length, s.local + s.generated - intro);
  });

  test(`${P}TownBody: a town + service page shows only what is tagged to both, then the two approved links`, async () => {
    const html = await body(P, { content: tracewell(), townSlug: 'maitland', serviceSlug: SLUG });
    const t = text(html);
    assert.ok(t.includes('Condenser swap beside the lake'));
    assert.ok(!t.includes('Attic return sealed'), 'a duct sealing job is not about AC');
    assert.ok(t.includes('On time and the new system is quiet.'));
    assert.ok(!t.includes('Maitland requires a permit'), 'no notes on a spoke');
    assert.ok(!/Our services in/.test(t));
    assert.ok(!/questions|What to expect|included/i.test(t), 'no FAQ, expect or inclusions: they stay on the service page');
    assert.match(html, /<a [^>]*href="\/areas\/maitland"[^>]*>[\s\S]*More of our work in Maitland/);
    assert.match(html, new RegExp(`<a [^>]*href="/services/${SLUG}"[^>]*>[\\s\\S]*About our AC installation &amp; service<`));
    assert.equal(text(unmarked(html)), '', 'text outside every data-src block');
  });

  test(`${P}TownBody: the /areas index lists every town; a town with a page links to it, the main city links home`, async () => {
    const html = await body(P, { content: tracewell() });
    assert.match(html, /<a [^>]*href="\/"[^>]*>[\s\S]*?Winter Park/);
    assert.match(html, /<a [^>]*href="\/areas\/maitland"[^>]*>[\s\S]*?Maitland/);
    assert.match(html, /<a [^>]*href="\/areas\/oviedo"[^>]*>[\s\S]*?Oviedo/);
    assert.ok(text(html).includes('Orlando'));
    assert.doesNotMatch(html, /href="\/areas\/orlando"/, 'no page, no link');
  });

  // ── Service page additions ───────────────────────────────────────────────────

  test(`${P}ServiceDetail: "What affects the price" and "{Service} in nearby towns", each hidden until it has data`, async () => {
    const svc = (c) => render(`services/${P}ServiceDetail.tsx`, { content: c, serviceSlug: SLUG });
    const t = text(await svc(tracewell()));
    assert.ok(t.includes('What affects the price'));
    assert.ok(t.includes('The size of the home') && t.includes('How hard the unit is to reach'));
    assert.ok(t.includes('AC Installation & Service in nearby towns'));
    const html = await svc(tracewell());
    assert.match(html, new RegExp(`<a [^>]*href="/areas/maitland/${SLUG}"[^>]*>[\\s\\S]*?AC Installation &amp; Service in Maitland`));
    assert.doesNotMatch(html, new RegExp(`/areas/oviedo/${SLUG}`), 'Oviedo has no AC spoke');

    const bare = tracewell();
    bare.services.items[0].priceFactors = [];
    bare.areaPages = [{ town: 'Maitland', slug: 'maitland', spokes: [] }];
    const t2 = text(await svc(bare));
    assert.ok(!t2.includes('What affects the price'));
    assert.ok(!t2.includes('in nearby towns'));
  });
}

// ── Wiring ─────────────────────────────────────────────────────────────────────

test('every trade has its town page sections, in the catalog and in AREA_PAGE_SECTIONS', () => {
  for (const [vertical, P] of Object.entries(TRADES)) {
    const vt = VERTICAL_TEMPLATES[vertical];
    const names = (f) => f().map((r) => `${r.categoryId}/${r.name}`);
    assert.deepEqual(names(vt.areaSections), [`pageHeader/${P}TownHeader`, `trust/${P}TownBody`, `finalCta/${P}FinalCta`], vertical);
    assert.deepEqual(names(vt.spokeSections), [`pageHeader/${P}TownHeader`, `trust/${P}TownBody`, `finalCta/${P}FinalCta`], vertical);
    assert.deepEqual(names(vt.areasIndexSections), [`pageHeader/${P}TownHeader`, `trust/${P}TownBody`, `finalCta/${P}FinalCta`], vertical);
    assert.ok(AREA_PAGE_SECTIONS.has(`${P}TownHeader`) && AREA_PAGE_SECTIONS.has(`${P}TownBody`), P);
    // export.ts is server-only, so its CATALOG allowlist is read as source.
    const catalog = read(path.join(CONSOLE, 'src/lib/export.ts'));
    assert.match(/pageHeader:\s*\[[^\]]*\]/.exec(catalog)[0], new RegExp(`'${P}TownHeader'`), P);
    assert.match(/trust:\s*\[[^\]]*\]/.exec(catalog)[0], new RegExp(`'${P}TownBody'`), P);
  }
  assert.equal(sectionSlugAttrs({ pageType: 'spoke', route: `areas/maitland/${SLUG}` }, 'HvacTownBody'), ` townSlug="maitland" serviceSlug="${SLUG}"`);
});

test('the /areas index the sync adds is labelled "Areas" in the menu (T2), and only with a town page', () => {
  const vt = VERTICAL_TEMPLATES.hvac;
  const comp = vt.build();
  const withTown = syncAreaPages(comp, [{ town: 'Maitland', slug: 'maitland' }], []);
  const index = withTown.pages.find((p) => p.route === 'areas');
  assert.equal(index.label, 'Areas');
  assert.equal(index.navVisible, true);
  assert.equal(syncAreaPages(withTown, [], []).pages.some((p) => p.route === 'areas'), false);
});

test('the /areas index title is "Areas we serve | {Brand}" (T3)', () => {
  const c = tracewell();
  const seo = buildPageSeo(c, [
    { route: '', pageType: 'home', label: 'Home', sections: [] },
    { route: 'areas', pageType: 'areas', label: 'Areas', sections: [] },
    { route: 'areas/maitland', pageType: 'area', label: 'Maitland', sections: [] },
  ], 'hvac');
  assert.equal(seo.areas.title, 'Areas we serve | Tracewell Heating & Air');
  // An operator's own Service Areas page, on a site with no town pages, keeps its own title.
  const own = buildPageSeo(c, [{ route: '', pageType: 'home', label: 'Home', sections: [] }, { route: 'areas', pageType: 'areas', label: 'Service Areas', sections: [] }], 'hvac');
  assert.equal(own.areas.title, 'Service Areas | Tracewell Heating & Air');
});

test("compose-page.tsx's AREA_RENDER is exactly AREA_PAGE_SECTIONS", () => {
  const compose = read(path.join(CONSOLE, 'src/app/c/[slug]/build/compose-page.tsx'));
  const block = /const AREA_RENDER[\s\S]*?\n\};/.exec(compose)[0];
  const rendered = [...block.matchAll(/^\s{2}(\w+): \(p\) => </gm)].map((m) => m[1]).sort();
  assert.deepEqual(rendered, [...AREA_PAGE_SECTIONS].sort());
});

test('the Studio renders town page sections with their slugs, as the export does', async () => {
  const { renderSection } = await import('../src/app/c/[slug]/build/compose-page.tsx');
  const c = tracewell();
  const html = (pageType, route, name, categoryId) =>
    renderToStaticMarkup(renderSection({ categoryId, name }, { route, pageType, label: 'x', templateId: 't', navVisible: false, sections: [] }, [], c));
  assert.match(html('area', 'areas/maitland', 'HvacTownHeader', 'pageHeader'), /HVAC in[\s\S]*Maitland/);
  assert.match(html('spoke', `areas/maitland/${SLUG}`, 'HvacTownHeader', 'pageHeader'), /<h1[^>]*><span>AC Installation &amp; Service<\/span> in <span[^>]*>Maitland</);
  assert.match(html('spoke', `areas/maitland/${SLUG}`, 'HvacFinalCta', 'finalCta'), /Service: AC Installation &amp; Service/, "a spoke's form opens with its service");
  assert.match(html('areas', 'areas', 'HvacTownHeader', 'pageHeader'), /Areas we serve/);
  assert.match(html('area', 'areas/maitland', 'RoofingTownBody', 'trust'), /Recent jobs in Maitland/);
});
