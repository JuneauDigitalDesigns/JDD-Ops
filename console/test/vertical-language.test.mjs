// Phase 12a / §0.6: the typed vertical language is thin and enforced. Each assertion fails the
// moment a vertical tries to name a font that doesn't exist, a template that isn't shared, a
// palette that can't clear AA, or - the structural one - a fifth axis.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VERTICAL_LANGUAGES } from '../src/data/vertical-language.ts';
import { FONT_PAIRINGS } from '../src/lib/fonts.ts';
import { PAGE_TEMPLATES } from '../src/app/c/[slug]/build/page-templates.tsx';
import { assertPaletteAA, assertWarm } from './helpers/contrast.mjs';

const pairingIds = new Set(FONT_PAIRINGS.map((p) => p.id));
const templateIds = new Set(PAGE_TEMPLATES.map((t) => t.id));
const homeTemplateIds = new Set(PAGE_TEMPLATES.filter((t) => t.pageType === 'home').map((t) => t.id));
const langs = Object.entries(VERTICAL_LANGUAGES);

test('every pairingId exists in FONT_PAIRINGS', () => {
  for (const [v, lang] of langs) {
    assert.ok(pairingIds.has(lang.pairingId), `${v}: pairingId '${lang.pairingId}' is not a FONT_PAIRINGS id`);
  }
});

test('every rhythm.homeTemplateId is a real template with pageType home', () => {
  for (const [v, lang] of langs) {
    assert.ok(
      homeTemplateIds.has(lang.rhythm.homeTemplateId),
      `${v}: homeTemplateId '${lang.rhythm.homeTemplateId}' is not a PAGE_TEMPLATES entry with pageType 'home'`,
    );
  }
});

test('no vertical references a template outside PAGE_TEMPLATES (no private templates)', () => {
  // homeTemplateId is the only template id a VerticalLanguage can name - there is deliberately no
  // field for a vertical-private template - so this subset check is the whole guard.
  for (const [v, lang] of langs) {
    assert.ok(templateIds.has(lang.rhythm.homeTemplateId), `${v}: template '${lang.rhythm.homeTemplateId}' is not shared`);
  }
});

test('every palette clears the Phase 2 warmth + contrast assertions', () => {
  // Reuses the real @jdd/ui derivation via contrast.mjs rather than restating the maths.
  for (const [v, lang] of langs) {
    assertWarm(lang.palette, v);
    assertPaletteAA(lang.palette, v);
  }
});

test('VerticalLanguage has exactly four axes (a fifth field fails here)', () => {
  assert.deepEqual(Object.keys(VERTICAL_LANGUAGES.hvac), ['pairingId', 'palette', 'photography', 'rhythm']);
});
