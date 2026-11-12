// Xander, 2026-11-12: the Prompt step's run box becomes "a hidden menu where there is a button that
// floats at the bottom right, and when pressed it opens up a modal that covers over the prompt and
// has an entire window with all of the sections and their switches, and shows the models and has
// the button for generation. That way when we click on the generate button, we can see each step
// streaming in and its progress as it goes." Approved as the canvas's row 6, word for word.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { RUN_GROUPS, statusLabel, runProgress, MENU_LABEL, RUNNING_LABEL } from '../src/lib/run-steps.ts';
import { sectionPreview } from '../src/lib/copy-brief/section-preview.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(path.join(ROOT, p), 'utf8');

test('the menu shows the four approved groups side by side', () => {
  assert.deepEqual(RUN_GROUPS.map((g) => g.label), ['Top of the home page', 'Middle of the home page', 'Bottom of the home page', 'Other pages']);
  assert.equal(MENU_LABEL, 'Sections and model');
  assert.equal(RUNNING_LABEL, 'Generating');
});

test('each section says where it is in the run, in the approved words', () => {
  assert.equal(statusLabel(undefined, true), 'Waiting');
  assert.equal(statusLabel('idle', true), 'Waiting');
  assert.equal(statusLabel('writing', true), 'Writing');
  assert.equal(statusLabel('done', true), 'Done');
  assert.equal(statusLabel('failed', true), 'Failed');
  assert.equal(statusLabel('skipped', true), 'Not written');
  assert.equal(statusLabel(undefined, false), 'Off');
});

test('progress counts finished sections out of those switched on', () => {
  const st = { hero: 'done', faq: 'writing', about: 'failed', seo: 'skipped' };
  assert.deepEqual(runProgress(st, ['hero', 'faq', 'about', 'seo', 'footer']), { done: 3, of: 5 });
});

test('a finished section shows its first lines', () => {
  assert.equal(sectionPreview('hero', { hero: { eyebrow: 'Winter Park', headline: 'AC repair in Winter Park, with the price before we start.', sub: 'x' } }),
    'AC repair in Winter Park, with the price before we start.');
  assert.equal(sectionPreview('announcement', { announcement: { text: 'Spring tune-ups are booking now.' } }), 'Spring tune-ups are booking now.');
  assert.equal(sectionPreview('faq', { faq: { items: [{ q: 'Do you work Saturdays?', a: 'Yes.' }] } }), 'Do you work Saturdays?');
  assert.equal(sectionPreview('services', { services: { items: [{ t: 'AC repair' }, { t: 'Duct cleaning' }] } }), 'AC repair · Duct cleaning');
  assert.equal(sectionPreview('about', {}), undefined);
  const long = sectionPreview('about', { about: { story: 'word '.repeat(80) } });
  assert.ok(long.length <= 141 && long.endsWith('…'));
});

test('the run sends each finished section\'s first lines as it lands', () => {
  const route = read('src/app/api/build/generate-copy/route.ts');
  assert.match(route, /send\(\{ type: 'section', section: s, status: 'done', preview: sectionPreview\(s, result\) \}\)/);
});

test('a floating button opens the menu over the prompt; the old stepping box is gone', () => {
  const ui = read('src/components/wizard/prompt/RunControls.tsx');
  assert.match(ui, /\{MENU_LABEL\}/);
  assert.match(ui, /role="dialog"/);
  assert.match(ui, /RUNNING_LABEL/);
  assert.match(ui, /\{progress\.done\} of \{progress\.of\} sections/);
  assert.match(ui, /previews\[s\]/);
  assert.doesNotMatch(ui, /aria-label="Previous"/);
  assert.doesNotMatch(ui, /Next: Summary/);
  assert.doesNotMatch(ui, /h-\[316px\] w-\[340px\]/);
});
