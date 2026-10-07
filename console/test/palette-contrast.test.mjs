// The derived palette tokens must clear WCAG AA for ANY accent a client picks.
//
// This is the check that would have caught two separate shipped defects:
//   · `accentFg` was trusted verbatim from the schema, so a client could set #FFFFFF over
//     #e08b29 (2.66:1) and the primary CTA failed contrast.
//   · `--accent-text` was derived against --bg only, so on --bg-soft it cleared AA by 0.03
//     on one palette and 0.08 on another — luck, not a guarantee.
//
// It runs the REAL implementation from @jdd/ui rather than restating the maths, because a
// test that reimplements the thing it is testing proves nothing.
//
// The reusable machinery lives in ./helpers/contrast.mjs so Phase 12's
// vertical-language.test.mjs can import it without re-running these tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { paletteVars, contrast } from '@jdd/ui/palette';
import { AA, TYPO, assertPaletteAA, assertWarm } from './helpers/contrast.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Accents chosen to be awkward on purpose, plus every accent that actually ships. */
const ACCENTS = [
  ['#e08b29', 'e2e orange — the original failing case'],
  ['#E05C2A', 'hvac preset — where opacity-80 broke'],
  ['#ffe600', 'bright yellow — worst case on white'],
  ['#1f6f78', 'deep teal — already passes, must not be altered needlessly'],
  ['#B3251A', 'red — collides with the urgency tone'],
  ['#7c3aed', 'violet'],
  ['#111111', 'near-black'],
  // The six shipped vertical accents, so the suite tests the colours that actually go out
  // rather than only adversarial ones. hvac's #E05C2A is already above.
  ['#475569', 'roofing preset'],
  ['#1E6FA8', 'plumbing preset'],
  ['#2F7A33', 'lawn-care preset'],
  ['#1A1A2E', 'car-detailing preset'],
  ['#0E9C8A', 'health preset'],
  ['#1F5C7A', 'the new globals.css default'],
];

// Decision 9's warm set, as authored in all seven palettes. Measured 2026-10-06:
// inkSoft on bg 7.59:1, on bgSoft 6.84:1, ink on bg 16.94:1.
const WARM = { bg: '#FAF7F2', bgSoft: '#F1EBE2', ink: '#1A1512', inkSoft: '#584E45', rule: '#DFD6C9' };
const WARM_DEEP = { ...WARM, bgSoft: '#E8DFD2' };   // a deeper soft band, the case that nearly failed before
const DARK = { bg: '#0e1116', bgSoft: '#161b22', ink: '#f5f5f5', inkSoft: '#b9b9b9', rule: '#2a2f36' };

function varsFor(accent, base, accentFg) {
  return paletteVars({ palette: { ...base, accent, ...(accentFg ? { accentFg } : {}) }, typography: TYPO });
}

// Every shipped accent now clears AA as a solid fill. lawn-care's #3D8E40 was the one that
// could not (best 4.43 against warm ink, measured 2026-10-06); it was darkened to #2F7A33
// (white label = 5.31) so there is no longer any unreachable-foreground exception to carry.
// See console/design/foundation-v2/NOTES.md for the resolution.

for (const [surfaceName, base] of [['warm', WARM], ['warm-deep', WARM_DEEP], ['dark', DARK]]) {
  for (const [accent, why] of ACCENTS) {
    test(`${surfaceName} / ${accent} (${why}): accent text clears AA on BOTH surfaces`, () => {
      const v = varsFor(accent, base);
      const text = v['--accent-text'];
      assert.ok(contrast(text, base.bg) >= AA, `--accent-text ${text} on bg ${base.bg} = ${contrast(text, base.bg).toFixed(2)}`);
      assert.ok(contrast(text, base.bgSoft) >= AA, `--accent-text ${text} on bgSoft ${base.bgSoft} = ${contrast(text, base.bgSoft).toFixed(2)}`);
    });

    test(`${surfaceName} / ${accent}: button label clears AA on the accent fill`, () => {
      const v = varsFor(accent, base);
      const ratio = contrast(v['--accent-fg'], accent);
      assert.ok(ratio >= AA, `--accent-fg ${v['--accent-fg']} on ${accent} = ${ratio.toFixed(2)}`);
    });

    test(`${surfaceName} / ${accent}: urgency tone clears AA`, () => {
      const v = varsFor(accent, base);
      assert.ok(contrast(v['--urgent'], base.bg) >= AA);
      assert.ok(contrast(v['--urgent'], base.bgSoft) >= AA);
    });
  }
}

test('an illegible accentFg from the schema is REJECTED, not honoured', () => {
  // The exact shipped case: a client set white on their orange and the CTA failed.
  const v = varsFor('#e08b29', WARM, '#FFFFFF');
  assert.notEqual(v['--accent-fg'].toLowerCase(), '#ffffff', 'a failing accentFg must not be used');
  assert.ok(contrast(v['--accent-fg'], '#e08b29') >= AA);
});

test('a legible accentFg from the schema IS honoured', () => {
  // The guard must not override a client who chose correctly, INCLUDING a client who chose
  // pure white. Decision 9 changed what we DERIVE, not what we accept from a client.
  const v = varsFor('#1C1009', WARM, '#FFFFFF');
  assert.equal(v['--accent-fg'].toLowerCase(), '#ffffff');
});

test('an already-legible accent is passed through unchanged', () => {
  // Darkening a colour that already passes would needlessly move the brand.
  // Re-measured on the warm base 2026-10-06: #1f6f78 is 5.45:1 on bg and 4.92:1 on bgSoft,
  // so it still clears AA on both and must come back untouched.
  const v = varsFor('#1f6f78', WARM);
  assert.equal(v['--accent-text'].toLowerCase(), '#1f6f78');
});

test('text on the inverted surface clears AA', () => {
  for (const [accent] of ACCENTS) {
    const v = varsFor(accent, WARM);
    assert.ok(contrast(v['--on-ink'], v['--ink-panel']) >= AA, `on-ink vs ink-panel for ${accent}`);
  }
});

/**
 * The `brand.palette` block of one preset, PARSED FROM DISK rather than imported.
 *
 * Importing these .ts modules does not work here even with tsx in the test command: they carry
 * `import type { SiteContent } from "@jdd/schema"`, and @jdd/schema's exports map declares only
 * `types` and `import` conditions, so tsx's CJS-side resolution finds no match and throws
 * ERR_PACKAGE_PATH_NOT_EXPORTED. Parsing the file is also closer to this test's actual intent:
 * it asserts on what is literally written on disk, which is what a future careless edit changes.
 */
function paletteFromDisk(relPath) {
  const src = readFileSync(path.join(ROOT, relPath), 'utf8');
  const block = src.match(/palette:\s*\{([\s\S]*?)\}/);
  assert.ok(block, `${relPath}: no palette block found`);
  const slot = (name) => {
    const m = block[1].match(new RegExp(`\\b${name}:\\s*"(#[0-9A-Fa-f]{3,8})"`));
    return m ? m[1] : null;
  };
  const out = {
    accent: slot('accent'),
    bg: slot('bg'),
    bgSoft: slot('bgSoft'),
    ink: slot('ink'),
    inkSoft: slot('inkSoft'),
    rule: slot('rule'),
  };
  const accentFg = slot('accentFg');
  if (accentFg) out.accentFg = accentFg;
  for (const [k, v] of Object.entries(out)) {
    assert.ok(v, `${relPath}: palette.${k} did not parse`);
  }
  return out;
}

const SHIPPED_PALETTES = [
  'src/data/site.ts',
  'src/data/verticals/hvac.ts',
  'src/data/verticals/roofing.ts',
  'src/data/verticals/plumbing.ts',
  'src/data/verticals/lawn-care.ts',
  'src/data/verticals/car-detailing.ts',
  'src/data/verticals/health.ts',
];

test('every shipped palette is warm', () => {
  // The seven authored palettes as they exist on disk, so a future edit to a preset is caught
  // here instead of in a browser.
  assert.equal(SHIPPED_PALETTES.length, 7, 'expected the default palette plus six verticals');
  for (const rel of SHIPPED_PALETTES) {
    assertWarm(paletteFromDisk(rel), rel);
  }
});

test('every shipped palette clears AA', () => {
  for (const rel of SHIPPED_PALETTES) {
    assertPaletteAA(paletteFromDisk(rel), rel);
  }
});

test('no shipped palette has an unreachable accent foreground', () => {
  // lawn-care (#3D8E40, best 4.43) was the one exception; darkened to #2F7A33 (fill 5.31) so
  // every shipped accent now clears AA as a button fill. If this fails, a preset's accent
  // regressed below 4.5 — fix that accent, do not reintroduce a skip.
  const failing = SHIPPED_PALETTES.filter((rel) => {
    try { assertPaletteAA(paletteFromDisk(rel), rel); return false; } catch { return true; }
  });
  assert.deepEqual(failing, []);
});

test('the pre-hydration :root defaults in globals.css are warm', () => {
  // This is the one palette no TypeScript import can reach, and it is what a visitor sees for
  // the first paint of every client site.
  const css = readFileSync(path.join(ROOT, '../template/src/styles/globals.css'), 'utf8');
  const block = css.match(/:root\s*\{([^}]*)\}/);
  assert.ok(block, ':root block not found in globals.css');

  const grab = (name) => {
    const m = block[1].match(new RegExp(`--${name}:\\s*([^;]+);`));
    assert.ok(m, `--${name} not found in :root`);
    return m[1].trim();
  };

  const palette = {
    accent: grab('accent'),
    accentFg: grab('accent-fg'),
    bg: grab('bg'),
    bgSoft: grab('bg-soft'),
    ink: grab('ink'),
    inkSoft: grab('ink-soft'),
    rule: grab('rule'),
  };

  assertWarm(palette, 'globals.css :root');
  assertPaletteAA(palette, 'globals.css :root');
});

test('a warm ground never resolves a pure-white foreground', () => {
  // readableOn's light candidate is WARM_PAPER, not #ffffff (decision 9). The dark base is the
  // case that exercises it: there, --on-ink takes the light branch.
  const v = varsFor('#E05C2A', DARK);
  assert.notEqual(
    String(v['--on-ink']).toLowerCase(),
    '#ffffff',
    'decision 9: the light foreground candidate is the warm off-white, not pure white',
  );
});
