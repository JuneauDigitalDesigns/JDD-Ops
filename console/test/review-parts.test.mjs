// Xander, 2026-11-12: "I should be able to checkbox certain specific parts of each section and mark
// those for regeneration so that I don't have to regenerate an entire section ... And then finally,
// every time I go through a section on the review step and I click accept, it should automatically
// move on to the next section for me to review." Approved as the canvas's row 7.
//
// Kept: #79 / #83's locks (the copywriter never writes business identity, so no part of it can be
// ticked) and the review gate (a regenerated section waits for review again).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { sectionParts, partLabel, applyParts, partsWord } from '../src/lib/review-parts.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(path.join(ROOT, p), 'utf8');

const generated = {
  hero: { eyebrow: 'Winter Park heating & air', headline: 'AC repair in Winter Park.', sub: 'Price first.', cta: 'Call', heroBullets: [{ value: '4.9', label: 'Rating' }], image: { url: '/img/x' } },
  brand: { tagline: 'Price first.' },
  services: { title: 'Services', items: [{ t: 'AC repair', d: 'Fixes.', tag: 'Cooling', detail: 'Long.', page: { intro: 'Page intro.', body: ['One.'] } }] },
  subpages: { about: { header: { eyebrow: 'About', title: 'Our story', cta: { label: 'Call', href: 'tel:1' } }, seo: { title: 'About', description: 'D' } } },
  work: { title: 'Jobs', projects: [{ t: 'Coil', loc: 'Oviedo', caption: 'x' }] },
};

test('a section lists the parts the copywriter wrote, and only those', () => {
  assert.deepEqual(sectionParts('hero', generated).map((p) => p.path), [
    'hero.eyebrow', 'hero.headline', 'hero.sub', 'hero.cta', 'hero.heroBullets.0.value', 'hero.heroBullets.0.label',
  ]);
});

test('business identity, service names and real jobs are never offered (#79, #83 locks)', () => {
  assert.deepEqual(sectionParts('brand', { brand: { tagline: 'T', name: 'Coastline', phone: '407', long: 'Coastline LLC' } }).map((p) => p.path), ['brand.tagline']);
  const svc = sectionParts('about:services', generated).map((p) => p.path);
  assert.deepEqual(svc, ['services.title', 'services.items.0.d', 'services.items.0.detail']);
  assert.deepEqual(sectionParts('work', generated).map((p) => p.path), ['work.title']);
  assert.ok(!sectionParts('about:subpages', generated).some((p) => p.path.endsWith('.href')));
});

test('a page\'s header and its service page copy are offered under that page', () => {
  assert.deepEqual(sectionParts('about:subpages', generated).map((p) => p.path), [
    'subpages.about.header.eyebrow', 'subpages.about.header.title', 'subpages.about.header.cta.label', 'subpages.about.seo.title', 'subpages.about.seo.description',
  ]);
  const content = { services: { items: [{ t: 'AC repair' }] } };
  assert.deepEqual(sectionParts('services/ac-repair:servicePages', generated, content).map((p) => p.path), [
    'services.items.0.page.intro', 'services.items.0.page.body.0',
  ]);
});

test('parts are labelled from their field', () => {
  assert.equal(partLabel('hero.headline'), 'Headline');
  assert.equal(partLabel('hero.sub'), 'Subhead');
  assert.equal(partLabel('hero.cta'), 'Button');
  assert.equal(partLabel('hero.heroBullets.0.value'), 'Bullet 1 · Value');
  assert.equal(partLabel('faq.items.2.q'), 'Item 3 · Question');
  assert.equal(partLabel('subpages.about.seo.title'), 'SEO · Title');
  assert.equal(partsWord(1), '1 part');
  assert.equal(partsWord(2), '2 parts');
});

test('only the ticked parts change; everything else stays exactly as it was', () => {
  const fresh = { hero: { eyebrow: 'NEW eyebrow', headline: 'NEW headline', sub: 'NEW sub', cta: 'NEW cta' } };
  const r = applyParts(generated, fresh, ['hero.headline', 'hero.sub'], {});
  assert.deepEqual(Object.keys(r.sections), ['hero']);
  assert.equal(r.sections.hero.headline, 'NEW headline');
  assert.equal(r.sections.hero.sub, 'NEW sub');
  assert.equal(r.sections.hero.eyebrow, 'Winter Park heating & air');
  assert.equal(r.sections.hero.cta, 'Call');
  assert.deepEqual(r.sections.hero.image, { url: '/img/x' });
  assert.deepEqual(r.edits, {});
});

test('a part the operator had edited takes the new text as an edit, so it shows', () => {
  const fresh = { hero: { headline: 'NEW headline' } };
  const r = applyParts(generated, fresh, ['hero.headline'], { 'hero.headline': 'Typed by hand' });
  assert.deepEqual(r.edits, { 'hero.headline': 'NEW headline' });
  assert.deepEqual(r.sections, {});
});

test('a part the run did not return is left alone and reported', () => {
  const r = applyParts(generated, { hero: {} }, ['hero.headline'], {});
  assert.deepEqual(r.sections, {});
  assert.deepEqual(r.missing, ['hero.headline']);
});

test('the Review step ticks parts, regenerates them in place, and Accept moves on', () => {
  const board = read('src/components/wizard/intake/ReviewBoard.tsx');
  assert.ok(board.includes('{partsWord(marked.length)} marked'), '"N parts marked"');
  assert.match(board, />\s*Clear\s*</);
  assert.match(board, /Regenerate \{partsWord\(marked\.length\)\}/);
  assert.match(board, /Regenerating \{partsWord\(marked\.length\)\}…/);
  assert.match(board, /onAccept: \(\) => \{ v\.onAccept\(\); go\(pos \+ 1\); \}/);
  const step = read('src/components/wizard/IntakeStep.tsx');
  // The regenerated section waits for review again: the gate is unchanged.
  assert.match(step, /onApplyParts: \(/);
  assert.match(step, /setTickedSections\(b, \[\.\.\.new Set\(\[\.\.\.tickedKeys, key\]\)\]\)/);
});
