// The guided Services step (Xander, 2026-11-10): "Not really sure what's being asked ... there is
// a tag field, a from field, and a takes field." One part per screen, headers that say what each
// field is, and no added help text. Approved as the Services v2 mockup ("Build it").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  SERVICE_PARTS, BASICS_LABEL, DURATION_CHOICES, partsDone, partsProgress, nextPart, prevPart, categorySuggestions,
} from '../src/lib/service-parts.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('the parts and headers are the approved ones, in order', () => {
  assert.deepEqual(SERVICE_PARTS.map((p) => p.label), [
    'Basics', 'Included in the job', 'Problems it fixes', 'Towns & brands', 'Photos', 'Customer questions', 'Summary',
  ]);
  assert.deepEqual(Object.values(BASICS_LABEL), ['Service name', 'Category on the card', 'Starting price', 'Usual job length']);
  assert.deepEqual([...DURATION_CHOICES], ['Under an hour', 'Half a day', 'A full day', 'A few days']);
});

test('the step no longer shows the unexplained Tag / From / Takes labels', () => {
  const src = readFileSync(path.join(ROOT, 'src/components/wizard/intake/ServicesStep.tsx'), 'utf8');
  for (const old of [/>\s*Tag\s*</, />\s*From\s*</, />\s*Takes\s*</, /What&apos;s included/, /Typical jobs</]) {
    assert.doesNotMatch(src, old);
  }
  assert.match(src, /BASICS_LABEL\.tag/);
  assert.match(src, /Next service: \{nextName\}/);
});

test('a part counts as done once it has something in it; photos and questions by slug tag', () => {
  const content = {
    services: { items: [{ t: 'AC repair', included: ['Diagnostic'], typicalJobs: [], areas: [], brands: ['Trane'] }] },
    work: { projects: [{ t: 'AC repair', caption: 'x', service: 'ac-repair' }] },
    extensions: { customerQuestions: [{ q: 'Other?', a: '', service: 'heat-pump' }] },
  };
  const done = partsDone(content, 0, 'ac-repair');
  assert.deepEqual(done, { basics: true, included: true, problems: false, towns: true, photos: true, questions: false });
  assert.deepEqual(partsProgress(done), { done: 4, of: 6 });
});

test('next and back walk the parts; the summary is last', () => {
  assert.equal(nextPart('basics'), 'included');
  assert.equal(nextPart('questions'), 'summary');
  assert.equal(nextPart('summary'), null);
  assert.equal(prevPart('basics'), null);
  assert.equal(prevPart('summary'), 'questions');
});

test('category suggestions: the industry categories and the client\'s own, never the current one twice', () => {
  const content = { services: { items: [{ tag: 'Cooling' }, { tag: 'Plans' }] } };
  assert.deepEqual(categorySuggestions(['Heating', 'Cooling', 'heating'], content, 'Cooling'), ['Heating', 'Plans']);
});
