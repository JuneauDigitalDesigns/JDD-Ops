// Regression test for the HVAC palette/typography override bug (PLAN §2 / EXEC T2.4).
//
// VERTICAL_LANGUAGES and verticals/<id>.ts both used to claim the same seven palette slots, and
// the language silently won via presetFor()'s compose step — VERTICAL_LANGUAGES.hvac carried a
// petrol-teal palette and Instrument Sans while the preset and the approved Northstar mockup both
// said orange/navy/Oswald. Each half looked correct read on its own; only the COMPOSED result
// (what presetFor actually returns, i.e. what ships) disagreed with the approved design. This
// test asserts the composed result, not either half in isolation, because that is the only way
// the original bug could have been caught.
//
// Unlike the other vertical-* tests, this one imports verticals.ts directly rather than going
// through a regex-source-read workaround: @jdd/schema now publishes a proper "." export (see
// package.json), so presetFor() loads fine under `node --import tsx --test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { presetFor } from '../src/lib/verticals.ts';
import { VERTICAL_LANGUAGES } from '../src/data/vertical-language.ts';

test('presetFor resolves every known VERTICAL_LANGUAGES entry to its own accent + heading font', () => {
  for (const [id, lang] of Object.entries(VERTICAL_LANGUAGES)) {
    const content = presetFor(id);
    assert.equal(
      content.brand.palette.accent,
      lang.palette.accent,
      `${id}: presetFor accent ${content.brand.palette.accent} does not match VERTICAL_LANGUAGES.${id}.palette.accent ${lang.palette.accent}`,
    );
    assert.ok(
      content.brand.typography.fontHeading.toLowerCase().includes(lang.pairingId),
      `${id}: presetFor fontHeading "${content.brand.typography.fontHeading}" does not resolve pairingId "${lang.pairingId}"`,
    );
  }
});

test('HVAC specifically: the approved Northstar orange/navy/Oswald, not the teal/cream/Instrument override', () => {
  const content = presetFor('hvac');
  assert.equal(content.brand.palette.accent, '#E0602C');
  assert.equal(content.brand.palette.bg, '#FFFFFF');
  assert.equal(content.brand.palette.ink, '#13293F');
  assert.ok(content.brand.typography.fontHeading.toLowerCase().includes('oswald'));
});
