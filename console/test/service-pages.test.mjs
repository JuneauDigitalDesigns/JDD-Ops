// Per-service pages (service-page-spec.md; Xander "Approve, build", 2026-11-10). What the catalog
// components link, show and hide, and how a service page is composed and exported.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as links from '../src/lib/serviceLinks.ts';
import * as gate from '../src/lib/servicePages.ts';
import { useDisclosure } from '../src/lib/disclosure.ts';
import { SERVICE_PAGE_SECTIONS } from '../src/lib/servicePageSections.ts';
import { sectionSlugAttrs } from '../src/lib/areaPageSections.ts';
import {
  VERTICAL_TEMPLATES, applyVerticalTemplate, servicePageSlugs, syncServicePages, verticalServicePage,
} from '../src/app/c/[slug]/build/vertical-templates.tsx';

globalThis.React = React;
const CONSOLE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OPS = path.resolve(CONSOLE, '..');
const read = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

// A made-up site in the spec's shape (never a preset or client file).
const site = (over = {}) => ({
  brand: { address: '123 Main St, Clermont, FL 34711' },
  extensions: {
    serviceArea: ['Clermont', 'Minneola'],
    customerQuestions: [
      { q: 'Do you pull the permit?', a: 'Yes, every time.', service: 'ac-installation-service' },
      { q: 'Is the fee waived?', a: '', service: 'ac-installation-service' },
      { q: 'Do you offer financing?', a: 'Ask us.' },
    ],
  },
  services: {
    items: [
      { t: 'AC Installation & Service', tag: 'Cooling', image: { url: '/img/main', alt: 'AC' }, page: { faq: [
        { q: 'How long does it take?', a: 'One day.' },
        { q: 'Do you pull the permit?', a: 'Duplicate of a client question.' },
      ] } },
      { t: '', tag: 'Blank' },
      { t: 'Heat Pump Installation', tag: 'Cooling' },
      { t: 'Duct Cleaning', tag: 'Air' },
      { t: 'Furnace Repair', tag: 'Heating', image: { url: '/img/furnace', alt: '' } },
    ],
  },
  testimonials: { items: [
    { q: '', a: 'Blank', service: 'ac-installation-service' },
    { q: 'Cool by lunch.', a: 'Maria G.', r: 'Homeowner', company: 'Clermont', service: 'ac-installation-service' },
    { q: 'Other service.', a: 'Sam', service: 'furnace-repair' },
  ] },
  work: { projects: [
    { t: 'Main photo again', image: { url: '/img/main', alt: 'AC' }, service: 'ac-installation-service' },
    { t: 'New condenser', loc: 'Minneola, FL', yr: '2026', image: { url: '/img/job', alt: 'Condenser' }, service: 'ac-installation-service' },
  ] },
  servicePages: ['ac-installation-service', 'heat-pump-installation', 'furnace-repair'],
  ...over,
});

test('the helpers ship to client repos byte-identical (template/src/lib)', () => {
  for (const f of ['serviceLinks.ts', 'disclosure.ts']) {
    assert.equal(read(path.join(OPS, 'template/src/lib', f)), read(path.join(CONSOLE, 'src/lib', f)), `${f}: console and template copies differ`);
  }
});

test('slugs and the H1 city agree with the console gate, so a link never points at a missing page', () => {
  const contents = [
    site(),
    site({ services: { items: [{ t: 'AC Repair' }, { t: 'AC Repair' }, { t: 'Furnace Repair & Replacement near me' }, { t: 'x', slug: 'kept-slug' }, { t: 'Bad', slug: 'Not A Slug' }] } }),
    site({ brand: { address: 'Clermont, FL 34711' } }),
    site({ brand: { address: '123 Main St' } }),
    site({ brand: { address: '' }, extensions: { serviceArea: [] } }),
  ];
  for (const c of contents) {
    assert.deepEqual(links.serviceSlugs(c), gate.serviceSlugs(c));
    assert.equal(links.primaryCity(c), gate.primaryCity(c));
  }
  assert.equal(links.primaryCity(site({ brand: { address: 'Clermont, FL 34711' } })), 'Clermont', 'a street-less service-area address still names its city');
});

test('only services with their own page are linked: a section-only service is linked from nowhere', () => {
  const c = site();
  assert.deepEqual(links.linkedServices(c).map((s) => s.t), ['AC Installation & Service', 'Heat Pump Installation', 'Furnace Repair']);
  const duct = links.serviceRefs(c).find((s) => s.t === 'Duct Cleaning');
  assert.equal(duct.href, null, 'no page, no link (Xander 2026-11-10)');
  assert.equal(duct.index, 3, 'edit paths use the ORIGINAL services.items index, past the blank item');
  assert.deepEqual(links.linkedServices(site({ servicePages: undefined })), [], 'no list written yet: nothing is linked');
});

test('related services: same tag first, never itself, never a section-only service, at most three', () => {
  const c = site();
  const ac = links.serviceBySlug(c, 'ac-installation-service');
  assert.deepEqual(links.relatedServices(c, ac).map((s) => s.t), ['Heat Pump Installation', 'Furnace Repair']);
  assert.equal(links.serviceBySlug(c, 'nope'), null, 'an unknown slug renders nothing');
});

test('questions: the client\'s own first, answered ones only, no repeats, at most five', () => {
  const c = site();
  const qs = links.serviceQuestions(c, links.serviceBySlug(c, 'ac-installation-service'));
  assert.deepEqual(qs.map((q) => q.q), ['Do you pull the permit?', 'How long does it take?']);
  assert.equal(qs[0].path, 'extensions.customerQuestions.0');
  assert.equal(qs[1].path, 'services.items.0.page.faq.0');
});

test('proof: only this service\'s own reviews and photos, and never the main photo twice', () => {
  const c = site();
  const { reviews, photos } = links.serviceProof(c, links.serviceBySlug(c, 'ac-installation-service'));
  assert.deepEqual(reviews.map((r) => r.a), ['Maria G.'], 'blank and other-service reviews are left out');
  assert.equal(reviews[0].path, 'testimonials.items.1');
  assert.deepEqual(photos.map((p) => p.url), ['/img/job'], 'the tagged project that IS the header photo is skipped');
  const none = links.serviceProof(c, links.serviceBySlug(c, 'heat-pump-installation'));
  assert.deepEqual([none.reviews.length, none.photos.length], [0, 0], 'nothing tagged: no proof block');
});

test('the header photo is the service\'s own image, else its first tagged job photo', () => {
  const c = site();
  assert.equal(links.servicePhoto(c, links.serviceBySlug(c, 'ac-installation-service')).url, '/img/main');
  const noImage = site({ services: { items: [{ t: 'AC Installation & Service' }] } });
  assert.equal(links.servicePhoto(noImage, links.serviceBySlug(noImage, 'ac-installation-service')).url, '/img/main');
});

test('the closing form opens with the service name', () => {
  const c = site();
  assert.equal(links.serviceMessage(links.serviceBySlug(c, 'furnace-repair')), 'Service: Furnace Repair');
});

test('"Find us on": Google first, https only, hidden when none; a service-area business never shows its street', () => {
  const c = site({ extensions: { profiles: [
    { kind: 'facebook', url: 'https://facebook.com/x' },
    { kind: 'google', url: 'https://g.page/x' },
    { kind: 'yelp', url: 'http://yelp.com/insecure' },
    { kind: 'weird', url: 'https://example.com/p' },
  ] } });
  assert.deepEqual(links.profileLinks(c).map((p) => p.kind), ['google', 'facebook', 'other']);
  assert.deepEqual(links.profileLinks(site()), []);
  assert.equal(links.displayAddress(site()), '123 Main St, Clermont, FL 34711');
  assert.equal(links.displayAddress(site({ extensions: { serviceAreaBusiness: true } })), 'Clermont, FL 34711');
});

test('menus: the links are in the server HTML, hidden until opened, with the button wired to them', () => {
  function Menu() {
    const d = useDisclosure({ hover: true });
    return createElement('span', d.root,
      createElement('button', d.button, 'Services menu'),
      createElement('div', d.panel, createElement('a', { href: '/services/ac-repair' }, 'AC repair')));
  }
  const html = renderToStaticMarkup(createElement(Menu));
  assert.match(html, /<button[^>]*aria-expanded="false"/);
  const controls = /aria-controls="([^"]+)"/.exec(html)?.[1];
  assert.ok(controls, 'the button names its panel');
  assert.match(html, new RegExp(`<div[^>]*id="${controls}"[^>]*hidden=""`), 'the panel is hidden until opened');
  assert.match(html, /href="\/services\/ac-repair"/, 'crawlers see the link');
});

test('menus: Escape closes and returns focus, opening focuses the first link, leaving closes', () => {
  const src = read(path.join(CONSOLE, 'src/lib/disclosure.ts'));
  assert.match(src, /e\.key === 'Escape' && open[\s\S]{0,80}close\(true\)/, 'Escape closes and refocuses the button');
  assert.match(src, /querySelector<HTMLElement>\('a, button'\)\?\.focus\(\)/, 'opening moves focus to the first link');
  assert.match(src, /!e\.currentTarget\.contains\(next\)\) close\(false\)/, 'focus leaving the menu closes it');
  // Every vertical nav that has the menu uses the shared behaviour for both menus.
  const navs = readdirSync(path.join(CONSOLE, 'src/components/catalog/nav')).filter((f) => /^(Hvac|Roofing|Plumbing|Lawn|Detail)Nav\.tsx$/.test(f));
  for (const f of navs) {
    const nav = read(path.join(CONSOLE, 'src/components/catalog/nav', f));
    if (!nav.includes('useDisclosure')) continue;
    assert.match(nav, /\{\.\.\.dd\.button\}/, `${f}: the Services chevron is a disclosure button`);
    assert.match(nav, /\{\.\.\.mm\.button\}/, `${f}: the phone menu button is a disclosure button`);
    assert.match(nav, /aria-label=\{mm\.open \? 'Close menu' : 'Open menu'\}/, `${f}: the phone menu button says what it does`);
    assert.match(nav, /linkedServices\(content\)/, `${f}: the menu lists only services with their own page`);
  }
});

test('a service page: its vertical\'s header, body and final CTA, each given the slug, nav-hidden', () => {
  for (const [vertical, t] of Object.entries(VERTICAL_TEMPLATES)) {
    if (!t.serviceSections) continue;
    const page = verticalServicePage(vertical, 'ac-repair', 'AC repair');
    assert.equal(page.route, 'services/ac-repair');
    assert.equal(page.pageType, 'service');
    assert.equal(page.navVisible, false);
    assert.deepEqual(page.sections.map((s) => s.categoryId), ['pageHeader', 'services', 'finalCta'], `${vertical}: header, body, then the one form`);
    for (const s of page.sections) assert.ok(SERVICE_PAGE_SECTIONS.has(s.name), `${vertical}: ${s.name} gets serviceSlug`);
  }
});

test('syncing service pages keeps an existing page as it is, adds new ones, drops unchosen ones', () => {
  const base = applyVerticalTemplate('hvac');
  const one = syncServicePages(base, [{ slug: 'ac-repair', label: 'AC repair' }, { slug: 'duct-cleaning', label: 'Duct cleaning' }]);
  assert.deepEqual(servicePageSlugs(one), ['ac-repair', 'duct-cleaning']);
  const keptId = one.pages.find((p) => p.route === 'services/ac-repair').sections[0].id;
  const two = syncServicePages(one, [{ slug: 'furnace-repair', label: 'Furnace repair' }, { slug: 'ac-repair', label: 'AC repair' }]);
  assert.deepEqual(servicePageSlugs(two), ['furnace-repair', 'ac-repair']);
  assert.equal(two.pages.find((p) => p.route === 'services/ac-repair').sections[0].id, keptId, 'section ids (so styles) survive');
  assert.equal(two.pages.filter((p) => p.pageType !== 'service').length, base.pages.length, 'the core pages are untouched');
});

test('the export gives the slug to exactly the service sections, and the Studio renders the same ones', () => {
  const exporter = read(path.join(CONSOLE, 'src/lib/export.ts'));
  // Since the town pages (2026-11-12) the slug props come from one function, sectionSlugAttrs
  // (areaPageSections.ts); test/area-pages-export.test.mjs pins what it hands to whom.
  assert.match(exporter, /const slugAttr = \(ref: \{ name: string \}\) => sectionSlugAttrs\(page, ref\.name\);/);
  for (const name of SERVICE_PAGE_SECTIONS) {
    assert.equal(sectionSlugAttrs({ pageType: 'service', route: 'services/ac-repair' }, name), ' serviceSlug="ac-repair"');
  }
  assert.equal(sectionSlugAttrs({ pageType: 'service', route: 'services/ac-repair' }, 'ServicesAccordion'), '');
  const compose = read(path.join(CONSOLE, 'src/app/c/[slug]/build/compose-page.tsx'));
  // Only SERVICE_RENDER's entries: compose-page.tsx's AREA_RENDER (town pages) has its own test.
  const serviceRender = /const SERVICE_RENDER[\s\S]*?\n\};/.exec(compose)[0];
  const rendered = [...serviceRender.matchAll(/^\s{2}(\w+): \(p\) => </gm)].map((m) => m[1]).sort();
  assert.deepEqual(rendered, [...SERVICE_PAGE_SECTIONS].sort(), 'compose-page.tsx renders every service section with its slug');
  for (const name of SERVICE_PAGE_SECTIONS) {
    assert.match(exporter, new RegExp(`'${name}'`), `${name} is in the export allow-list`);
  }
});
