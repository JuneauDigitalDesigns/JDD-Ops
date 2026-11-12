// The client's own questions and answers reach the page word for word: first, in the client's
// order, on the service page they are tagged to (untagged ones on the home FAQ). The copywriter
// may add questions after them, never reword, merge or drop them. Enforced after generation in
// applyGeneratedCopy, not only asked for in the prompt.
//
// The bug (Tracewell Heating & Air, 2026-11-11). The client tagged two Q&As to AC service:
//   "Do you service all brands?"   -> "Yes, every major brand."
//   "TW: Can you come Saturdays?"  -> "Yes, we can come out to you on Saturday mornings."
// The run wrote both questions back with its own answers, one of them an invented claim ("We also
// run 24/7 emergency service"). The second lost its "TW:" prefix, so the page showed the client's
// answer and then the model's. The fixture is the real draft and the real model output.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BUILT_IN_VERTICALS } from '@jdd/schema';
import { deepMerge } from '@jdd/ui/merge';
import { presetFor } from '../src/lib/verticals.ts';
import { applyGeneratedCopy } from '../src/lib/copy-brief/apply-generated.ts';
import { servicePagesInstruction } from '../src/lib/copy-brief/compile.ts';
import { resolveBrief } from '../src/lib/copy-brief/resolve.ts';
import { compileBriefPrompt } from '../src/lib/copy-brief/compile-brief.ts';
import { serviceRefs, serviceQuestions } from '../src/lib/serviceLinks.ts';

const draft = JSON.parse(readFileSync(new URL('./fixtures/copy-brief/tracewell-draft.json', import.meta.url), 'utf8'));
const preset = presetFor('hvac');
const CLIENT = [
  { q: 'Do you service all brands?', a: 'Yes, every major brand.' },
  { q: 'TW: Can you come Saturdays?', a: 'Yes, we can come out to you on Saturday mornings.' },
];

/** The content the generate route is handed: preset <- the client's intake. */
const base = (imported = draft.imported) => deepMerge(preset, imported);

/** The real run's page copy for the AC service, as the model returned it. */
const realPageCopy = () => {
  const page = draft.generated.services.items[0].page;
  return { slug: 'ac-installation-service', intro: page.intro, expect: page.expect, faq: page.faq };
};

/** The FAQ the AC service page renders, after the run is merged in. */
function acPageFaq(b, generated) {
  const content = deepMerge(b, generated);
  const ref = serviceRefs({ ...content, servicePages: ['ac-installation-service'] }).find((r) => r.slug === 'ac-installation-service');
  return serviceQuestions(content, ref).map(({ q, a }) => ({ q, a }));
}

test('the fixture is the client the bug was found on', () => {
  assert.deepEqual(draft.imported.extensions.customerQuestions.map(({ q, a }) => ({ q, a })), CLIENT);
  assert.ok(draft.imported.extensions.customerQuestions.every((q) => q.service === 'ac-installation-service'));
});

test('the service page FAQ starts with the client\'s two pairs, unchanged, and never asks them again', () => {
  const b = base();
  const generated = applyGeneratedCopy(b, { servicePages: { items: [realPageCopy()] } }, new Set(['servicePages']));
  const faq = acPageFaq(b, generated);
  assert.deepEqual(faq.slice(0, 2), CLIENT);
  const rest = faq.slice(2).map((f) => f.q.toLowerCase());
  assert.ok(!rest.some((q) => q.includes('saturdays') || q.includes('all brands')), `a client question was asked again: ${rest.join(' / ')}`);
  assert.ok(!faq.some((f) => /24\/7/.test(f.a)), 'the invented 24/7 answer is gone with its question');
  assert.ok(faq.length >= 3 && faq.length <= 5, 'the model\'s other questions still follow');
});

test('page.faq itself holds none of the model\'s rewrites of the client\'s answers', () => {
  const b = base();
  const generated = applyGeneratedCopy(b, { servicePages: { items: [realPageCopy()] } }, new Set(['servicePages']));
  const pageFaq = generated.services.items[0].page.faq;
  assert.ok(!pageFaq.some((f) => /Saturdays|all brands/i.test(f.q)));
  assert.equal(pageFaq.length, 3, 'the model\'s three other questions are kept');
});

test('the model is told the client\'s pairs are fixed, with their answers', () => {
  const line = servicePagesInstruction(base());
  assert.ok(line.includes('"fixedQuestions"'));
  for (const { q, a } of CLIENT) {
    assert.ok(line.includes(JSON.stringify(q)), `fixed question missing: ${q}`);
    assert.ok(line.includes(JSON.stringify(a)), `fixed answer missing: ${a}`);
  }
  assert.match(line, /never repeat, reword or merge them/);
});

test('an untagged client pair goes first on the home FAQ, word for word, and the model\'s version of it is dropped', () => {
  const imported = structuredClone(draft.imported);
  imported.extensions.customerQuestions.push({ q: 'TW: Do you   finance?', a: ' Yes, through our bank partner. ' });
  const model = [
    { q: 'Do you finance?', a: 'Invented: 0% for 24 months.' },
    { q: 'Do you work in my area?', a: 'Winter Park, Maitland and Oviedo.' },
    { q: 'How soon can you come?', a: 'Within 2 hours.' },
  ];
  const generated = applyGeneratedCopy(base(imported), { faq: { eyebrow: 'E', title: 'T', sub: 'S', items: model } }, new Set(['faq']));
  assert.deepEqual(generated.faq.items, [
    { q: 'TW: Do you   finance?', a: ' Yes, through our bank partner. ' }, // exact text, spacing included
    model[1], model[2],
  ]);
});

test('a pair tagged to a service with no page of its own lands on the home FAQ rather than nowhere', () => {
  const imported = structuredClone(draft.imported);
  imported.extensions.customerQuestions.push({ q: 'Do you check attic fans in winter?', a: 'Yes, all year.', service: 'tw-attic-fan-check' });
  const generated = applyGeneratedCopy(base(imported), { faq: { items: [{ q: 'Other?', a: 'Yes.' }] } }, new Set(['faq']));
  assert.deepEqual(generated.faq.items[0], { q: 'Do you check attic fans in winter?', a: 'Yes, all year.' });
});

test('the home FAQ prompt names the fixed pairs when the client has untagged ones', () => {
  const imported = structuredClone(draft.imported);
  imported.extensions.customerQuestions.push({ q: 'Do you finance?', a: 'Yes, through our bank partner.' });
  const vertical = BUILT_IN_VERTICALS.find((v) => v.id === 'hvac');
  const ctx = { vertical, effective: base(imported), imported, preset, edits: {}, brief: { blocks: {}, customFields: [] }, tickedSections: ['faq'] };
  const { user } = compileBriefPrompt(ctx, resolveBrief(ctx), ['faq']);
  assert.match(user, /The client's own questions and answers\. They appear first in the FAQ exactly as written/);
  assert.ok(user.includes('"Yes, through our bank partner."'));
  const { user: seoOnly } = compileBriefPrompt(ctx, resolveBrief(ctx), ['seo']);
  assert.ok(!seoOnly.includes('bank partner'), 'only a chunk that writes the FAQ carries it');
});
