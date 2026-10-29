/**
 * The page read-back, and the empty composition it used to certify as real.
 *
 * ── The bug this encodes ────────────────────────────────────────────────────
 *
 * `parseExportedPage` returned null only when a page lacked the `@studio:body` markers. But
 * `template/src/app/page.tsx` CARRIES those markers — they are the anchors the exporter writes
 * into — and its placeholder body is ordinary `<header>`/`<section>` markup with no catalog
 * imports. `ELEMENT_RE` matches only self-closing elements, so it found nothing, and the
 * function returned a perfectly well-formed `{selections:{}, skins:{}, order:[]}`.
 *
 * Non-null was the whole problem. BuildWizard reads non-null as "this client is already
 * exported, so DISK WINS" and discards the operator's saved composition — in favour of
 * nothing. `compositionFromBundle` then lifted the empty legacy state into a one-page site
 * with zero sections, the exporter wrote a home page holding only chrome, `pruneStaleRoutes`
 * deleted every subpage route, and that got committed and deployed. The live site was a nav
 * bar stacked on a footer.
 *
 * The real template file is read from disk rather than inlined, deliberately: a hand-written
 * fixture would encode what we BELIEVE the template looks like, and the belief is exactly what
 * was wrong. Only the real file can contradict us — and if someone makes the template's
 * placeholders self-closing, this test should start failing and make them think about it.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
// readback-parse.ts, not studio-readback.ts: the latter imports `server-only`, which throws
// under the tsx test loader. The parser was split out precisely so the buggy part is reachable.
import { parseExportedPage } from '../src/lib/readback-parse.ts';

const OPS_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

test('the bare template page is NOT a composition, despite carrying the studio markers', () => {
  const src = readFileSync(resolve(OPS_ROOT, 'template/src/app/page.tsx'), 'utf8');

  // The precondition that made this subtle: the markers really are there.
  assert.match(src, /@studio:body:start/, 'template lost its markers — this test is now vacuous');

  assert.equal(
    parseExportedPage(src),
    null,
    'the unwired template parsed as a real composition; BuildWizard will discard the draft and export chrome only',
  );
});

test('a wired page round-trips back into a composition', () => {
  const src = [
    `import NavMinimal from '@/components/catalog/nav/NavMinimal';`,
    `import HeroSplit from '@/components/catalog/hero/HeroSplit';`,
    `import FooterColumns from '@/components/catalog/footer/FooterColumns';`,
    ``,
    `export { generateMetadata } from '@/components/catalog/seo/SeoLocalBusiness';`,
    ``,
    `export default function Page() {`,
    `  return (`,
    `    <main>`,
    `      {/* @studio:body:start */}`,
    `      <NavMinimal />`,
    // `inverted` is a skin HeroSplit genuinely declares (SKINS in @jdd/ui). A skin the
    // component does not support is dropped by isValidSkin, which would make this assertion
    // pass or fail for reasons that have nothing to do with the parser.
    `      <HeroSplit skin="inverted" />`,
    `      <FooterColumns />`,
    `      {/* @studio:body:end */}`,
    `    </main>`,
    `  );`,
    `}`,
  ].join('\n');

  const back = parseExportedPage(src);
  assert.ok(back, 'a genuinely wired page must still parse');
  assert.deepEqual(back.order, ['nav', 'hero', 'footer']);
  assert.equal(back.selections.hero, 'HeroSplit');
  assert.equal(back.selections.seo, 'SeoLocalBusiness');
  assert.equal(back.skins.hero, 'inverted');
});

test('an seo re-export alone does not make an unwired page look composed', () => {
  // The seo entry rides in outside the body region, so folding it in before the
  // "did we find anything?" check would resurrect the original bug through a side door:
  // entries would be length 1 and the page would read as a composition of nothing but chrome.
  const src = [
    `export { generateMetadata } from '@/components/catalog/seo/SeoLocalBusiness';`,
    `export default function Page() {`,
    `  return (`,
    `    <main>`,
    `      {/* @studio:body:start */}`,
    `      <section>placeholder</section>`,
    `      {/* @studio:body:end */}`,
    `    </main>`,
    `  );`,
    `}`,
  ].join('\n');

  assert.equal(parseExportedPage(src), null);
});

test('a page with no body markers at all is still null', () => {
  assert.equal(parseExportedPage('export default function Page() { return null; }'), null);
});
