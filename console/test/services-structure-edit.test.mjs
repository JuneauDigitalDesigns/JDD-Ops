// Xander, 2026-11-12, the #93 follow-up: adding or removing a service saved the whole
// services.items list as an edit, copy and all. Edits outrank the generated layer, so every later
// copy run's service card text (d, detail, page.*) was hidden under that snapshot.
//
// Add and remove now record only the structure: which services exist, in what order, their
// slugs, names, tags and the client's facts. A card's copy keeps flowing from the generated layer,
// matched to its service by slug, then name. An operator's own hand edit still wins.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { applyEdits, deepMerge } from '@jdd/ui/merge';
import { removeService } from '../src/lib/service-remove.ts';
import { addServiceItems, hydrateServiceItems } from '../src/lib/service-structure.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const imported = {
  services: {
    eyebrow: 'Services', title: 'What we do', sub: '',
    items: [
      { n: '01', t: 'AC repair', d: 'Client blurb.', tag: 'Cooling', included: ['Diagnostic'] },
      { n: '02', t: 'Heat pump service', d: '', tag: 'Heating' },
      { n: '03', t: 'Duct cleaning', d: '', tag: 'Air' },
    ],
  },
};

/** One copy run: the generated layer's services, built from the base exactly as
 *  apply-generated.ts does (base item, then the model's d / detail / page on top). */
const run = (base, tagLine) => ({
  services: {
    ...base.services,
    items: base.services.items.map((it) => ({
      ...it,
      d: `${tagLine}: ${it.t} card.`,
      detail: `${tagLine}: ${it.t} detail.`,
      page: { intro: `${tagLine}: ${it.t} page.`, body: [] },
    })),
  },
});

/** The merge the Studio previews and exports (effectiveContent), services only. */
const effective = (generated, edits) =>
  applyEdits(deepMerge(deepMerge({}, imported), generated ?? {}), hydrateServiceItems(edits, deepMerge(deepMerge({}, imported), generated ?? {})));

const sources = (edits, generated) => ({ edits, generated, imported, preset: {} });

test('remove a service, run copy again: the new card text shows', () => {
  const gen1 = run(imported, 'Run 1');
  let edits = {};
  const before = effective(gen1, edits);
  for (const [p, v] of Object.entries(removeService(before, 0, sources(edits, gen1)))) edits = { ...edits, [p]: v };
  let now = effective(gen1, edits);
  assert.deepEqual(now.services.items.map((i) => i.t), ['Heat pump service', 'Duct cleaning']);
  assert.equal(now.services.items[0].d, 'Run 1: Heat pump service card.', 'copy still flows after the removal');

  const gen2 = run(now, 'Run 2');
  now = effective(gen2, edits);
  assert.deepEqual(now.services.items.map((i) => i.d), ['Run 2: Heat pump service card.', 'Run 2: Duct cleaning card.']);
  assert.equal(now.services.items[1].detail, 'Run 2: Duct cleaning detail.');
  assert.equal(now.services.items[1].page.intro, 'Run 2: Duct cleaning page.');
});

test('add a service, run copy again: every card, the new one included, shows the new text', () => {
  const gen1 = run(imported, 'Run 1');
  let edits = {};
  const before = effective(gen1, edits);
  edits = { ...edits, 'services.items': addServiceItems(before, sources(edits, gen1)) };
  let now = effective(gen1, edits);
  assert.equal(now.services.items.length, 4);
  assert.equal(now.services.items[3].t, 'New service');
  assert.ok(!now.services.items[3].d, 'a new service has no copy until the next run');
  assert.equal(now.services.items[0].d, 'Run 1: AC repair card.');

  const gen2 = run(now, 'Run 2');
  now = effective(gen2, edits);
  assert.deepEqual(now.services.items.map((i) => i.d), [
    'Run 2: AC repair card.', 'Run 2: Heat pump service card.', 'Run 2: Duct cleaning card.', 'Run 2: New service card.',
  ]);
});

test('an operator\'s own hand edit to one card still wins, through a removal and a later run', () => {
  const gen1 = run(imported, 'Run 1');
  let edits = { 'services.items.2.d': 'Typed by hand.' };
  const before = effective(gen1, edits);
  assert.equal(before.services.items[2].d, 'Typed by hand.');
  for (const [p, v] of Object.entries(removeService(before, 0, sources(edits, gen1)))) {
    // setField's whole-array write drops the leaf edits beneath it.
    edits = Object.fromEntries(Object.entries(edits).filter(([k]) => !k.startsWith(`${p}.`)));
    edits = { ...edits, [p]: v };
  }
  const gen2 = run(effective(gen1, edits), 'Run 2');
  const now = effective(gen2, edits);
  assert.equal(now.services.items[1].t, 'Duct cleaning');
  assert.equal(now.services.items[1].d, 'Typed by hand.', 'the hand edit moved with its service and still wins');
  assert.equal(now.services.items[0].d, 'Run 2: Heat pump service card.');
});

test('the structural list keeps the client\'s names, tags, facts and pinned slugs, not copy', () => {
  const gen1 = run(imported, 'Run 1');
  const w = removeService(effective(gen1, {}), 1, sources({}, gen1));
  const items = w['services.items'];
  assert.deepEqual(items.map((i) => [i.t, i.tag]), [['AC repair', 'Cooling'], ['Duct cleaning', 'Air']]);
  assert.deepEqual(items[0].included, ['Diagnostic']);
  for (const it of items) for (const f of ['d', 'detail', 'page']) assert.ok(!(f in it), `${it.t} carries no ${f}`);
});

test('the Services step writes through the structural helpers', () => {
  const src = readFileSync(path.join(ROOT, 'src/components/wizard/intake/ServicesStep.tsx'), 'utf8');
  assert.match(src, /addServiceItems\(content, /);
  assert.match(src, /removeService\(content, idx, /);
  const eff = readFileSync(path.join(ROOT, 'src/lib/effectiveContent.ts'), 'utf8');
  assert.match(eff, /hydrateServiceItems\(edits, /);
});

test('regenerating a card part on Review writes to the generated layer under a structural list', async () => {
  const { applyParts } = await import('../src/lib/review-parts.ts');
  const generated = { services: { items: [{ t: 'AC repair', d: 'Old card.' }] } };
  const fresh = { services: { items: [{ t: 'AC repair', d: 'New card.' }] } };
  const structuralList = { 'services.items': [{ t: 'AC repair', tag: 'Cooling' }] };
  const r = applyParts(generated, fresh, ['services.items.0.d'], structuralList);
  assert.deepEqual(r.edits, {}, 'the list holds no card copy, so nothing there was typed by hand');
  assert.equal(r.sections.services.items[0].d, 'New card.');
  // A list that does carry hand-typed copy for that card still takes the new text as an edit.
  const hand = applyParts(generated, fresh, ['services.items.0.d'], { 'services.items': [{ t: 'AC repair', d: 'Typed.' }] });
  assert.deepEqual(hand.edits, { 'services.items.0.d': 'New card.' });
});

test('the Studio\'s own merge (effectiveContent) shows a later run\'s card text after an add', async () => {
  const { effectiveContent } = await import('../src/lib/effectiveContent.ts');
  const gen1 = run(imported, 'Run 1');
  const before = effectiveContent('hvac', imported, gen1, {});
  const edits = { 'services.items': addServiceItems(before, sources({}, gen1)) };
  const after1 = effectiveContent('hvac', imported, gen1, edits);
  assert.equal(after1.services.items.length, 4);
  const gen2 = run(after1, 'Run 2');
  const after2 = effectiveContent('hvac', imported, gen2, edits);
  assert.deepEqual(after2.services.items.map((i) => i.d), [
    'Run 2: AC repair card.', 'Run 2: Heat pump service card.', 'Run 2: Duct cleaning card.', 'Run 2: New service card.',
  ]);
});
