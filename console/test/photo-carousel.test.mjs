// Photo carousels (Xander 2026-11-11): more than one work photo goes in a carousel, both on the
// home hero (the general work photos) and on a service page's "Our work" (that service's photos).
// The visitor moves them; nothing plays by itself. Before this, general photos 2 and up were shown
// nowhere (finding F-D3), and a service page showed at most three photos in a grid.
// Every vertical hero and every trade's service page is rendered.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { CONTENT as HVAC } from '../src/data/verticals/hvac.ts';
import { heroPhotos, CAROUSEL_WORDS } from '../src/lib/PhotoCarousel.tsx';

// tsx compiles JSX to classic React.createElement calls (see lead-form-prefill.test.mjs).
globalThis.React = React;

const CONSOLE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OPS = path.resolve(CONSOLE, '..');
const read = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const HEROES = ['Hvac', 'Lawn', 'Plumbing', 'Roofing', 'Detail'];
const TRADES = ['Hvac', 'Roofing', 'Plumbing', 'Lawn', 'Detail'];
const SLUG = 'ac-installation-service';
const imgs = (html) => html.match(/<img [^>]*>/g) ?? [];

function site({ slides = 3, jobPhotos = 2 } = {}) {
  const c = structuredClone(HVAC);
  c.brand = { ...c.brand, name: 'Tracewell Heating & Air', address: '120 Park Ave, Winter Park, FL 32789' };
  c.images.hero = {
    portrait: '/img/a000000000000000',
    slides: Array.from({ length: slides }, (_, k) => ({ url: `/img/a00000000000000${k}`, alt: k === 0 ? 'Condenser install in Winter Park' : null })),
  };
  c.services.items = [{ n: '01', t: 'AC Installation & Service', slug: SLUG, included: ['Sizing for your home'] }];
  c.servicePages = [SLUG];
  c.work = { ...c.work, projects: Array.from({ length: jobPhotos }, (_, k) => ({ t: 'AC', image: { url: `/img/b00000000000000${k}`, alt: 'AC' }, service: SLUG })) };
  return c;
}

async function render(rel, content, props = {}) {
  const mod = await import(`../src/components/catalog/${rel}`);
  return renderToStaticMarkup(React.createElement(mod.default, { content, ...props }));
}

test('the hero takes every general work photo in order, with facts for any photo sent without words', () => {
  assert.deepEqual(heroPhotos(site(), 'Tracewell Heating & Air in Winter Park'), [
    { url: '/img/a000000000000000', alt: 'Condenser install in Winter Park' },
    { url: '/img/a000000000000001', alt: 'Tracewell Heating & Air in Winter Park' },
    { url: '/img/a000000000000002', alt: 'Tracewell Heating & Air in Winter Park' },
  ]);
  const portraitOnly = site({ slides: 0 });
  assert.deepEqual(heroPhotos(portraitOnly, 'x'), [{ url: '/img/a000000000000000', alt: 'x' }]);
  assert.deepEqual(heroPhotos({}, 'x'), []);
});

test('every hero with several photos gets a carousel the visitor moves, and loads only photo 1 first', async () => {
  for (const v of HEROES) {
    const html = await render(`hero/${v}Hero.tsx`, site());
    assert.match(html, /aria-roledescription="carousel"/, `${v}Hero: no carousel`);
    for (const label of [CAROUSEL_WORDS.previous, CAROUSEL_WORDS.next, CAROUSEL_WORDS.position(1, 3), CAROUSEL_WORDS.position(3, 3)]) {
      assert.ok(html.includes(`aria-label="${label}"`), `${v}Hero: no "${label}" control`);
    }
    assert.match(html, /aria-label="Photo 1 of 3" aria-current="true"/, `${v}Hero: the first photo is the current one`);
    // Only photo 1 is in the server HTML, and it is the LCP: eager, high priority.
    const photos = imgs(html).filter((i) => /\/img\/a00000000000000/.test(i));
    assert.equal(photos.length, 1, `${v}Hero: photos 2 and 3 must not compete with photo 1 on load`);
    assert.match(photos[0], /fetchPriority="high"|fetchpriority="high"/);
  }
});

test('a hero with one photo has no control', async () => {
  for (const v of HEROES) {
    const html = await render(`hero/${v}Hero.tsx`, site({ slides: 1 }));
    assert.ok(!html.includes(CAROUSEL_WORDS.next), `${v}Hero: a control for one photo`);
    assert.doesNotMatch(html, /aria-roledescription="carousel"/);
  }
});

test('every service page shows all of the service\'s photos in a swipeable carousel', async () => {
  for (const v of TRADES) {
    const html = await render(`services/${v}ServiceDetail.tsx`, site({ jobPhotos: 4 }), { serviceSlug: SLUG });
    assert.match(html, /aria-roledescription="carousel"/, `${v}ServiceDetail: no carousel`);
    assert.match(html, /snap-x snap-mandatory/, `${v}ServiceDetail: not swipeable`);
    for (let k = 0; k < 4; k++) {
      assert.ok(html.includes(`srcSet="/img/b00000000000000${k}-640.webp`), `${v}ServiceDetail: photo ${k + 1} of 4 missing (the grid stopped at 3)`);
    }
    assert.ok(html.includes(`aria-label="${CAROUSEL_WORDS.position(4, 4)}"`), `${v}ServiceDetail: no dot for photo 4`);
    for (const i of imgs(html).filter((x) => /\/img\/b0/.test(x))) assert.match(i, /loading="lazy"/, `${v}ServiceDetail: below the fold, photos load lazily`);
    const one = await render(`services/${v}ServiceDetail.tsx`, site({ jobPhotos: 1 }), { serviceSlug: SLUG });
    assert.ok(one.includes('srcSet="/img/b000000000000000-640.webp'), `${v}ServiceDetail: the single photo is shown`);
    assert.ok(!one.includes(CAROUSEL_WORDS.next), `${v}ServiceDetail: a control for one photo`);
  }
});

test('nothing moves by itself, and the carousel ships to client repos byte-identical', () => {
  const src = read(path.join(CONSOLE, 'src/lib/PhotoCarousel.tsx'));
  const code = src.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, ''); // the code, not its comments
  assert.doesNotMatch(code, /setInterval|autoplay/i, 'no autoplay (Xander: the visitor moves it)');
  assert.doesNotMatch(code, /setTimeout\([^;]*setIndex/, 'no timer moves the photo');
  assert.match(src, /motion-reduce:transition-none/, 'no crossfade under reduced motion');
  assert.equal(read(path.join(OPS, 'template/src/lib/PhotoCarousel.tsx')), src);
});
