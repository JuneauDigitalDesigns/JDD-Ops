// "A testimonial is never generated" (operator decision, 2026-11-10). The same rule as PLAN D4's
// stats, for the same reason: a review is a fact about the business, a real customer's words,
// never something the copywriter originates.
//
// What shipped: buildScaffold seeds three blank testimonial slots, countsFor read that as "3",
// and the prompt told the model to write "exactly 3 items {q = quote, a = "First L.", ...}". So
// every generated client site carried three invented five-star quotes, and the template's
// structured data then marked them up as schema.org Review nodes. Guarded at every layer the
// copywriter path touches, as no-generated-stats.test.mjs does: the output schema, the prompt
// line, the structure counts and the merge.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCopySchema } from '../src/lib/copy-schema.ts';
import { sectionInstructionLine, countsFor } from '../src/lib/copy-brief/compile.ts';
import { applyGeneratedCopy } from '../src/lib/copy-brief/apply-generated.ts';

const blank = () => ({ q: '', a: '', r: '', company: null, stars: 5 });

function baseSite(testimonials = { eyebrow: '', title: '', items: [blank(), blank(), blank()] }) {
  return {
    about: { eyebrow: '', title: '', body: '', pillars: [], stats: [], seasons: null },
    hero: { headline: '', headlineEmphasis: null, frictionReducers: [], heroBullets: [] },
    services: { eyebrow: '', title: '', sub: '', items: [] },
    testimonials,
    faq: { eyebrow: '', title: '', sub: '', items: [] },
    finalCta: { eyebrow: '', headline: '', headlineEmphasis: null, sub: '', cta: '', secondary: null, frictionReducers: [] },
    brand: { tagline: '' },
    announcement: null,
    trust: { label: '', logos: [] },
    footer: { blurb: '' },
    seo: { title: '', description: '' },
  };
}

test("the model's output schema offers a reviews heading but no review items", () => {
  const schema = buildCopySchema(['testimonials'], false);
  const t = schema.properties.testimonials;
  assert.ok(!('items' in t.properties), 'testimonials.items is still offered to the model');
  assert.ok(!t.required.includes('items'), 'testimonials.items is still required of the model');
  assert.deepEqual(Object.keys(t.properties).sort(), ['eyebrow', 'title']);
});

test('the testimonials prompt line never asks for quotes, whatever the slot count', () => {
  for (const base of [baseSite(), baseSite({ eyebrow: '', title: '', items: [] })]) {
    const line = sectionInstructionLine('testimonials', countsFor(base));
    assert.ok(!/exactly \d+ items|q = quote|"First L\."|stars = /i.test(line), `testimonials line still asks for quotes: ${line}`);
    assert.match(line, /never write/i, 'the line must say outright that quotes are never written');
  }
});

test('the structure counts sent to the model carry no testimonial count', () => {
  // "keep these exact counts: { testimonials: 3 }" is an instruction to write three.
  assert.ok(!('testimonials' in countsFor(baseSite())), 'countsFor still reports a testimonial count');
});

test('applyGeneratedCopy: blank slots stay blank even if the model returns quotes', () => {
  const base = baseSite();
  // CopyResult.testimonials has no `items` at the type level any more; a cast-free JS payload is
  // the only way to build what the types now forbid, and proves the runtime merge holds too.
  const hostile = {
    testimonials: {
      eyebrow: 'Reviews', title: 'What neighbours say',
      items: [{ q: 'Fixed our AC at midnight. Amazing!', a: 'Michael R.', r: 'Homeowner', stars: 5 }],
    },
  };
  const generated = applyGeneratedCopy(base, hostile, new Set(['testimonials']));
  assert.deepEqual(generated.testimonials.items, base.testimonials.items);
  assert.equal(generated.testimonials.eyebrow, 'Reviews');
  assert.equal(generated.testimonials.title, 'What neighbours say');
});

test('applyGeneratedCopy: a real review the client supplied survives generation untouched', () => {
  const real = { q: 'Came out the same afternoon and explained everything.', a: 'Dana P.', r: 'Clermont', company: null, stars: 5 };
  const base = baseSite({ eyebrow: '', title: '', items: [real] });
  const hostile = { testimonials: { eyebrow: 'E', title: 'T', items: [{ q: 'Invented', a: 'Nobody', r: 'x', stars: 5 }] } };
  const generated = applyGeneratedCopy(base, hostile, new Set(['testimonials']));
  assert.deepEqual(generated.testimonials.items, [real]);
});

test('applyGeneratedCopy: the slot array is never emptied (an empty array lets the preset quotes through)', () => {
  // deepMerge treats [] as missing, so `effective = preset <- imported <- generated` would fall
  // through to the vertical preset's sample quotes. Passing the base array through keeps the
  // blank slots, which the review sections already skip (`filter((t) => t.q?.trim())`).
  const base = baseSite();
  const generated = applyGeneratedCopy(base, { testimonials: { eyebrow: 'E', title: 'T', items: [] } }, new Set(['testimonials']));
  assert.equal(generated.testimonials.items.length, 3);
});
