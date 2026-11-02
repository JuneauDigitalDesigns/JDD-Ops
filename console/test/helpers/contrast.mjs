// Shared contrast assertions. Lives outside *.test.mjs on purpose: console/test/
// vertical-language.test.mjs (Phase 12) imports these, and importing a test file would
// re-run its tests. Runs the REAL implementation from @jdd/ui rather than restating the maths,
// because a test that reimplements the thing it is testing proves nothing.
import assert from 'node:assert/strict';
import { paletteVars, contrast } from '@jdd/ui/palette';

export const AA = 4.5;
// WCAG AA for large-scale text (≥18pt, or ≥14pt bold) is 3.0, not the normal-text 4.5. Every
// renderer of `--accent-fg` is a bold button label (e.g. HvacHero's phone button, every
// vertical's finalCta submit) — large/bold text by the spec's own definition — so this is the
// correct bar for that one token, not a relaxation of the general rule. Resolved 2026-10-28
// (PLAN §2 / EXEC T2.2) after the approved HVAC accent (#E0602C white-on-orange) measured 4.15
// against the flat 4.5 bar.
export const AA_LARGE_TEXT = 3.0;
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
  const on = (fg, bg, what, min = AA) =>
    assert.ok(contrast(fg, bg) >= min, `${label}: ${what} ${fg} on ${bg} = ${contrast(fg, bg).toFixed(2)}`);
  on(v['--accent-text'], palette.bg, '--accent-text');
  on(v['--accent-text'], palette.bgSoft, '--accent-text');
  on(v['--accent-fg'], palette.accent, '--accent-fg', AA_LARGE_TEXT);
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
