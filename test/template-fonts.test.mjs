/**
 * Client-site builds must never fetch fonts from Google.
 *
 * The bug that shipped: template/src/lib/fonts.loader.ts loaded seven families through
 * next/font/google, which downloads them during `next build` — on Vercel, on every client deploy,
 * even for a system-stack brand that uses none of them. Two ways that failed the build at random:
 *   - ~5% of Google Fonts CSS responses (measured 2026-11-03) name a file
 *     `fonts.gstatic.com/l/font?kit=…` with no extension. Next 14.2's google loader then throws
 *     `Cannot read properties of null (reading '1')`. With seven families a large share of builds
 *     drew one. JDD-Ops #16 patched the console's Next; the template, and so every client repo,
 *     had no patch.
 *   - A download that fails or times out fails the build. That broke an agency production build
 *     on 2026-11-04, and no loader patch can fix it.
 * The fix self-hosts the files (next/font/local), and onboard.js writes them into every client
 * repo on every run, because the repos that already exist are the ones with the broken loader.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FONT_LOADER,
  googleFontImports,
  loaderFontPaths,
  siteFontFiles,
  writeSiteFonts,
} from '../lib/site-fonts.js';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const TEMPLATE = resolve(ROOT, 'template');
const LOADER_SRC = readFileSync(resolve(TEMPLATE, FONT_LOADER), 'utf8');

test('nothing in the template imports next/font/google', () => {
  assert.deepEqual(googleFontImports(TEMPLATE), []);
});

test("the console's catalog components do not import next/font/google either", () => {
  // Exported catalog components are copied into client repos, so they are client-site code too.
  // (The console's own app layout is not: it never ships to a client.)
  const consoleDir = resolve(ROOT, 'console');
  assert.deepEqual(googleFontImports(consoleDir, { under: 'src/components/catalog' }), []);
  // The walk itself must reach that tree, or the assertion above passes on an empty directory:
  // the console's own layout DOES import next/font/google, so the same walk over src/app finds it.
  assert.ok(googleFontImports(consoleDir, { under: 'src/app' }).includes('src/app/layout.tsx'));
});

test('every font file the template loader names is committed, and is woff2', () => {
  const paths = loaderFontPaths(LOADER_SRC);
  assert.ok(paths.length > 0, 'the template loader names no local font files');
  assert.match(LOADER_SRC, /from 'next\/font\/local'/);
  for (const rel of paths) {
    let bytes;
    assert.doesNotThrow(() => { bytes = readFileSync(resolve(TEMPLATE, rel)); }, `${rel} is missing`);
    // A file checked out through a text filter (CRLF conversion) would still exist, and the
    // build would still pass, but the browser would reject the font. The magic proves the bytes.
    assert.equal(bytes.subarray(0, 4).toString('latin1'), 'wOF2', `${rel} is not woff2`);
  }
});

test('every family in VAR_TO_CLASS is loaded from a local file', () => {
  const vars = [...LOADER_SRC.matchAll(/'(--font-[\w-]+)':\s*(\w+)\.variable/g)];
  assert.ok(vars.length >= 7, `expected the seven pairing families, found ${vars.length}`);
  for (const [, varName, ident] of vars) {
    const decl = new RegExp(`const ${ident}\\s*=\\s*localFont\\(\\{[\\s\\S]*?variable:\\s*'${varName}'`);
    assert.match(LOADER_SRC, decl, `${varName} (${ident}) is not a localFont with that variable`);
  }
});

test('writeSiteFonts replaces a repo\'s google loader with the self-hosted one, byte for byte', () => {
  const repo = mkdtempSync(join(tmpdir(), 'jdd-site-fonts-'));
  try {
    // The shape of every client repo provisioned before the fix.
    mkdirSync(join(repo, 'src', 'lib'), { recursive: true });
    writeFileSync(
      join(repo, FONT_LOADER),
      "import { Oswald } from 'next/font/google';\nconst oswald = Oswald({ subsets: ['latin'] });\n",
    );
    assert.deepEqual(googleFontImports(repo), [FONT_LOADER]);

    const written = writeSiteFonts(repo, TEMPLATE);
    assert.deepEqual(written, siteFontFiles(TEMPLATE));
    for (const rel of written) {
      assert.ok(
        readFileSync(join(repo, rel)).equals(readFileSync(resolve(TEMPLATE, rel))),
        `${rel} was not copied byte for byte`,
      );
    }
    for (const rel of loaderFontPaths(LOADER_SRC)) {
      assert.ok(written.includes(rel), `the loader needs ${rel} but writeSiteFonts did not write it`);
    }
    assert.deepEqual(googleFontImports(repo), []);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('onboard.js writes the fonts into every repo before it builds it', () => {
  // onboard.js is a script, not a module, so this reads the source (as commit-and-push.test does).
  // The order matters: step 5's `npm run build` is what proves the written loader compiles, and
  // it has to run before the push, so a repo can never ship with a loader pointing at files that
  // are not there.
  const src = readFileSync(resolve(ROOT, 'onboard.js'), 'utf8');
  const loop = src.slice(src.indexOf('installClientSchema(repoDir, site);'));
  const fonts = loop.indexOf('writeSelfHostedFonts(repoDir);');
  const build = loop.indexOf('buildClientRepo(repoDir);');
  assert.ok(fonts > 0, 'onboard.js never calls writeSelfHostedFonts in the per-site loop');
  assert.ok(build > fonts, 'writeSelfHostedFonts must run before buildClientRepo');
  // Not inside an `if`: an existing repo (console-authored or not) must get it on every run.
  const body = src.slice(src.indexOf('function writeSelfHostedFonts('));
  assert.match(body.slice(0, body.indexOf('\n}')), /writeSiteFonts\(repoDir, resolve\(SCRIPT_DIR, 'template'\)\)/);
});
