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

/** Found 2026-11-10, awaiting Xander's approval of their rewording (wording file section D).
 *  Key: "file|text". Remove an entry when its fix lands; never add one without his approval. */
export const PENDING = new Set([
  'contact/ContactCardOverlap.tsx|Get a free estimate',
  "finalCta/LawnFinalCta.tsx|We'll call with a flat quote. Usually same day.",
  'finalCta/RoofingFinalCta.tsx|Book my free inspection',
  "hero/LawnHero.tsx|We'll call with a flat quote. Usually same day.",
  'hero/PlumbingHero.tsx|Taking calls now · same-day slots available',
  'hero/RoofingHero.tsx|Licensed · Bonded · GAF Certified',
  'hero/RoofingHero.tsx|Get a free inspection',
  'nav/NavEmergencyBar.tsx|24/7 emergency service. We answer day or night.',
  'nav/RoofingNav.tsx|Free inspection',
  'services/ServicesAccordion.tsx|Get a free quote',
  'trust/DetailTrust.tsx|No mobile fee inside the ring. Beyond it, call. For coating and correction work we travel further.',
  'trust/HvacServiceArea.tsx|Not on the list? Call and ask. We travel for bigger jobs across the region.',
  "trust/LawnTrust.tsx|We route by neighbourhood, so your crew is already nearby. That's how the same day every week actually holds.",
  'trust/RoofingTrust.tsx|Outside the list? Call anyway. We travel for full replacements and commercial work.',
  'trust/ServiceArea.tsx|Not on the list? Call and ask, we travel for bigger jobs.',
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
