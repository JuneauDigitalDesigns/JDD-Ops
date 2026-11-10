// The sales tool's copy (src/lib/sales-tool.ts).
//
// The call script it replaced was being read out on sales calls with the pre-reprice figures:
// Growth at $297, Starter at $117 plus $100 setup, "no onboarding fee right now", and "cancel with
// thirty days notice". Schedule A had moved to $197 / $497 / $1,097 with no notice period weeks
// earlier, and nothing noticed, because nothing compared the two. These tests pin the shape of
// the figures the tool now quotes and keep the old ones from coming back.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  OBJECTIONS,
  KEY_POINTS,
  TIERS,
  allVisibleCopy,
  searchSalesTool,
} from '../src/lib/sales-tool.ts';

const dollars = (s) => Number(s.replace(/[^\d]/g, ''));

test('no em-dashes or en-dashes anywhere in the copy (house rule)', () => {
  const bad = allVisibleCopy().filter((s) => /[–—]/.test(s));
  assert.deepEqual(bad, []);
});

test('none of the stale figures the old script quoted come back', () => {
  const all = allVisibleCopy().join('\n').toLowerCase();
  for (const stale of ['$117', '$100 setup', 'no onboarding fee', 'thirty days notice', '60 days', 'six hundred']) {
    assert.ok(!all.includes(stale), `stale figure "${stale}" is back in the sales tool`);
  }
  // $297 is still a real number (the setup fee), but never a monthly price any more.
  assert.ok(TIERS.every((t) => t.monthly !== '$297'), 'a plan is quoted at the old $297 a month');
});

test('prices are Schedule A: $197 / $497 / $1,097, annual is ten months of monthly', () => {
  assert.deepEqual(
    TIERS.map((t) => [t.id, dollars(t.monthly)]),
    [['starter', 197], ['growth', 497], ['enterprise', 1097]],
  );
  for (const t of TIERS) assert.equal(dollars(t.annual), dollars(t.monthly) * 10, `${t.id} annual price`);
  assert.deepEqual(TIERS.map((t) => dollars(t.setup)), [297, 297, 697]);
});

test('every "Answered by" link points at a key point that exists', () => {
  const ids = new Set(KEY_POINTS.map((k) => k.id));
  for (const o of OBJECTIONS) if (o.answeredBy) assert.ok(ids.has(o.answeredBy), `${o.id} -> ${o.answeredBy}`);
});

test('search finds the price objection by the words a prospect actually uses', () => {
  for (const q of ['price', 'expensive', 'COST']) {
    assert.equal(searchSalesTool(q).objections[0]?.id, 'too-expensive', q);
  }
  assert.deepEqual(searchSalesTool('   '), { objections: [], keyPoints: [], planRows: [] });
});
