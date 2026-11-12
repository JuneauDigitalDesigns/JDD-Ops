// Local SEO in the intake's Area & profiles and Reviews steps (Xander, 2026-11-12, approved as the
// canvas's row 8, wording word for word):
//  - "Top 3 towns" (extensions.topTowns, the client's Q2, up to 3);
//  - "Town pages": each town's progress towards a page of its own, by @jdd/schema's gate;
//  - "Town notes" (extensions.townNotes): operator-only, a "Source link" is "Required" (L9);
//  - a review's Town and Service are picked from the client's own, saved as `town` and `service`,
//    so the review shows on that town's page and its town + service page by itself.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { areaPageFacts } from '@jdd/schema';
import { townPageRows, toggleTopTown, isSourceUrl, addTownNote } from '../src/lib/intake-towns.ts';
import { draftFromReview, draftToReview, EMPTY_DRAFT } from '../src/lib/review-draft.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(path.join(ROOT, p), 'utf8');

const img = { url: '/img/a', alt: 'x' };
const content = {
  brand: { address: '12 Main St, Winter Park, FL 32789' },
  extensions: {
    serviceArea: ['Winter Park', 'Maitland', 'Orlando', 'Oviedo', 'Casselberry'],
    townNotes: [{ town: 'Maitland', text: 'Lake homes sit on raised slabs.', sourceUrl: 'https://itsmymaitland.com/floodplain' }],
  },
  work: { projects: [
    { t: 'a', loc: '', yr: null, scope: '', size: '', caption: 'a', image: img, town: 'Maitland' },
    { t: 'b', loc: '', yr: null, scope: '', size: '', caption: 'b', image: img, town: 'Maitland' },
    { t: 'c', loc: '', yr: null, scope: '', size: '', caption: 'c', image: img, town: 'Orlando' },
    { t: 'd', loc: '', yr: null, scope: '', size: '', caption: 'd', image: img, town: 'Oviedo' },
    { t: 'e', loc: '', yr: null, scope: '', size: '', caption: 'e', image: img, town: 'Oviedo' },
    { t: 'f', loc: '', yr: null, scope: '', size: '', caption: 'f', image: img, town: 'Oviedo' },
  ] },
  testimonials: { items: [] },
};

test('each town says where it stands, in the approved words, by the schema\'s own gate', () => {
  assert.deepEqual(townPageRows(content).map((r) => [r.town, r.label]), [
    ['Winter Park', 'Main city: the home page'],
    ['Maitland', 'Own page'],
    ['Orlando', '1 of 3 facts for its own page'],
    ['Oviedo', 'Needs a second kind of fact'],
    ['Casselberry', '0 of 3 facts for its own page'],
  ]);
  assert.equal(areaPageFacts(content, 'Maitland').count, 3);
});

test('top towns: the client\'s own spelling, in pick order, at most 3', () => {
  let top = [];
  for (const t of ['maitland', 'Oviedo', 'Orlando', 'Casselberry', 'Atlantis']) top = toggleTopTown(content, top, t);
  assert.deepEqual(top, ['Maitland', 'Oviedo', 'Orlando']);
  assert.deepEqual(toggleTopTown(content, top, 'Oviedo'), ['Maitland', 'Orlando']);
});

test('a town note needs a town of the client\'s, words, and an http(s) source link', () => {
  assert.equal(isSourceUrl('https://cityofwinterpark.org/permits'), true);
  assert.equal(isSourceUrl('http://example.gov/x'), true);
  for (const bad of ['', 'https://', 'cityofwinterpark.org', 'ftp://x.org/a', 'javascript:alert(1)']) assert.equal(isSourceUrl(bad), false, bad);
  const note = { town: 'oviedo ', text: ' Seminole County inspects new condensers. ', sourceUrl: ' https://seminolecountyfl.gov/permits ' };
  assert.deepEqual(addTownNote(content, [], note), [{ town: 'Oviedo', text: 'Seminole County inspects new condensers.', sourceUrl: 'https://seminolecountyfl.gov/permits' }]);
  assert.equal(addTownNote(content, [], { ...note, sourceUrl: 'https://' }), null);
  assert.equal(addTownNote(content, [], { ...note, text: ' ' }), null);
  assert.equal(addTownNote(content, [], { ...note, town: 'Atlantis' }), null);
});

test('a review\'s town is saved as `town`; an old review\'s `company` becomes its town only when it is one', () => {
  const r = draftToReview({ ...EMPTY_DRAFT, q: 'Great.', a: 'Ann', town: 'Oviedo', service: 'ac-repair', verbatim: true });
  assert.equal(r.town, 'Oviedo');
  assert.equal(r.service, 'ac-repair');
  assert.equal(r.company, null);
  const oldTown = draftFromReview({ q: 'Great.', a: 'Ann', r: '', company: 'maitland', stars: 5, source: 'google' }, 0, content);
  assert.equal(oldTown.town, 'Maitland');
  assert.equal(oldTown.company, '', 'the town moves out of company, so it is not shown twice');
  const firm = draftFromReview({ q: 'Great.', a: 'Bo', r: '', company: 'Acme Property Group', stars: 5, source: 'google' }, 1, content);
  assert.equal(firm.town, '', 'a company name never becomes a town');
  assert.equal(firm.company, 'Acme Property Group');
});

test('the steps carry the approved controls', () => {
  const area = read('src/components/wizard/intake/AreaStep.tsx');
  for (const s of ['Top 3 towns', 'Town pages', 'Town notes', 'Note', 'Source link', 'Add note', 'Required']) assert.ok(area.includes(s), s);
  assert.match(area, /disabled=\{!canAdd\}/);
  const reviews = read('src/components/wizard/intake/ReviewsStep.tsx');
  assert.ok(reviews.includes("value={draft.town ?? ''}"), 'the Town select edits the review\'s town');
  assert.match(reviews, /<option value="">None<\/option>\s*\{towns\.map/);
});
