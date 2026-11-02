// The D5 degradation map (PLAN §6, EXEC "Degradation map (D5)"), enforced.
//
// Seven documented behaviours, one per content slot a bespoke vertical template can be handed
// nothing for. Every one of them is a SILENT path: when a guard is deleted the component does
// not throw, it renders a headed band with no numbers, a star rating of `undefined`, a "starting
// at" with no price, or a promotional ribbon promising nothing. Those reach a deployed client
// site looking like a content problem rather than a code one — the exact failure class the root
// suite's header describes (seven bugs shipped, not one produced an error).
//
// EXEC T6.4 asked for lawn's three (offerBadge/seasons/stats) inside catalog-invariants. This
// covers all seven instead, in its own file: catalog-invariants holds generic anti-slop
// heuristics that apply to every component, while these are a specific per-slot contract naming
// specific files. Mixing them would bury the contract in a 380-line heuristics file.
//
// ── Why source assertions rather than rendering ─────────────────────────────
//
// These components `import { CONTENT } from '@/data/site'`, whose runtime `export * from
// '@jdd/schema'` resolves through a CJS codepath that fails under the plain node runner
// (ERR_PACKAGE_PATH_NOT_EXPORTED). Same constraint catalog-invariants, cta-routing and
// vertical-templates already work around by reading source as text. A rendering test would be
// stronger; it is not available until that import is untangled, and an enforced source contract
// beats an unenforced one. Each assertion targets the specific guard line, so deleting the guard
// fails the test — verified by reverting each one and watching it go red.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG = path.join(ROOT, 'src/components/catalog');

const src = (rel) => readFileSync(path.join(CATALOG, rel), 'utf8');

/**
 * Source with comments removed, for the "must not contain this fallback" checks below.
 *
 * Those components document the forbidden fallback by NAME in their header ("never `$0` or
 * `Call`", "e.g. First mow free") — which is exactly what makes the rule legible, and exactly
 * what makes a naive substring search match the prose explaining the rule instead of a real
 * violation. Both of those fired on the first run of this file.
 */
const codeOnly = (text) =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
/** Whitespace-tolerant literal match — guards are one-liners, but formatting shouldn't matter. */
const has = (text, literal) =>
  new RegExp(literal.split(/\s+/).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*')).test(text);

// ── 1. about.stats empty → the stat band is not rendered ────────────────────
// Never a band of empty tiles, and never a generated number (D4 forbids inventing one, so an
// absent stat has no fallback available to it by design).
const STAT_BANDS = [
  ['stats/HvacStatBand.tsx', 'if (!stats.length) return null;'],
  ['stats/RoofingStats.tsx', 'if (!stats.length) return null;'],
  ['stats/PlumbingStats.tsx', 'if (!stats.length) return null;'],
  ['stats/DetailStats.tsx', 'if (!stats.length) return null;'],
  // Lawn's is the dual slot (D14) — it survives on EITHER half, so its guard is the conjunction.
  ['stats/LawnStats.tsx', 'if (!stats.length && !seasons.length) return null;'],
];

test('every vertical stat band omits itself when about.stats is empty', () => {
  for (const [file, guard] of STAT_BANDS) {
    assert.ok(has(src(file), guard), `${file}: missing the empty-stats guard \`${guard}\``);
  }
});

test('every vertical stat band reads about.stats defensively (absent, not just empty)', () => {
  // `content.about.stats ?? []` — a client whose schema predates the field has it undefined,
  // which would throw on .filter and take the whole page down rather than omitting one band.
  for (const [file] of STAT_BANDS) {
    assert.ok(
      has(src(file), 'content.about.stats ?? []'),
      `${file}: reads about.stats without a ?? [] fallback`,
    );
  }
});

// ── 2. about.seasons empty → the season rail is not rendered (D14) ──────────
test('LawnStats renders the season rail only when seasons have a body, independently of stats', () => {
  const s = src('stats/LawnStats.tsx');
  assert.ok(has(s, 'const seasons = (content.about.seasons ?? []).filter'), 'seasons not read defensively');
  assert.ok(has(s, '.filter((s) => s.body?.trim())'), 'a season with no body must be dropped, not rendered empty');
  assert.ok(has(s, '{seasons.length > 0 && ('), 'the rail is not behind a seasons guard');
  // The two halves must degrade INDEPENDENTLY: a client with stats but no seasonal programme
  // still gets the band. An `||` here (or a shared guard) would take both down together.
  assert.ok(
    !has(s, 'if (!seasons.length) return null;'),
    'LawnStats must not return null for missing seasons alone — the stat band still renders',
  );
});

// ── 3. extensions.reviewBadge null → aggregate omitted, QUOTE CARDS STAY ────
const REVIEWS = [
  'testimonials/HvacReviews.tsx',
  'testimonials/RoofingReviews.tsx',
  'testimonials/LawnReviews.tsx',
  'testimonials/PlumbingReviews.tsx',
  'testimonials/DetailReviews.tsx',
];

test('every vertical reviews section drops only the aggregate when reviewBadge is null', () => {
  for (const file of REVIEWS) {
    const s = src(file);
    assert.ok(has(s, 'const review = extensions.reviewBadge;'), `${file}: reviewBadge not read into a guard`);
    assert.ok(/\{review\s*&&\s*\(|\{review\s*\?/.test(s), `${file}: the aggregate is not behind a review guard`);
  }
});

test('a null reviewBadge never takes the whole reviews section down with it', () => {
  // The documented behaviour is "aggregate omitted; quote cards still render". The way that
  // breaks is someone folding review into the early return — which reads as a tidy-up and
  // silently deletes the testimonials from every client without an aggregate on file.
  for (const file of REVIEWS) {
    const s = src(file);
    assert.ok(has(s, 'if (!items.length) return null;'), `${file}: missing the items-level guard`);
    const earlyReturns = s.match(/if \([^)]*\) return null;/g) ?? [];
    for (const r of earlyReturns) {
      assert.ok(!/review/.test(r), `${file}: reviewBadge is gating an early return (\`${r}\`) — quotes must survive it`);
    }
  }
});

// ── 4. extensions.serviceArea empty → the trust/area section is not rendered ─
const TRUST = [
  'trust/HvacServiceArea.tsx',
  'trust/RoofingTrust.tsx',
  'trust/LawnTrust.tsx',
  'trust/PlumbingTrust.tsx',
  'trust/DetailTrust.tsx',
];

test('every vertical trust section omits itself when serviceArea is empty', () => {
  for (const file of TRUST) {
    const s = src(file);
    assert.ok(has(s, 'extensions.serviceArea ?? []'), `${file}: serviceArea not read defensively`);
    assert.ok(has(s, 'if (!towns.length) return null;'), `${file}: missing the empty-serviceArea guard`);
  }
});

// ── 5. items[].priceFrom absent → the card footer shows its tag only (D15) ──
test('DetailServices shows a price only when the item carries one, never a placeholder', () => {
  const s = src('services/DetailServices.tsx');
  assert.ok(has(s, '{item.priceFrom?.trim() ? ('), 'the price line is not behind a per-item guard');
  // D15 names the two tempting fallbacks explicitly. Neither is acceptable: "$0" is a lie about
  // the business, and "Call" is a placeholder escaping to a deployed site.
  const code = codeOnly(s);
  for (const bad of ['$0', 'Call for pricing', 'Contact for pricing']) {
    assert.ok(!code.includes(bad), `DetailServices must not fall back to "${bad}" for a missing price`);
  }
  assert.ok(
    !/priceFrom\s*(\?\?|\|\|)/.test(code),
    'DetailServices must not default a missing priceFrom — the footer shows the tag alone',
  );
});

test('LawnHero shows its price anchor only when the primary service carries one', () => {
  const s = src('hero/LawnHero.tsx');
  // items[0], not a find(): the <E> edit path has to name a fixed index, and a find() landing on
  // a different item would write the operator's edit to the wrong service (silently).
  assert.ok(has(s, 'const priceFrom = services.items[0]?.priceFrom;'), 'LawnHero price anchor is not items[0]');
  assert.ok(has(s, '{priceFrom ? ('), 'the price line is not behind a priceFrom guard');
  const editPath = /<E p="services\.items\.(\d+)\.priceFrom">/.exec(s);
  assert.ok(editPath, 'LawnHero price anchor has no editable path');
  assert.equal(editPath[1], '0', 'the edit path must name the same index the value was read from');
});

// ── 6. extensions.serviceRadiusMiles absent → town run only (D15) ───────────
test('DetailTrust drops its radius claim when no mileage was supplied, keeping the town run', () => {
  const s = src('trust/DetailTrust.tsx');
  assert.ok(has(s, 'const radius = content.extensions.serviceRadiusMiles?.trim();'), 'radius not read defensively');
  assert.ok(/\{radius\s*\?/.test(s), 'the radius statement is not behind a radius guard');
  // The towns must not be gated on the radius — a detailer with no mobile service still has a
  // service area, and "We come to you, undefined miles out" is the failure this prevents.
  const earlyReturns = s.match(/if \([^)]*\) return null;/g) ?? [];
  for (const r of earlyReturns) {
    assert.ok(!/radius/.test(r), `DetailTrust: radius is gating an early return (\`${r}\`) — towns must survive it`);
  }
});

// ── 7. extensions.offerBadge null → no offer ribbon (D10) ───────────────────
test('LawnFinalCta renders the offer ribbon only from a client-supplied offerBadge', () => {
  const s = src('finalCta/LawnFinalCta.tsx');
  assert.ok(has(s, 'const offerBadge = extensions.offerBadge?.trim();'), 'offerBadge not read defensively');
  assert.ok(has(s, '{offerBadge && ('), 'the ribbon is not behind an offerBadge guard');
  // D10: a promotional promise is made to the client's own customers, so it is never ours to
  // write. A default here would have every lawn site offering something nobody agreed to.
  const code = codeOnly(s);
  assert.ok(
    !/offerBadge\s*(\?\?|\|\|)/.test(code),
    'LawnFinalCta must not default the offer ribbon — absent means no ribbon (D10)',
  );
  assert.ok(
    !/(First mow free|Free estimate|Save \d)/i.test(code),
    'LawnFinalCta must not carry a hardcoded promotional offer',
  );
});
