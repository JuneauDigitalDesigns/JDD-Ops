/**
 * The guard that refuses to export a site with no content on it.
 *
 * ── The bug this encodes ────────────────────────────────────────────────────
 *
 * A client went live as a nav bar stacked on a footer, and nothing in the pipeline objected.
 * Two reasons, both fixed here:
 *
 *   1. `validateEntries` — the only server-side check the export ran — validates the FLATTENED
 *      component list against the catalog allowlist. Site chrome (nav + footer + seo) fills
 *      that list with three perfectly valid entries, so a composition whose pages are empty
 *      passes it without complaint.
 *
 *   2. `validateComposition`, the one function that could have caught it, had ZERO CALLERS
 *      anywhere in the codebase. Every rule it encodes was being enforced on nobody.
 *
 * So this file asserts both that the empty-body rule exists and that the export route actually
 * invokes the validator. The second assertion is the one that matters: re-adding the rule
 * without a caller is precisely the state the code was already in.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateComposition, liftLegacyToComposition } from '../src/lib/pages.ts';
import { defaultCompositionFor } from '../src/app/c/[slug]/build/page-templates.tsx';

const CONSOLE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('a chrome-only composition is refused', () => {
  // Byte-for-byte the composition that shipped: the empty legacy lift.
  const shipped = liftLegacyToComposition({ selections: {}, order: [] });
  assert.equal(shipped.pages.length, 1);
  assert.equal(shipped.pages[0].sections.length, 0);

  assert.throws(
    () => validateComposition(shipped),
    /no content sections/,
    'the composition that produced a nav-and-footer-only live site must be refused',
  );
});

test('a page carrying only a pageHeader is refused too', () => {
  // A header is a title block, not content. A page with just one renders as a heading on an
  // otherwise blank route, which is the same failure wearing a hat.
  const comp = defaultCompositionFor();
  const services = comp.pages.find((p) => p.route === 'services');
  services.sections = [{ categoryId: 'pageHeader', name: 'PageHeaderSimple', id: 's_x' }];
  assert.throws(() => validateComposition(comp), /no content sections/);
});

test('the default 4-page site still passes', () => {
  // Guards against over-correction: a rule that rejects legitimate compositions blocks every
  // export instead of just the broken one.
  assert.doesNotThrow(() => validateComposition(defaultCompositionFor()));
});

test('a legitimate single-page site still passes', () => {
  // MIN_PAGES is 1 on purpose — single-page sites are still shippable, and a legacy client
  // lifts to exactly this shape.
  const one = liftLegacyToComposition({
    selections: { nav: 'NavMinimal', footer: 'FooterColumns', seo: 'SeoLocalBusiness', hero: 'HeroSplit' },
    order: ['nav', 'hero', 'footer'],
  });
  assert.doesNotThrow(() => validateComposition(one));
});

test('the export route CALLS validateComposition', () => {
  // The rule above is worthless without this. validateComposition sat in the tree with no
  // callers at all while a chrome-only site was built, committed and deployed through the very
  // route that should have been asking it.
  const route = readFileSync(resolve(CONSOLE_ROOT, 'src/app/api/build/export/route.ts'), 'utf8');
  assert.match(route, /\bvalidateComposition\s*\(/, 'the export route must invoke the composition validator');
});
