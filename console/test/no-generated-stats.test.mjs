// PLAN D4 / EXEC T4.5 — "a statistic is never generated." Guards the console's copywriter path
// at every layer it touches: the model's own output schema, the prompt instruction text, and the
// merge that turns the model's JSON into the shipped SiteContent. Each layer is tested
// independently because a regression could reintroduce the hole at any one of them without
// touching the others (that is exactly how the original bug shipped — the schema offered
// `stats`, the prompt told the model "write exactly N stats", and the merge accepted whatever
// came back).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCopySchema } from '../src/lib/copy-schema.ts';
import { sectionInstructionLine, countsFor } from '../src/lib/copy-brief/compile.ts';
import { applyGeneratedCopy } from '../src/lib/copy-brief/apply-generated.ts';

function baseSite(overrides = {}) {
  return {
    about: { eyebrow: '', title: '', body: '', pillars: [], stats: [], seasons: null, ...overrides.about },
    hero: { headline: '', headlineEmphasis: null, frictionReducers: [], heroBullets: [] },
    services: { eyebrow: '', title: '', sub: '', items: [] },
    testimonials: { eyebrow: '', title: '', items: [] },
    faq: { eyebrow: '', title: '', sub: '', items: [] },
    finalCta: { eyebrow: '', headline: '', headlineEmphasis: null, sub: '', cta: '', secondary: null, frictionReducers: [] },
    brand: { tagline: '' },
    announcement: null,
    trust: { label: '', logos: [] },
    footer: { blurb: '' },
    seo: { title: '', description: '' },
    ...overrides,
  };
}

test("the model's own output schema has no stats property at all", () => {
  const schema = buildCopySchema(['about'], false);
  assert.ok(!('stats' in schema.properties.about.properties), 'about.stats is still offered to the model');
});

test('the about prompt instruction never mentions stats', () => {
  const counts = countsFor(baseSite());
  const line = sectionInstructionLine('about', counts);
  assert.ok(!/stat/i.test(line), `about instruction still mentions stats: ${line}`);
});

test('applyGeneratedCopy: empty stats in, empty stats out, even if the model tries to contribute some', () => {
  const base = baseSite();
  // CopyResult.about no longer has a `stats` field at the type level, but this proves the RUNTIME
  // merge is also safe against a malformed/hostile payload, not just a well-typed one — a cast
  // through `any` is the only way to construct the scenario the type system now forbids by
  // construction, which is the whole point of testing it here as well as at the type level.
  const hostile = { about: { eyebrow: 'E', title: 'T', body: 'B', pillars: [], stats: [{ n: '99%', l: 'Invented' }] } };
  const generated = applyGeneratedCopy(base, hostile, new Set(['about']));
  assert.deepEqual(generated.about.stats, []);
});

test('applyGeneratedCopy: a client-supplied stat survives copy generation untouched', () => {
  const base = baseSite({ about: { stats: [{ n: '24/7', l: 'Emergency service' }] } });
  const hostile = { about: { eyebrow: 'E', title: 'T', body: 'B', pillars: [], stats: [{ n: '99%', l: 'Invented' }] } };
  const generated = applyGeneratedCopy(base, hostile, new Set(['about']));
  // The model's invented {n:"99%"} must not overwrite the client's real {n:"24/7"}.
  assert.deepEqual(generated.about.stats, [{ n: '24/7', l: 'Emergency service' }]);
});

test('applyGeneratedCopy: about.seasons is never touched by generated copy', () => {
  const base = baseSite({ about: { seasons: [{ key: 'spring', label: 'Spring', body: 'First feed' }] } });
  const generated = applyGeneratedCopy(base, { about: { eyebrow: 'E', title: 'T', body: 'B', pillars: [] } }, new Set(['about']));
  assert.deepEqual(generated.about.seasons, [{ key: 'spring', label: 'Spring', body: 'First feed' }]);
});
