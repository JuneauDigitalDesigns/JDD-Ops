import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ensureLayoutMounts, ensureSiteLayout, LAYOUT_FILE } from '../lib/site-layout.js';

/**
 * Every client's layout.tsx must mount smooth scrolling and the mobile sticky call bar.
 *
 * What shipped: `_e2e_test_growth` went live on 2026-11-09 with Lenis installed and
 * src/lib/SmoothScroll.tsx present, but its layout.tsx predates the template mounting either
 * (`96dd76a`), and nothing ever refreshes a client's layout. The fixture below is that layout,
 * copied from the repo.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PRE_LENIS = readFileSync(resolve(ROOT, 'test/fixtures/site-layout/layout.pre-lenis.tsx.txt'), 'utf8');
const TEMPLATE = readFileSync(resolve(ROOT, 'template/src/app/layout.tsx'), 'utf8');

test('a layout from before Lenis gains both mounts after {children}, and nothing else changes', () => {
  const { src, added, error } = ensureLayoutMounts(PRE_LENIS);
  assert.equal(error, undefined);
  assert.deepEqual(added, ['SmoothScroll', 'StickyCallBar']);
  assert.match(src, /const SmoothScroll = nextDynamic\(\(\) => import\('@\/lib\/SmoothScroll'\), \{ ssr: false \}\);/, 'kept out of first paint, as the template does');
  assert.match(src, /import StickyCallBar from '@\/lib\/StickyCallBar';/);
  assert.match(src, /\{children\}\r?\n\s+<SmoothScroll \/>\r?\n\s+<StickyCallBar phone=\{CONTENT\.brand\.phone\} phoneHref=\{CONTENT\.brand\.phoneHref\}/);
  // Every original line survives, in order: the layout is the client's, so this only adds.
  const kept = src.split(/\r?\n/);
  let at = 0;
  for (const line of PRE_LENIS.split(/\r?\n/)) {
    at = kept.indexOf(line, at);
    assert.ok(at > -1, `lost or reordered: ${line}`);
    at += 1;
  }
  assert.deepEqual(ensureLayoutMounts(src).added, [], 'a second run adds nothing');
});

test('the template’s own layout already has both, so it is left alone', () => {
  const r = ensureLayoutMounts(TEMPLATE);
  assert.deepEqual(r.added, []);
  assert.equal(r.src, TEMPLATE);
});

test('a layout that exports `dynamic` as route config gets a loader name that can’t collide', () => {
  const withConfig = PRE_LENIS.replace("export const metadata", "export const dynamic = 'force-static';\nexport const metadata");
  const { src } = ensureLayoutMounts(withConfig);
  assert.match(src, /import nextDynamic from 'next\/dynamic';/);
  assert.doesNotMatch(src, /import dynamic from/);
});

test('a layout with no single {children} line is refused and not written', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'site-layout-'));
  try {
    const file = resolve(dir, LAYOUT_FILE);
    mkdirSync(dirname(file), { recursive: true });
    const odd = PRE_LENIS.replace('        {children}', '        <div>{children}</div>');
    writeFileSync(file, odd);
    for (const f of ['src/lib/SmoothScroll.tsx', 'src/lib/StickyCallBar.tsx']) {
      mkdirSync(dirname(resolve(dir, f)), { recursive: true });
      writeFileSync(resolve(dir, f), '');
    }
    const r = ensureSiteLayout(dir);
    assert.match(r.error, /no line that is just \{children\}/);
    assert.equal(readFileSync(file, 'utf8'), odd, 'untouched');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a repo missing the lib files the mounts import is refused rather than broken', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'site-layout-'));
  try {
    const file = resolve(dir, LAYOUT_FILE);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, PRE_LENIS);
    const r = ensureSiteLayout(dir);
    assert.match(r.error, /src\/lib\/SmoothScroll\.tsx and src\/lib\/StickyCallBar\.tsx are missing/);
    assert.equal(readFileSync(file, 'utf8'), PRE_LENIS);

    mkdirSync(resolve(dir, 'src/lib'), { recursive: true });
    for (const f of ['src/lib/SmoothScroll.tsx', 'src/lib/StickyCallBar.tsx']) writeFileSync(resolve(dir, f), '');
    assert.deepEqual(ensureSiteLayout(dir).added, ['SmoothScroll', 'StickyCallBar']);
    assert.match(readFileSync(file, 'utf8'), /<SmoothScroll \/>/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('onboard.js mounts them in step 3b, before the build that proves the result', () => {
  const src = readFileSync(resolve(ROOT, 'onboard.js'), 'utf8');
  const fonts = src.indexOf('    writeSelfHostedFonts(repoDir);');
  const layout = src.indexOf('    ensureLayoutPieces(repoDir);');
  const build = src.indexOf('    buildClientRepo(repoDir);');
  assert.ok(fonts > -1 && layout > fonts && build > layout);
  assert.match(src, /const result = ensureSiteLayout\(repoDir, \{ write: !DRY_RUN \}\);/, 'a dry run writes nothing');
});
