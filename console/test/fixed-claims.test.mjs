// Fixed template text promises nothing the client's facts may not support (Xander, 2026-11-10,
// wording file section C: "Reword all to promise nothing"). A sentence hard-coded in a catalog
// component ships on EVERY client of that vertical, whatever that client offers, so no client fact
// can ever support it. copyRisks scans the content; this scans the templates, with the same claim
// detector (claimsIn), so the two can't disagree about what a claim is.
//
// PENDING holds the claims found on 2026-11-10 that await Xander's word-for-word approval of their
// rewording (seo-wording-for-approval.md, section D). The test passes with exactly those, fails on
// any NEW hard-coded claim, and fails when a pending one is fixed without being removed here, so
// the list can only shrink. When the approved rewording lands, PENDING empties.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { claimsIn } from '../src/lib/copyRisks.ts';

const CATALOG = fileURLToPath(new URL('../src/components/catalog', import.meta.url));

const stripComments = (src) =>
  src
    .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, ' ')
    .split(/\r?\n/)
    .map((line) => line.replace(/(^|[^:'"\x60\\])\/\/.*$/, '$1'))
    .join('\n');

const decode = (t) =>
  t.replace(/&rsquo;|&apos;|&#39;/g, "'").replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ');

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.tsx') ? [p] : [];
  });
}

/** Every visible text run in every catalog component (JSX text, which may span lines, and quoted
 *  string literals), with the claims it makes. Exported so the wording file's list is generated
 *  from exactly what the test checks. */
export function fixedCopyClaims() {
  const out = [];
  for (const file of walk(CATALOG)) {
    const src = stripComments(readFileSync(file, 'utf8'));
    const runs = [
      ...[...src.matchAll(/>([^<>{}]+)</g)].map((m) => m[1]),
      ...[...src.matchAll(/'([^'\n]{10,})'|"([^"\n]{10,})"/g)].map((m) => m[1] ?? m[2]),
    ];
    for (const raw of runs) {
      const text = decode(raw.replace(/\s+/g, ' ').trim());
      if (text.length < 8 || !/[a-z] [a-z]/i.test(text)) continue;
      const claims = claimsIn(text);
      if (claims.length) out.push({ file: relative(CATALOG, file).replace(/\\/g, '/'), claims, text });
    }
  }
  const seen = new Set();
  return out.filter((c) => (seen.has(`${c.file}|${c.text}`) ? false : seen.add(`${c.file}|${c.text}`)));
}

/** Claims awaiting Xander's approval of a rewording. Key: "file|text". Never add one without his
 *  approval; remove it when its fix lands. */
export const PENDING = new Set([
  // Empty since Xander approved all 15 rewrites (2026-11-10, section D). Keep it empty: a new
  // hard-coded claim is reworded to promise nothing, or wired to the client's fact.
]);

/** Claims that render ONLY when the client's own fact supports them. Each entry names the fact. */
export const WIRED_TO_FACT = new Map([
  // Rendered only inside `radius ?`, i.e. when the client gave extensions.serviceRadiusMiles: a
  // mobile-service radius is the fact that "we come to you" states.
  ['trust/DetailTrust.tsx|We come to you,', 'extensions.serviceRadiusMiles'],
]);

test('no catalog component makes a hard-coded claim beyond the pending list', () => {
  const found = fixedCopyClaims().map((c) => `${c.file}|${c.text}`);
  const unexpected = found.filter((k) => !PENDING.has(k) && !WIRED_TO_FACT.has(k));
  assert.deepEqual(unexpected, [], `new hard-coded claims (reword to promise nothing, or wire to a fact):\n${unexpected.join('\n')}`);
});

test('every pending claim still exists (a fixed one must leave the list)', () => {
  const found = new Set(fixedCopyClaims().map((c) => `${c.file}|${c.text}`));
  const stale = [...PENDING].filter((k) => !found.has(k));
  assert.deepEqual(stale, [], `fixed or moved, remove from PENDING:\n${stale.join('\n')}`);
});

test('the scanner sees claims across multi-line JSX text and HTML entities', () => {
  // The two shapes the first scan missed: "already nearby" broken over two lines, and &mdash;.
  assert.deepEqual(claimsIn(decode('so your crew is already nearby. That&rsquo;s how the same day'.replace(/\s+/g, ' '))).sort(), ['response time', 'same day']);
  assert.deepEqual(claimsIn('We travel for bigger jobs across the region.'), ['travel']);
  assert.deepEqual(claimsIn('No mobile fee inside the ring.'), ['no fee']);
});

// Rows 1 and 3 are wired to the client's facts. Checked as source: both components import
// @/data/site, whose @jdd/schema values the tsx test loader can't resolve yet.
test("row 1: the Roofing hero kicker states only the client's own license and badges", () => {
  const s = readFileSync(join(CATALOG, 'hero/RoofingHero.tsx'), 'utf8');
  assert.ok(!stripComments(s).includes('Licensed · Bonded · GAF Certified'), 'the fixed kicker is back');
  assert.ok(s.includes("[brand.license?.trim() ? 'Licensed' : '', ...(extensions?.trustBadges ?? [])]"), 'the kicker is not built from the facts');
  assert.ok(s.includes('{kicker.length > 0 && ('), 'the kicker must hide without facts');
});

test("row 3: the emergency bar shows only the client's announcement, hidden without one", () => {
  const s = readFileSync(join(CATALOG, 'nav/NavEmergencyBar.tsx'), 'utf8');
  assert.ok(!stripComments(s).includes('24/7 emergency service'), 'the 24/7 fallback is back');
  assert.ok(s.includes('{msg && ('), 'the bar must hide without an announcement');
});
