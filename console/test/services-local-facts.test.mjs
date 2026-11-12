// Local SEO in the Services step (Xander, 2026-11-12, approved as the canvas's row 8):
//  - "What affects the price": the client's own answer to Q5 (ServiceItem.priceFactors, Form).
//  - "What happens on a typical visit": Q6, operator-only steps (ServiceItem.typicalVisit),
//    added with "Add a step".
//  - A town on each job photo (Project.town), from the client's own towns, or "Not sure".
// All three are facts, never generated. Towns use @jdd/schema's canonicalTown, so a photo's town is
// always spelled exactly as in extensions.serviceArea, which is how town pages find their jobs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { areaPageFacts } from '@jdd/schema';
import { SERVICE_PARTS, partsDone, partsProgress } from '../src/lib/service-parts.ts';
import { withPhotoTown } from '../src/lib/service-towns.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(path.join(ROOT, 'src/components/wizard/intake/ServicesStep.tsx'), 'utf8');

test('the two new parts sit after Problems it fixes, with the approved labels', () => {
  assert.deepEqual(SERVICE_PARTS.map((p) => p.label), [
    'Basics', 'Included in the job', 'Problems it fixes', 'What affects the price', 'What happens on a typical visit',
    'Towns & brands', 'Photos', 'Customer questions', 'Summary',
  ]);
});

test('price factors and visit steps count as parts with something in them', () => {
  const content = { services: { items: [{ t: 'AC repair', priceFactors: ['Size of the home'], typicalVisit: [] }] } };
  const done = partsDone(content, 0, 'ac-repair');
  assert.equal(done.price, true);
  assert.equal(done.visit, false);
  assert.deepEqual(partsProgress(done), { done: 2, of: 8 });
});

const content = {
  extensions: { serviceArea: ['Winter Park', 'Maitland', 'Oviedo'] },
  work: { projects: [] },
};

test('a photo\'s town is the client\'s own spelling; "Not sure" clears it', () => {
  const p = { t: 'AC repair', loc: '', yr: null, scope: 'AC repair', size: '', caption: 'Coil', image: { url: '/img/a', alt: 'Coil' } };
  const tagged = withPhotoTown(content, p, ' maitland ');
  assert.equal(tagged.town, 'Maitland');
  assert.equal(tagged.loc, 'Maitland', 'the display line follows the town, as buildScaffold sets it');
  const cleared = withPhotoTown(content, tagged, '');
  assert.ok(!('town' in cleared));
  assert.equal(cleared.loc, '');
  assert.ok(!('town' in withPhotoTown(content, p, 'Atlantis')), 'a town the client does not cover is never stored');
  // A loc the operator typed is not overwritten.
  assert.equal(withPhotoTown(content, { ...p, loc: 'Lake Maitland' }, 'Maitland').loc, 'Lake Maitland');
});

test('a tagged job photo is a town fact the town-page gate counts', () => {
  const p = withPhotoTown(content, { t: 'AC repair', loc: '', yr: null, scope: '', size: '', caption: 'Coil', image: { url: '/img/a', alt: 'Coil' } }, 'Oviedo');
  assert.equal(areaPageFacts({ ...content, work: { projects: [p] } }, 'Oviedo').jobs, 1);
});

test('the Services step edits priceFactors, typicalVisit and each photo\'s town', () => {
  assert.match(src, /\$\{base\}\.priceFactors/);
  assert.match(src, /\$\{base\}\.typicalVisit/);
  assert.match(src, /placeholder="Add a step"/);
  assert.match(src, /withPhotoTown\(content, /);
  assert.match(src, /<option value="">Not sure<\/option>/);
  assert.match(src, /sourceOf\(sources, `\$\{base\}\.priceFactors`\)/);
});
