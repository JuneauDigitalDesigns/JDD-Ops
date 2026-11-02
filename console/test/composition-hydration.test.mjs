/**
 * Which composition a saved wizard bundle opens with — and the truthiness bug that made an
 * empty bundle open as an empty SITE.
 *
 * ── The bug this encodes ────────────────────────────────────────────────────
 *
 * BuildWizard chose between three sources inline:
 *
 *     b.siteComposition ?? (b.selections || b.order ? liftLegacy(...) : defaultCompositionFor())
 *
 * `{}` and `[]` are both TRUTHY in JavaScript. So a bundle that had selected nothing — which
 * is what the page read-back produced for an unwired repo, and what `freshBundle` holds before
 * anything is picked — took the LIFT branch, not the default. `liftLegacyToComposition({}, [])`
 * returns a structurally valid one-page site whose home page has zero body sections and whose
 * chrome comes from CHROME_FALLBACK.
 *
 * That composition then exported cleanly: `validateEntries` only checks the flattened component
 * list against the catalog allowlist, and chrome alone fills it with three valid entries. A
 * client site went live as `<NavMinimal />` above `<FooterColumns />`.
 *
 * The decision now lives in `compositionFromBundle` so it can be asserted here rather than
 * only reachable through a React effect.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compositionFromBundle, validateComposition } from '../src/lib/pages.ts';
import { defaultCompositionFor } from '../src/app/c/[slug]/build/page-templates.tsx';

/** A sentinel fallback, so a test can tell WHICH branch ran rather than inferring it. */
const SENTINEL = () => ({
  chrome: {
    nav: { categoryId: 'nav', name: 'NavMinimal' },
    footer: { categoryId: 'footer', name: 'FooterColumns' },
    seo: { categoryId: 'seo', name: 'SeoLocalBusiness' },
  },
  pages: [{ route: '', pageType: 'home', label: 'SENTINEL', templateId: 't', navVisible: true, sections: [] }],
});

test('an EMPTY bundle falls back to the default, not an empty one-page lift', () => {
  // The exact shape freshBundle() writes, and the exact shape the read-back produced for an
  // unwired repo. Both were landing on the lift.
  const comp = compositionFromBundle({ selections: {}, skins: {}, order: [] }, SENTINEL);
  assert.equal(comp.pages[0].label, 'SENTINEL', 'empty bundle must take the fallback branch');
});

test('a bundle with no legacy keys at all falls back too', () => {
  const comp = compositionFromBundle({}, SENTINEL);
  assert.equal(comp.pages[0].label, 'SENTINEL');
});

test('the real default reached from an empty bundle is a complete, valid 4-page site', () => {
  // The end-to-end consequence: this is what the operator's Studio opens with, and what the
  // exporter would ship. Previously it was one page with nothing on it.
  const comp = compositionFromBundle({ selections: {}, order: [] }, defaultCompositionFor);
  assert.equal(comp.pages.length, 4);
  assert.doesNotThrow(() => validateComposition(comp));
});

test('a bundle with real legacy selections is still lifted, not discarded', () => {
  const comp = compositionFromBundle(
    {
      selections: { nav: 'NavMinimal', footer: 'FooterColumns', seo: 'SeoLocalBusiness', hero: 'HeroSplit', services: 'ServicesGrid' },
      order: ['nav', 'hero', 'services', 'footer'],
    },
    SENTINEL,
  );
  assert.notEqual(comp.pages[0].label, 'SENTINEL', 'a populated legacy bundle must take the lift branch');
  assert.equal(comp.pages.length, 1);
  assert.deepEqual(
    comp.pages[0].sections.map((s) => s.categoryId),
    ['hero', 'services'],
  );
});

test('order alone (no selections map) still counts as legacy content', () => {
  const comp = compositionFromBundle({ order: ['hero'] }, SENTINEL);
  assert.notEqual(comp.pages[0].label, 'SENTINEL');
});

test('an explicit siteComposition always wins', () => {
  const explicit = defaultCompositionFor();
  explicit.pages[0].label = 'EXPLICIT';
  const comp = compositionFromBundle(
    { siteComposition: explicit, selections: { hero: 'HeroSplit' }, order: ['hero'] },
    SENTINEL,
  );
  assert.equal(comp.pages[0].label, 'EXPLICIT');
});
