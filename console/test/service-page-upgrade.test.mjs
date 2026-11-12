// The service page upgrade (Xander approved the mockup "HVAC Service Page Upgrade", 2026-11-11):
// - the starting price sits in the header, and "Ask for a quote" goes to the page's form (before,
//   the price card sat mid-page and its button "does nothing", in his words);
// - the client's own job photos lead the page ("Our work"), never stock;
// - generated explanation for search: About paragraphs, a line under each inclusion and each sign;
// - "Know before you book" shows only the facts the client gave ("If any of this information is
//   not provided, then the titles or bullets should not render");
// - brands fall back to the business's own list (F-D7: Trane was shown nowhere).
// Every trade's real header and body are rendered.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { CONTENT as HVAC } from '../src/data/verticals/hvac.ts';
import { serviceBySlug } from '../src/lib/serviceLinks.ts';
import { aboutParagraphs, listWithNotes, ourWorkPhotos, serviceBrands, serviceFacts } from '../src/lib/servicePage.tsx';

// tsx compiles JSX to classic React.createElement calls (see lead-form-prefill.test.mjs).
globalThis.React = React;

const CONSOLE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OPS = path.resolve(CONSOLE, '..');
const read = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const text = (html) => html.replace(/<[^>]+>/g, '').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&');
const TRADES = ['Hvac', 'Roofing', 'Plumbing', 'Lawn', 'Detail'];
const SLUG = 'ac-installation-service';

/** Tracewell's AC service as the e2e test left it, plus generated page copy. */
function tracewell({ price = '$149', page = true, photos = true, duration = 'Half a day', brands = ['Carrier'] } = {}) {
  const c = structuredClone(HVAC);
  c.brand = { ...c.brand, name: 'Tracewell Heating & Air', address: '120 Park Ave, Winter Park, FL 32789', phone: '(407) 555-0177', phoneHref: 'tel:+14075550177' };
  c.extensions = { ...c.extensions, brandsCarried: ['Carrier', 'Trane'] };
  c.services.items = [
    {
      n: '01', t: 'AC Installation & Service', tag: 'Cooling', slug: SLUG,
      image: { url: 'https://images.unsplash.com/photo-stock?w=800', alt: 'stock' }, // what the Studio fills in
      priceFrom: price, duration,
      included: ['Sizing for your home', 'Removal of the old unit', 'Permit and inspection', 'TW coil rinse'],
      typicalJobs: ['AC blowing warm air', 'Ice on the lines'],
      areas: ['Winter Park', 'Maitland'],
      brands,
      ...(page ? { page: {
        intro: 'Tracewell installs and services AC in Winter Park. Call to book.',
        body: ['A new air conditioner only cools as well as it was sized and installed.', 'Most installations take about half a day.'],
        includedNotes: ['The right capacity for your rooms.', 'The old equipment leaves with the crew.', 'The permit is pulled and the inspection arranged.', ''],
        signNotes: ['Often low refrigerant or a blocked filter.', 'Usually restricted airflow. Switch the system off so it can thaw.'],
        expect: ['Most installs take about half a day.'],
        faq: [],
      } } : {}),
    },
    { n: '02', t: 'Furnace Repair & Replacement', tag: 'Heating', slug: 'furnace-repair-replacement' },
  ];
  c.servicePages = [SLUG];
  c.work = { ...c.work, projects: photos ? [
    { t: 'AC Installation & Service', image: { url: '/img/1111111111111111', alt: 'AC Installation & Service' }, service: SLUG },
    { t: 'AC Installation & Service', image: { url: '/img/2222222222222222', alt: 'AC Installation & Service' }, service: SLUG },
  ] : [] };
  return c;
}

async function render(rel, content) {
  const mod = await import(`../src/components/catalog/${rel}`);
  return renderToStaticMarkup(React.createElement(mod.default, { content, serviceSlug: SLUG }));
}

// ── The helpers ────────────────────────────────────────────────────────────────

test('"Our work" is the client\'s tagged job photos only, never the stock in the service\'s main slot', () => {
  const c = tracewell();
  const s = serviceBySlug(c, SLUG);
  assert.deepEqual(ourWorkPhotos(c, s).map((p) => p.url), ['/img/1111111111111111', '/img/2222222222222222']);
  assert.deepEqual(ourWorkPhotos(tracewell({ photos: false }), s), [], 'no tagged photo: no band, though the main slot holds stock');
});

test('"Know before you book" holds only what the client gave, in order', () => {
  const L = { howLong: 'How long it takes', areas: 'Areas we serve', brands: 'Brands we work with' };
  const full = tracewell();
  assert.deepEqual(serviceFacts(full, serviceBySlug(full, SLUG), L).map((r) => [r.label, r.values.map((v) => v.text)]), [
    ['How long it takes', ['Half a day']],
    ['Areas we serve', ['Winter Park', 'Maitland']],
    ['Brands we work with', ['Carrier']],
  ]);
  const bare = tracewell({ duration: '' });
  bare.services.items[0].areas = [];
  bare.extensions.brandsCarried = null;
  assert.deepEqual(serviceFacts(bare, serviceBySlug(bare, SLUG), { ...L }).map((r) => r.label), ['Brands we work with']);
  bare.services.items[0].brands = [];
  assert.deepEqual(serviceFacts(bare, serviceBySlug(bare, SLUG), L), [], 'nothing given: no box at all');
});

test('a service with no brands of its own shows the business\'s brands (F-D7)', () => {
  const c = tracewell({ brands: [] });
  assert.deepEqual(serviceBrands(c, serviceBySlug(c, SLUG)).map((b) => b.text), ['Carrier', 'Trane']);
  c.extensions.brandsCarried = 'Carrier, Trane; Lennox';
  assert.deepEqual(serviceBrands(c, serviceBySlug(c, SLUG)).map((b) => b.text), ['Carrier', 'Trane', 'Lennox']);
});

test('each generated line stays with its own item, and an item with none shows alone', () => {
  const c = tracewell();
  c.services.items[0].included = ['Sizing for your home', '', 'Permit and inspection'];
  c.services.items[0].page.includedNotes = ['Right capacity.', 'orphan', 'Permit pulled.'];
  const rows = listWithNotes(serviceBySlug(c, SLUG), 'included');
  assert.deepEqual(rows.map((r) => [r.text, r.note]), [['Sizing for your home', 'Right capacity.'], ['Permit and inspection', 'Permit pulled.']]);
  assert.equal(rows[1].notePath, `services.items.0.page.includedNotes.2`);
  assert.deepEqual(aboutParagraphs(serviceBySlug(tracewell({ page: false }), SLUG)), []);
});

// ── Every trade ────────────────────────────────────────────────────────────────

test('every trade\'s header shows the price up top with a working "Ask for a quote", and nothing about price without one', async () => {
  for (const v of TRADES) {
    const html = await render(`pageHeader/${v}ServiceHeader.tsx`, tracewell());
    const t = text(html);
    assert.ok(t.includes('Starting at') && t.includes('$149'), `${v}ServiceHeader: no price`);
    assert.match(html, /<a [^>]*href="#cta"[^>]*>Ask for a quote<\/a>/, `${v}ServiceHeader: "Ask for a quote" must go to the form`);
    assert.doesNotMatch(html, /href="#pricing"/, `${v}ServiceHeader: the Pricing jump link points at a card that moved`);
    const none = text(await render(`pageHeader/${v}ServiceHeader.tsx`, tracewell({ price: '' })));
    assert.ok(!none.includes('Starting at') && !none.includes('Ask for a quote'), `${v}ServiceHeader: price words without a price`);
  }
});

test('every trade\'s body carries the client\'s photos, the explanation, the facts box, and the two motions', async () => {
  for (const v of TRADES) {
    const html = await render(`services/${v}ServiceDetail.tsx`, tracewell());
    const t = text(html);
    for (const words of ['Our work', 'About AC Installation & Service', 'A new air conditioner only cools', 'Know before you book', 'How long it takes', 'Half a day',
      'The right capacity for your rooms.', 'Usually restricted airflow.', "What's included", "Signs it's time to call", 'Carrier']) {
      assert.ok(t.includes(words), `${v}ServiceDetail: missing "${words}"`);
    }
    assert.match(html, /srcSet="\/img\/1111111111111111-640\.webp/, `${v}ServiceDetail: the job photo is not shown through the pipeline`);
    assert.doesNotMatch(html, /photo-stock/, `${v}ServiceDetail: stock under "Our work"`);
    assert.match(html, /alt="AC Installation &amp; Service in Winter Park"/, `${v}ServiceDetail: photo alt must be the page's own heading`);
    assert.match(html, /class="[^"]*rv-stagger[^"]*"/, `${v}ServiceDetail: motion 1 (staggered inclusions)`);
    assert.match(html, /class="[^"]*sign-ring[^"]*"/, `${v}ServiceDetail: motion 2 (sign ring)`);
    assert.ok(!t.includes('Starting at') && !t.includes('Ask for a quote'), `${v}ServiceDetail: the price moved to the header`);
    assert.ok(!/[–—]/.test(t.replace(/Tracewell Heating & Air/g, '')), `${v}ServiceDetail: a dash in visible text`);
  }
});

test('with nothing generated and no facts, no new heading renders on any trade', async () => {
  for (const v of TRADES) {
    const c = tracewell({ page: false, photos: false, duration: '', brands: [] });
    c.services.items[0].areas = [];
    c.extensions.brandsCarried = null;
    const t = text(await render(`services/${v}ServiceDetail.tsx`, c));
    for (const words of ['Our work', 'About AC', 'Know before you book', 'How long it takes', 'Brands we work with']) {
      assert.ok(!t.includes(words), `${v}ServiceDetail: "${words}" with nothing behind it`);
    }
    assert.ok(t.includes("What's included"), `${v}ServiceDetail: the client's own list still shows`);
  }
});

// ── Plumbing around it ─────────────────────────────────────────────────────────

test('the sign ring is scroll-driven, off under reduced motion, and the same in console and template', () => {
  const block = (css) => css.slice(css.indexOf('@keyframes sign-ring'), css.indexOf('}\n}\n', css.indexOf('.sign-ring::after { animation')) + 4);
  const tpl = read(path.join(OPS, 'template/src/styles/globals.css'));
  const con = read(path.join(CONSOLE, 'src/app/globals.css'));
  assert.ok(block(tpl).length > 100);
  assert.equal(block(tpl), block(con));
  assert.match(block(tpl), /prefers-reduced-motion: no-preference[\s\S]*animation-timeline: view\(\)/);
});

test('the shared service page helpers ship to client repos byte-identical', () => {
  assert.equal(read(path.join(OPS, 'template/src/lib/servicePage.tsx')), read(path.join(CONSOLE, 'src/lib/servicePage.tsx')));
});

test('the generator is asked for the new copy, with the trade knowledge rule and never an invented fact', async () => {
  const { servicePagesInstruction } = await import('../src/lib/copy-brief/compile.ts');
  const c = tracewell({ page: false });
  const line = servicePagesInstruction(c);
  assert.match(line, /each \{ slug, intro, body, includedNotes, signNotes, expect, faq \}/);
  assert.match(line, /general trade knowledge any technician in this trade would agree with/);
  assert.match(line, /never as this business's promise, and never a price, time, warranty, guarantee, licence or brand the facts do not give/);
  assert.ok(!/[–—]/.test(line), 'the instruction must carry no dash');
  const score = read(path.join(CONSOLE, 'src/lib/scorePage.ts'));
  assert.match(score, /arr\(page\.body\)/, 'the About text counts in the duplicate-page check');
});
