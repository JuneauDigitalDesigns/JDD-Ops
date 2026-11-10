// SEO plan D5 layer 2 (Xander, 2026-11-10): any generated field with an em- or en-dash goes back
// to the model once to be rewritten; if a dash is still there, the section is rejected and shows
// as needing review. Never a silent swap: "x — y" becoming "x, y" can read wrong.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { findDashes, guardDashes, dashRewriteMessage } from '../src/lib/copy-brief/dash-guard.ts';

test('findDashes names every string field carrying an em- or en-dash, by path', () => {
  const r = {
    hero: { headline: 'Fast AC repair — same week', sub: 'Plain sentence.' },
    faq: { items: [{ q: 'How long?', a: 'Usually 1–2 hours.' }, { q: 'Ok', a: 'Fine' }] },
    seo: { title: 'AC Repair in Clermont | Peak' },
  };
  assert.deepEqual(findDashes(r), ['hero.headline', 'faq.items.0.a']);
  assert.deepEqual(findDashes({ a: 'clean - hyphen is fine' }), []);
});

test('a clean result passes through with no rewrite', async () => {
  let calls = 0;
  const out = await guardDashes({ hero: { headline: 'Clean' } }, async () => { calls++; return {}; });
  assert.deepEqual(out, { result: { hero: { headline: 'Clean' } }, rewritten: false, stillDashed: [] });
  assert.equal(calls, 0);
});

test('a dashed result is rewritten once, and the rewrite is used when it is clean', async () => {
  const asked = [];
  const out = await guardDashes({ hero: { headline: 'Fast — today' } }, async (paths) => {
    asked.push(paths);
    return { hero: { headline: 'Fast, today' } };
  });
  assert.deepEqual(asked, [['hero.headline']]);
  assert.deepEqual(out, { result: { hero: { headline: 'Fast, today' } }, rewritten: true, stillDashed: [] });
});

test('a rewrite that still has a dash is reported, never silently fixed, and never retried twice', async () => {
  let calls = 0;
  const out = await guardDashes({ faq: { items: [{ q: 'x', a: 'a — b' }] } }, async () => {
    calls++;
    return { faq: { items: [{ q: 'x', a: 'still – here' }] } };
  });
  assert.equal(calls, 1);
  assert.deepEqual(out.stillDashed, ['faq.items.0.a']);
  assert.equal(out.result.faq.items[0].a, 'still – here', 'the guard must not edit the text itself');
});

test('the rewrite message names the fields and the rule', () => {
  const m = dashRewriteMessage(['hero.headline', 'faq.items.0.a']);
  assert.match(m, /hero\.headline, faq\.items\.0\.a/);
  assert.match(m, /em-dash or en-dash/);
  assert.ok(!/[–—]/.test(m), 'the instruction itself must not contain a dash');
});

test('generate-copy runs every chunk through the guard and fails a section that stays dashed', () => {
  const s = readFileSync(fileURLToPath(new URL('../src/app/api/build/generate-copy/route.ts', import.meta.url)), 'utf8');
  assert.match(s, /guardDashes\(/, 'route does not call guardDashes');
  assert.match(s, /stillDashed\.length/, 'route does not act on fields that stayed dashed');
});
