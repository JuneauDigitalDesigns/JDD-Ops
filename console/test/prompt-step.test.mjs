// The Prompt step, read sideways (Xander, 2026-11-10, approved as the "Prompt v2" mockup): "It
// should scroll horizontally", with arrows on either side, and the sidebar becomes a small box above
// the nav that steps through the sections (a switch, not a checkbox), the model and its estimate,
// then a summary over "Generate N sections". The step was the one place in the intake that still
// scrolled down inside its pane.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { RUN_STEPS, SWITCHABLE, switchSection, runSummary, generateLabel } from '../src/lib/run-steps.ts';
import { columnLayout, columnStep, MIN_WIDTH, GAP } from '../src/lib/prompt-columns.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(path.join(ROOT, p), 'utf8');

test('the box steps are the approved headers, in order', () => {
  assert.deepEqual(RUN_STEPS.map((s) => s.label), [
    'Top of the home page', 'Middle of the home page', 'Bottom of the home page', 'Other pages', 'Model', 'Summary',
  ]);
});

test('every section a run can write is under exactly one header', () => {
  const grouped = RUN_STEPS.flatMap((s) => (s.kind === 'sections' ? s.sections : []));
  assert.deepEqual([...grouped].sort(), [...SWITCHABLE].sort());
  assert.equal(new Set(grouped).size, grouped.length);
  assert.ok(!grouped.includes('brand'));
});

test('a switch turns one section on or off and keeps the write order', () => {
  assert.deepEqual(switchSection(['hero', 'faq'], 'announcement', true), ['announcement', 'hero', 'faq']);
  assert.deepEqual(switchSection(['announcement', 'hero', 'faq'], 'hero', false), ['announcement', 'faq']);
  assert.deepEqual(switchSection(['hero'], 'hero', true), ['hero']);
});

test('the summary counts what is on and names what is off', () => {
  const on = SWITCHABLE.filter((s) => !['trust', 'work', 'testimonials'].includes(s));
  assert.deepEqual(runSummary(on), { on: 10, of: 13, off: ['Trust', 'Work', 'Testimonials'] });
  assert.equal(generateLabel(10, false), 'Generate 10 sections');
  assert.equal(generateLabel(1, true), 'Regenerate 1 section');
});

test('columns fill the track exactly, and an arrow moves one column', () => {
  const l = columnLayout(1296);
  assert.equal(l.count, 3);
  assert.ok(Math.abs(l.count * l.width + (l.count - 1) * GAP - 1296) < 1e-9);
  assert.ok(l.width >= MIN_WIDTH);
  assert.equal(columnLayout(200).count, 1);
  const step = l.width + l.gap;
  assert.equal(columnStep(0, l, 1), step);
  assert.equal(columnStep(step, l, 1), 2 * step);
  assert.equal(columnStep(step, l, -1), 0);
  assert.equal(columnStep(0, l, -1), 0);
  // Part-way through a column (after the wheel): the arrow lines up the nearest edge that way.
  assert.equal(columnStep(step * 1.5, l, 1), 2 * step);
  assert.equal(columnStep(step * 1.5, l, -1), step);
});

test('the prompt pane no longer scrolls down; the wheel moves it sideways', () => {
  const view = read('src/components/wizard/prompt/PromptPlainView.tsx');
  assert.match(view, /overflow-x-auto overflow-y-hidden/);
  assert.match(view, /addEventListener\('wheel', onWheel, \{ passive: false \}\)/);
  assert.match(view, /t\.scrollLeft \+= e\.deltaY/);
  assert.match(view, /aria-label="Previous column"/);
  assert.match(view, /aria-label="Next column"/);
  const stage = read('src/components/wizard/prompt/PromptStage.tsx');
  assert.doesNotMatch(stage, /overflow-y-auto/);
  assert.doesNotMatch(stage, /w-\[300px\]/);
});

test('the run box uses switches, the approved wording, and no checkboxes', () => {
  const box = read('src/components/wizard/prompt/RunControls.tsx');
  assert.doesNotMatch(box, /type="checkbox"/);
  assert.match(box, /role="switch"/);
  assert.match(box, /Next: Summary/);
  for (const term of ['"Sections"', '"Off"', '"Model"', '"Estimated cost"']) assert.ok(box.includes(`term=${term}`), term);
  // Switched-on sections, not tickedSections.length: tickedSections also holds per-page review
  // keys ("about:subpages") that a run never writes (subpages-copy.test.mjs).
  assert.match(box, /generateLabel\(summary\.on, hasGenerated\)/);
  assert.match(box, /disabled=\{busy \|\| summary\.on === 0\}/);
  // Removed with the sidebar (approved): the All / None toggle and the two explanatory lines.
  assert.doesNotMatch(box, /Only what&apos;s ticked is written/);
  assert.doesNotMatch(box, /Input is exact; output is a working guess/);
  assert.doesNotMatch(box, /allTicked/);
});
