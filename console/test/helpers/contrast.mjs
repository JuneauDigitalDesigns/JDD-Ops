// Shared contrast assertions. Lives outside *.test.mjs on purpose: console/test/
// vertical-language.test.mjs (Phase 12) imports these, and importing a test file would
// re-run its tests. Runs the REAL implementation from @jdd/ui rather than restating the maths,
// because a test that reimplements the thing it is testing proves nothing.
import assert from 'node:assert/strict';
import { paletteVars, contrast } from '@jdd/ui/palette';

export const AA = 4.5;
export const TYPO = { fontSans: 'x', fontHeading: 'x', headingWeight: 700, bodyWeight: 400 };

/** paletteVars() for one palette object (the 7 authored slots). */
export function varsFor(palette) {
  return paletteVars({ palette, typography: TYPO });
}

/**
 * Every derived token that renders as TEXT clears AA on every surface it can land on.
 * `label` is prefixed to each failure so a caller with many palettes can tell them apart.
 */
export function assertPaletteAA(palette, label) {
  const v = varsFor(palette);
  const on = (fg, bg, what) =>
    assert.ok(contrast(fg, bg) >= AA, `${label}: ${what} ${fg} on ${bg} = ${contrast(fg, bg).toFixed(2)}`);
  on(v['--accent-text'], palette.bg, '--accent-text');
  on(v['--accent-text'], palette.bgSoft, '--accent-text');
  on(v['--accent-fg'], palette.accent, '--accent-fg');
  on(v['--urgent'], palette.bg, '--urgent');
  on(v['--urgent'], palette.bgSoft, '--urgent');
  on(v['--on-ink'], v['--ink-panel'], '--on-ink');
  on(palette.inkSoft, palette.bg, 'inkSoft');
  on(palette.inkSoft, palette.bgSoft, 'inkSoft');
}

/** Decision 9: no authored surface or ink may be a pure value. */
export function assertWarm(palette, label) {
  const pure = new Set(['#ffffff', '#fff', '#000000', '#000']);
  for (const slot of ['bg', 'bgSoft', 'ink', 'inkSoft', 'rule']) {
    assert.ok(
      !pure.has(String(palette[slot]).toLowerCase()),
      `${label}: ${slot} is ${palette[slot]}; decision 9 moves grounds off pure white and inks off pure black`,
    );
  }
}
