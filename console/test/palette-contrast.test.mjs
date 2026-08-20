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
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paletteVars, contrast } from '@jdd/ui/palette';

const AA = 4.5;

/** Accents chosen to be awkward on purpose, not to be representative. */
const ACCENTS = [
  ['#e08b29', 'e2e orange — the original failing case'],
  ['#E05C2A', 'hvac preset — where opacity-80 broke'],
  ['#ffe600', 'bright yellow — worst case on white'],
  ['#1f6f78', 'deep teal — already passes, must not be altered needlessly'],
  ['#B3251A', 'red — collides with the urgency tone'],
  ['#7c3aed', 'violet'],
  ['#111111', 'near-black'],
];

const LIGHT = { bg: '#ffffff', bgSoft: '#FFF6F2', ink: '#1C1009', inkSoft: '#6B5344', rule: '#E8D5C8' };
const DEEP_SOFT = { ...LIGHT, bgSoft: '#F2E4D8' };   // the case that nearly failed
const DARK = { bg: '#0e1116', bgSoft: '#161b22', ink: '#f5f5f5', inkSoft: '#b9b9b9', rule: '#2a2f36' };

const TYPO = { fontSans: 'x', fontHeading: 'x', headingWeight: 700, bodyWeight: 400 };

function varsFor(accent, base, accentFg) {
  return paletteVars({ palette: { ...base, accent, ...(accentFg ? { accentFg } : {}) }, typography: TYPO });
}

for (const [surfaceName, base] of [['light', LIGHT], ['deep-soft', DEEP_SOFT], ['dark', DARK]]) {
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
  const v = varsFor('#e08b29', LIGHT, '#FFFFFF');
  assert.notEqual(v['--accent-fg'].toLowerCase(), '#ffffff', 'a failing accentFg must not be used');
  assert.ok(contrast(v['--accent-fg'], '#e08b29') >= AA);
});

test('a legible accentFg from the schema IS honoured', () => {
  // The guard must not override a client who chose correctly.
  const v = varsFor('#1C1009', LIGHT, '#FFFFFF');
  assert.equal(v['--accent-fg'].toLowerCase(), '#ffffff');
});

test('an already-legible accent is passed through unchanged', () => {
  // Darkening a colour that already passes would needlessly move the brand.
  const v = varsFor('#1f6f78', LIGHT);
  assert.equal(v['--accent-text'].toLowerCase(), '#1f6f78');
});

test('text on the inverted surface clears AA', () => {
  for (const [accent] of ACCENTS) {
    const v = varsFor(accent, LIGHT);
    assert.ok(contrast(v['--on-ink'], v['--ink-panel']) >= AA, `on-ink vs ink-panel for ${accent}`);
  }
});
