// The site chrome a client actually sees, from Xander's front-to-back test of "Tracewell Heating &
// Air" (E2E-ONBOARDING-TEST-2026-11-10, findings F-D2, F-D4, F-D6; his feedback 2026-11-11):
//
//   F-D2  The intake logo was used nowhere. Every nav and footer drew a gradient box beside the
//         name, and no catalog component read images.footer.logoImage.
//   F-D4  The footer read "© 2026 Your HVAC Company LLC": the preset's footer.legal fills the
//         client's empty one in the Studio merge, so the sample company's name shipped.
//   F-D4  The footer linked "Reviews" and "Our Work" (pages that don't exist) and the template's
//         sample services, not the client's.
//   F-D6  The phone printed as bare digits ("4075550177") with a `tel:` that wasn't E.164.
//
// Every assertion renders the REAL catalog components with a Tracewell-shaped content object.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
// tsx compiles JSX to classic React.createElement calls (see lead-form-prefill.test.mjs).
globalThis.React = React;

import { CONTENT as HVAC } from '../src/data/verticals/hvac.ts';
import { footerColumns } from '../src/lib/serviceLinks.ts';
import { copyrightLine, logoUrl } from '../src/lib/brandChrome.ts';
import { withDisplayPhone } from '../src/lib/displayPhone.ts';

const CONSOLE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OPS = path.resolve(CONSOLE, '..');
const read = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
/** The text a visitor reads: the Studio wraps each editable value in a <span>. */
const text = (html) => html.replace(/<[^>]+>/g, '');

const NAVS = ['HvacNav', 'LawnNav', 'PlumbingNav', 'RoofingNav', 'DetailNav', 'NavMinimal', 'NavEmergencyBar'];
const FOOTERS = ['HvacFooter', 'LawnFooter', 'PlumbingFooter', 'RoofingFooter', 'DetailFooter', 'FooterColumns', 'FooterMinimal'];
/** The footers that carry link columns (FooterMinimal is a one-line footer with none). */
const COLUMN_FOOTERS = FOOTERS.filter((f) => f !== 'FooterMinimal');
const VERTICAL = ['Hvac', 'Lawn', 'Plumbing', 'Roofing', 'Detail'];
const SERVICES = ['HvacServices', 'LawnServices', 'PlumbingServices', 'RoofingServices', 'DetailServices',
  'ServicesGrid', 'ServicesPanel', 'ServicesShowcase', 'ServicesSpotlight', 'ServicesAccordion'];

const LOGO = '/img/7a0c4e5d9b1f2a33';
const YEAR = new Date().getFullYear();

/** Tracewell as imported: legal name corrected, phone as the agency stores it, one paged service. */
function tracewell({ logo = LOGO, long = 'Tracewell Heating & Air LLC' } = {}) {
  const c = structuredClone(HVAC);
  c.brand = { ...c.brand, name: 'Tracewell Heating & Air', short: 'Tracewell', long, tagline: '', phone: '4075550177', phoneHref: 'tel:4075550177' };
  // What the Studio and the export put here: route links generated from the composition.
  c.nav = [
    { label: 'Home', href: '/' },
    { label: 'Services', href: '/services' },
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '/contact' },
  ];
  c.services.items = [
    { n: '01', t: 'AC Installation & Service', d: 'Central air sized right.', tag: 'Cooling', slug: 'ac-installation-service' },
    { n: '02', t: 'Furnace Repair & Replacement', d: 'Fast diagnosis.', tag: 'Heating' },
    { n: '03', t: 'TW Attic Fan Check', d: 'Attic fans checked.', tag: 'Air' },
  ];
  c.servicePages = ['ac-installation-service'];
  c.hero.secondaryCta = 'Call 4075550177';
  c.images.footer = logo ? { logoImage: logo } : {};
  return c;
}

async function render(category, name, content) {
  const mod = await import(`../src/components/catalog/${category}/${name}.tsx`);
  return renderToStaticMarkup(React.createElement(mod.default, { content }));
}

// ── F-D2: the logo ─────────────────────────────────────────────────────────────

test('every nav and footer shows the intake logo in its brand box, through the local-image pipeline', async () => {
  // FooterMinimal is a one-line footer with no brand mark, so it has no box to fill.
  for (const [cat, names] of [['nav', NAVS], ['footer', COLUMN_FOOTERS]]) {
    for (const name of names) {
      const html = await render(cat, name, tracewell());
      assert.ok(html.includes(`src="${LOGO}-640.webp"`), `${name}: the logo is not shown (or not as a file the pipeline wrote)`);
      // It sits beside the name, which is already text: decorative, so the name isn't read twice.
      assert.match(html, new RegExp(`<img[^>]*alt=""[^>]*src="${LOGO}-640\\.webp"|<img[^>]*src="${LOGO}-640\\.webp"[^>]*alt=""`), `${name}: logo needs alt=""`);
    }
  }
});

test('with no logo, the vertical templates keep today\'s box and nothing points at an image', async () => {
  for (const v of VERTICAL) {
    for (const [cat, name] of [['nav', `${v}Nav`], ['footer', `${v}Footer`]]) {
      const html = await render(cat, name, tracewell({ logo: '' }));
      assert.doesNotMatch(html, /<img/, `${name}: an image with no logo`);
      assert.match(html, /accent-bar|linear-gradient/, `${name}: the fallback box is gone`);
    }
  }
});

test('logoUrl reads the one field the intake writes and the Brand drawer edits', () => {
  assert.equal(logoUrl(tracewell()), LOGO);
  assert.equal(logoUrl(tracewell({ logo: '' })), '');
  assert.equal(logoUrl({ images: { footer: { logoImage: '   ' } } }), '');
  assert.equal(logoUrl({}), '');
  // The intake's branding.logo lands on this path (intake-path-map.ts), which the pipeline localizes.
  assert.match(read(path.join(CONSOLE, 'src/lib/intake-path-map.ts')), /'branding\.logo': 'images\.footer\.logoImage'/);
  assert.match(read(path.join(CONSOLE, 'src/lib/image-pipeline.ts')), /isLogo: true, get: \(\) => imgs\.footer\.logoImage/);
});

// ── F-D4: the copyright line ───────────────────────────────────────────────────

test('the copyright line names the client\'s legal name, never the preset company', async () => {
  assert.equal(copyrightLine(tracewell(), 2026), '© 2026 Tracewell Heating & Air LLC. All rights reserved.');
  assert.equal(copyrightLine(tracewell({ long: '' }), 2026), '© 2026 Tracewell Heating & Air. All rights reserved.', 'falls back to the business name');
  assert.equal(copyrightLine(tracewell({ long: '  ' }), 2026), '© 2026 Tracewell Heating & Air. All rights reserved.');
  for (const name of FOOTERS) {
    const html = await render('footer', name, tracewell());
    assert.ok(text(html).includes(`© ${YEAR} Tracewell Heating &amp; Air LLC. All rights reserved.`), `${name}: no client copyright line`);
    assert.doesNotMatch(html, /Your HVAC Company/, `${name}: the preset company's name shipped`);
  }
});

// ── F-D4: the footer links ─────────────────────────────────────────────────────

test('footer columns list only what exists: the client\'s services and the top-menu pages', () => {
  const cols = footerColumns(tracewell());
  assert.deepEqual(cols.map((c) => c.h), ['Services', 'Company']);
  assert.deepEqual(cols[0].links.map((l) => [l.label, l.href]), [
    ['AC Installation & Service', '/services/ac-installation-service'], // has its own page
    ['Furnace Repair & Replacement', '/services#furnace-repair-replacement'], // Services page, scrolled to it
    ['TW Attic Fan Check', '/services#tw-attic-fan-check'],
  ]);
  assert.deepEqual(cols[1].links.map((l) => [l.label, l.href]), [['Services', '/services'], ['About', '/about'], ['Contact', '/contact']]);
  // Each label stays editable where it lives.
  assert.deepEqual(cols[0].links.map((l) => l.path), ['services.items.0.t', 'services.items.1.t', 'services.items.2.t']);
  assert.deepEqual(cols[1].links.map((l) => l.path), ['nav.1.label', 'nav.2.label', 'nav.3.label']);
});

test('a site with no Services page or no other pages drops what it can\'t link', () => {
  const onePage = { ...tracewell(), nav: [{ label: 'Home', href: '/' }], servicePages: [] };
  const cols = footerColumns(onePage);
  assert.deepEqual(cols.map((c) => c.h), ['Services'], 'no Company column with nothing to list');
  assert.equal(cols[0].links[1].href, '#furnace-repair-replacement', 'one page: the card is on this page');
  assert.deepEqual(footerColumns({ ...onePage, services: { items: [] } }), []);
});

test('every column footer renders those links and none of the preset samples', async () => {
  for (const name of COLUMN_FOOTERS) {
    const html = await render('footer', name, tracewell());
    for (const href of ['/services/ac-installation-service', '/services#furnace-repair-replacement', '/services#tw-attic-fan-check', '/about', '/contact']) {
      assert.ok(html.includes(`href="${href}"`), `${name}: no link to ${href}`);
    }
    for (const dead of ['#testimonials', '#work', '#faq', '>Reviews<', '>Our Work<', 'Maintenance Plans']) {
      assert.ok(!html.includes(dead), `${name}: still links ${dead}`);
    }
  }
});

test('every services list carries each service\'s anchor, so the footer link scrolls to it', async () => {
  for (const name of SERVICES) {
    const html = await render('services', name, tracewell());
    for (const slug of ['furnace-repair-replacement', 'tw-attic-fan-check']) {
      assert.ok(html.includes(`id="${slug}"`), `${name}: no id="${slug}" for the footer to scroll to`);
    }
  }
});

test('the export writes the footer columns it renders, so site.ts carries no dead sample links', () => {
  const route = read(path.join(CONSOLE, 'src/app/api/build/export/route.ts'));
  assert.match(route, /content\.footer = \{ \.\.\.content\.footer, cols: footerColumns\(content\)/);
});

// ── F-D6: the phone ────────────────────────────────────────────────────────────

test('a bare-digit phone displays formatted, dials E.164, and copy that quoted it follows', () => {
  const c = withDisplayPhone(tracewell());
  assert.equal(c.brand.phone, '(407) 555-0177');
  assert.equal(c.brand.phoneHref, 'tel:+14075550177');
  assert.equal(c.hero.secondaryCta, 'Call (407) 555-0177');
  // Already right: untouched. Not a NANP number: shown as typed, never guessed at.
  const ok = withDisplayPhone({ ...tracewell(), brand: { ...tracewell().brand, phone: '(407) 555-0177', phoneHref: 'tel:+14075550177' } });
  assert.equal(ok.brand.phone, '(407) 555-0177');
  const odd = withDisplayPhone({ ...tracewell(), brand: { ...tracewell().brand, phone: '+44 20 7946 0958', phoneHref: 'tel:+442079460958' } });
  assert.equal(odd.brand.phone, '+44 20 7946 0958');
  assert.equal(odd.brand.phoneHref, 'tel:+442079460958');
  const none = withDisplayPhone({ ...tracewell(), brand: { ...tracewell().brand, phone: '', phoneHref: '' } });
  assert.equal(none.brand.phoneHref, '', 'no number: no dead tel: link');
});

test('the nav and footer print the formatted number once the Studio and export apply it', async () => {
  const c = withDisplayPhone(tracewell());
  for (const [cat, name] of [['nav', 'HvacNav'], ['footer', 'HvacFooter']]) {
    const html = await render(cat, name, c);
    assert.ok(text(html).includes('(407) 555-0177'), `${name}: number not formatted`);
    assert.ok(html.includes('href="tel:+14075550177"'), `${name}: tel: is not E.164`);
    assert.ok(!/(^|[^+\d])4075550177/.test(text(html)), `${name}: bare digits shown`);
  }
  // The Studio's preview and its export payload are lib/effectiveContent.ts (BuildWizard calls it).
  const studio = read(path.join(CONSOLE, 'src/lib/effectiveContent.ts'));
  assert.match(studio, /withDisplayPhone\(stripPresetIdentity\(/, 'the Studio preview applies it, outermost');
  const route = read(path.join(CONSOLE, 'src/app/api/build/export/route.ts'));
  assert.match(route, /withDisplayPhone\(/, 'the export applies it');
});

// ── Shared helpers ship to client repos ────────────────────────────────────────

test('the chrome helpers are byte-identical in the console and the template', () => {
  for (const f of ['brandChrome.ts', 'BrandBox.tsx', 'serviceLinks.ts']) {
    assert.equal(read(path.join(OPS, 'template/src/lib', f)), read(path.join(CONSOLE, 'src/lib', f)), `${f}: console and template copies differ`);
  }
});

// ── The agency credit (Xander 2026-11-11) ──────────────────────────────────────

test('every footer credits the agency between the copyright and the licence line, nofollow', async () => {
  for (const name of FOOTERS) {
    const c = tracewell();
    c.brand.license = 'CAC1820000';
    const html = await render('footer', name, c);
    const link = /<a [^>]*href="https:\/\/www\.juneaudigitaldesigns\.com"[^>]*>Juneau Digital Designs<\/a>/.exec(html)?.[0];
    assert.ok(link, `${name}: no link to the agency site`);
    assert.match(link, /rel="nofollow noopener"/, `${name}: the credit must be nofollow`);
    const t = text(html);
    assert.ok(t.includes('Created by Juneau Digital Designs'), `${name}: wording`);
    const at = (s) => t.indexOf(s);
    assert.ok(at('All rights reserved.') < at('Created by'), `${name}: the credit follows the copyright`);
    // The licence line is the bar's last; a trust badge higher up can carry the same words.
    if (t.includes('Licensed &amp; insured · CAC1820000')) assert.ok(at('Created by') < t.lastIndexOf('Licensed &amp; insured · CAC1820000'), `${name}: the credit sits before the licence line`);
  }
});
