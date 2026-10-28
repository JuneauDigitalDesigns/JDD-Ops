// Vertical whole-site templates — the Studio's new unit of choice (see vertical-templates.tsx
// and src/components/CATALOG-LEGACY.md). These lock in the contract the export path depends on:
// a template must build a structurally valid composition, and every component it names must be in
// the CATALOG allowlist, or `/api/build/export`'s validateEntries would refuse it.
//
// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  VERTICAL_TEMPLATES, applyVerticalTemplate, verticalTemplateFor,
} from '../src/app/c/[slug]/build/vertical-templates.tsx';
import { validateComposition } from '../src/lib/pages.ts';

// The built-in verticals. Hardcoded rather than imported from src/lib/verticals.ts, which
// runtime-imports '@jdd/schema' (bare specifier, no "." export) and so cannot load under the
// node test runner. Kept in step with src/data/verticals/*.ts by vertical-language.test.mjs.
const KNOWN_VERTICALS = new Set(['hvac', 'roofing', 'plumbing', 'lawn-care', 'car-detailing', 'health']);

// CATALOG read by regex from export.ts source — importing the module would pull its
// `@jdd/schema` runtime import (no "." export under node). Same technique as catalog-invariants.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function catalog() {
  const src = readFileSync(path.join(ROOT, 'src/lib/export.ts'), 'utf8');
  const block = /export const CATALOG[^{]*\{([\s\S]*?)\n\};/.exec(src)[1];
  const out = {};
  for (const m of block.matchAll(/^\s*(\w+):\s*\[([^\]]*)\]/gm)) {
    out[m[1]] = [...m[2].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  }
  return out;
}
/** Flatten a composition to its section refs (chrome + every page's sections). */
function refsOf(comp) {
  return [comp.chrome.nav, comp.chrome.footer, comp.chrome.seo, ...comp.pages.flatMap((p) => p.sections)];
}

test('at least one vertical template is defined (guards a broken import passing everything)', () => {
  assert.ok(Object.keys(VERTICAL_TEMPLATES).length >= 1);
});

test('every vertical template builds a composition that passes validateComposition', () => {
  for (const [vertical, tmpl] of Object.entries(VERTICAL_TEMPLATES)) {
    assert.doesNotThrow(() => validateComposition(tmpl.build()), `${vertical}: invalid composition`);
  }
});

test('every component a vertical template references is in CATALOG (export would accept it)', () => {
  const CATALOG = catalog();
  const bad = [];
  for (const [vertical, tmpl] of Object.entries(VERTICAL_TEMPLATES)) {
    for (const ref of refsOf(tmpl.build())) {
      const allowed = CATALOG[ref.categoryId];
      if (!allowed || !allowed.includes(ref.name)) bad.push(`${vertical}: ${ref.categoryId}/${ref.name}`);
    }
  }
  assert.deepEqual(bad, [], `these would be rejected by the export route:\n${bad.join('\n')}`);
});

test('every vertical-template key is a real VerticalId and verticalTemplateFor resolves it', () => {
  for (const vertical of Object.keys(VERTICAL_TEMPLATES)) {
    assert.ok(KNOWN_VERTICALS.has(vertical), `${vertical} is not a known VerticalId`);
    assert.ok(verticalTemplateFor(vertical), `verticalTemplateFor('${vertical}') returned null`);
  }
});

test('applyVerticalTemplate mints fresh, distinct section ids each call', () => {
  const a = applyVerticalTemplate('hvac');
  const b = applyVerticalTemplate('hvac');
  assert.ok(a && b, 'hvac template should build');
  const idsA = a.pages.flatMap((p) => p.sections.map((s) => s.id));
  assert.equal(new Set(idsA).size, idsA.length, 'duplicate section ids within one build');
  const idsB = b.pages.flatMap((p) => p.sections.map((s) => s.id));
  assert.equal(idsA.some((id) => idsB.includes(id)), false, 'two builds share section ids');
});

test('applyVerticalTemplate returns null for a vertical with no template', () => {
  // car-detailing has no bespoke template yet; the Studio falls back to the default composition.
  assert.equal(applyVerticalTemplate('car-detailing'), null);
});

test('HVAC services, about, and contact use the standard sections', () => {
  const pages = Object.fromEntries(
    applyVerticalTemplate('hvac').pages.map((p) => [p.route, p.sections.map((s) => s.name)]),
  );
  assert.deepEqual(pages.services, ['HvacPageHeader', 'HvacServices', 'HvacFaq', 'HvacFinalCta']);
  assert.deepEqual(pages.about, ['HvacPageHeader', 'HvacAbout', 'HvacServiceArea', 'HvacReviews', 'HvacFinalCta']);
  assert.deepEqual(pages.contact, ['HvacPageHeader', 'HvacContact', 'HvacFaq', 'HvacFinalCta']);
});

test('the HVAC home mirrors the Northstar Standard tab (bespoke hero/stats/services/area/faq)', () => {
  const home = applyVerticalTemplate('hvac').pages.find((p) => p.route === '');
  assert.ok(home, 'hvac template must have a home page at route ""');
  // The Standard hero (full-bleed image + scrim) must open the page.
  assert.equal(home.sections[0]?.name, 'HvacHero', 'home must open with the Standard hero');
  // The five bespoke sections the Standard tab defines are all present, in order.
  const names = home.sections.map((s) => s.name);
  for (const bespoke of ['HvacHero', 'HvacStatBand', 'HvacServices', 'HvacServiceArea', 'HvacFaq']) {
    assert.ok(names.includes(bespoke), `home is missing the bespoke ${bespoke}`);
  }
});

test('the HVAC home section order exactly matches the Northstar Standard tab (D6c)', () => {
  // `.includes` above only checks presence, not sequence, so it could not have caught the
  // reviews/faq swap this test exists to pin. design/northstar-standard/mockups.html orders
  // the full page … area → reviews → FAQ → final CTA; hvacTemplate() previously had FAQ before
  // reviews, which this exact-sequence assertion now forbids from silently regressing.
  const home = applyVerticalTemplate('hvac').pages.find((p) => p.route === '');
  assert.deepEqual(home.sections.map((s) => s.name), [
    'HvacHero',
    'HvacStatBand',
    'HvacServices',
    'HvacServiceArea',
    'HvacReviews',
    'HvacFaq',
    'HvacFinalCta',
  ]);
});
