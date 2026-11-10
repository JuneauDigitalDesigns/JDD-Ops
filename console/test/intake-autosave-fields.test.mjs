// Intake autosave, field by field (Xander, 2026-11-10): "when we type it in and then click away,
// it should save automatically. We shouldn't have to press the save button." Before this, three
// intake inputs held typed text in local state until a button: a Business fact row (Save), a
// chip list's add box (Add) and a review (Save review). A step change, a reload or a closed tab
// lost it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { typeLiveChip, settleLiveChip } from '../src/lib/live-chip.ts';
import { EMPTY_DRAFT, draftMissing, applyDraft, draftFromReview } from '../src/lib/review-draft.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel) => readFileSync(path.join(ROOT, rel), 'utf8');

test('chip box: the item being typed is already in the saved list', () => {
  let s = typeLiveChip(['Diagnostic'], null, 'R');
  assert.deepEqual(s, { values: ['Diagnostic', 'R'], live: 1 });
  s = typeLiveChip(s.values, s.live, 'Refrigerant check');
  assert.deepEqual(s.values, ['Diagnostic', 'Refrigerant check'], 'saved before any Add or Enter');
  // Clearing the box removes it again.
  assert.deepEqual(typeLiveChip(s.values, s.live, '  '), { values: ['Diagnostic'], live: null });
});

test('chip box: settling keeps the typed item, and drops it only as a duplicate', () => {
  assert.deepEqual(settleLiveChip(['Diagnostic', 'Refrigerant check'], 1), ['Diagnostic', 'Refrigerant check']);
  assert.deepEqual(settleLiveChip(['Diagnostic', 'diagnostic'], 1), ['Diagnostic']);
  assert.deepEqual(settleLiveChip(['Diagnostic'], null), ['Diagnostic']);
});

test('review: a draft is never a review until complete, then saves without a button', () => {
  const items = [{ q: '', a: '', r: '', company: null, stars: 5 }];
  const d = { ...EMPTY_DRAFT, q: 'Fixed our AC the same morning.', a: 'Dana P.', sourceUrl: 'https://g.co/x' };
  assert.deepEqual(draftMissing(d), ['the word-for-word tick']);
  assert.equal(applyDraft(items, d), null, 'nothing written while incomplete');
  const done = applyDraft(items, { ...d, verbatim: true });
  assert.equal(done.index, 0, 'fills the blank slot, never leaves []');
  assert.equal(done.items[0].q, 'Fixed our AC the same morning.');
  assert.equal(done.items[0].source, 'google');
  // Further typing writes straight to that review.
  const edited = applyDraft(done.items, { ...d, verbatim: true, index: 0, a: 'Dana Perez' });
  assert.equal(edited.items[0].a, 'Dana Perez');
  assert.equal(edited.items.length, 1);
});

test('review: a public review needs its link; a pre-provenance review must be re-ticked to change', () => {
  assert.ok(draftMissing({ ...EMPTY_DRAFT, q: 'x', a: 'y', verbatim: true }).includes('review link'));
  assert.deepEqual(draftMissing({ ...EMPTY_DRAFT, source: 'client', q: 'x', a: 'y', verbatim: true }), []);
  assert.equal(draftFromReview({ q: 'Old one', a: 'A.', r: '', stars: 5 }, 2).verbatim, false);
  assert.equal(draftFromReview({ q: 'New', a: 'B.', r: '', stars: 5, source: 'client' }, 0).verbatim, true);
});

test('no intake field waits on a Save button any more (the JSON editor excepted)', () => {
  const ui = src('src/components/wizard/intake/ui.tsx');
  assert.doesNotMatch(ui, /aria-label=\{`Save \$\{label\}`\}/, 'fact rows have no Save button');
  assert.match(ui, /onChange=\{\(e\) => change\(e\.target\.value\)\}/, 'fact rows write as typed');
  assert.match(ui, /onChange=\{\(e\) => type\(e\.target\.value\)\}/, 'chip boxes write as typed');
  const reviews = src('src/components/wizard/intake/ReviewsStep.tsx');
  assert.doesNotMatch(reviews, /Save review|Save changes/);
  assert.doesNotMatch(reviews, /useState<Draft>/, 'the draft is the wizard bundle\'s, not local state');
  const wizard = src('src/app/c/[slug]/build/BuildWizard.tsx');
  assert.match(wizard, /reviewDraft\?: ReviewDraft \| null;/, 'the review draft is saved in the bundle');
});
