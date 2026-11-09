/**
 * No exported page may ask for a local image that isn't there.
 *
 * What shipped (2026-11-09): `_e2e_test_growth`'s hero rendered `background-image:url(/img/bae0…)`.
 * The export pipeline rewrites image fields to a localized BASE (`/img/<hash>`) and writes
 * `<hash>-<width>.webp` beside it; the base is not a file. HvacHero (and thirteen other catalog
 * components) put the field straight into a CSS background or <img src>, the build passed, and
 * production served a 404 where the photograph should have been.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { imageAt, isLocalImageBase, LOCAL_IMAGE_WIDTHS } from '../src/lib/localImage.ts';
import { findMissingLocalImages, localImageRefs } from '../src/lib/imageRefs.ts';

const CONSOLE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OPS = path.resolve(CONSOLE, '..');
const CATALOG = path.join(CONSOLE, 'src/components/catalog');
const read = (p) => readFileSync(p, 'utf8');

function catalogFiles() {
  const out = [];
  for (const cat of readdirSync(CATALOG, { withFileTypes: true })) {
    if (!cat.isDirectory()) continue;
    for (const f of readdirSync(path.join(CATALOG, cat.name))) {
      if (f.endsWith('.tsx')) out.push(`${cat.name}/${f}`);
    }
  }
  return out;
}

test('imageAt turns the pipeline’s base into a file it wrote, and leaves anything else alone', () => {
  assert.equal(imageAt('/img/bae0a9968302df37', 1536), '/img/bae0a9968302df37-1536.webp');
  assert.equal(isLocalImageBase('/img/bae0a9968302df37'), true);
  assert.equal(imageAt('https://images.unsplash.com/photo-1?w=800', 1536), 'https://images.unsplash.com/photo-1?w=800', 'the console preview’s origin URL');
  assert.equal(imageAt('/img/logo.png', 640), '/img/logo.png', 'already a file');
  assert.equal(imageAt(undefined, 640), '');
});

test('the helper’s widths are the widths the pipeline writes, and the template ships the same file', () => {
  const pipeline = read(path.join(CONSOLE, 'src/lib/image-pipeline.ts'));
  const widths = /export const WIDTHS = \[([^\]]+)\]/.exec(pipeline)[1].split(',').map((n) => Number(n.trim()));
  assert.deepEqual([...LOCAL_IMAGE_WIDTHS], widths, 'a width the pipeline never wrote is a 404');
  assert.equal(
    read(path.join(OPS, 'template/src/lib/localImage.ts')),
    read(path.join(CONSOLE, 'src/lib/localImage.ts')),
    'catalog components import @/lib/localImage in the preview AND in every client repo',
  );
});

test('no catalog component puts an image field into a CSS background or <img src> raw', () => {
  const raw = [];
  for (const rel of catalogFiles()) {
    const src = read(path.join(CATALOG, rel));
    for (const m of src.matchAll(/url\(\$\{([^}]+)\}\)/g)) {
      if (!m[1].trim().startsWith('imageAt(')) raw.push(`${rel}: url(\${${m[1]}})`);
    }
    for (const m of src.matchAll(/\bsrc=\{([^}]+)\}/g)) {
      const expr = m[1].trim();
      // A helper's result (`heroPic.src` from responsivePicture) or imageAt() is a real file.
      if (!expr.startsWith('imageAt(') && !/\.src$/.test(expr)) raw.push(`${rel}: src={${expr}}`);
    }
  }
  assert.deepEqual(raw, [], 'route these through imageAt() or responsiveImage()');
});

test('the built-page check finds a local image address with no file behind it', () => {
  const repo = mkdtempSync(path.join(tmpdir(), 'image-refs-'));
  try {
    assert.equal(findMissingLocalImages(repo).pagesFound, 0, 'no build output is "could not check", never a pass');

    const app = path.join(repo, '.next/server/app');
    mkdirSync(path.join(app, 'services'), { recursive: true });
    mkdirSync(path.join(repo, 'public/img'), { recursive: true });
    writeFileSync(path.join(repo, 'public/img/bae0a9968302df37-1536.webp'), '');
    writeFileSync(path.join(repo, 'public/img/bae0a9968302df37-640.webp'), '');
    // The live hero, as it was served, beside correct uses and someone else's /img/.
    writeFileSync(
      path.join(app, 'index.html'),
      '<div style="background-image:url(/img/bae0a9968302df37)"></div>' +
        '<img srcset="/img/bae0a9968302df37-640.webp 640w" src="/img/bae0a9968302df37-1536.webp">' +
        '<img src="https://cdn.example.com/img/other.png">',
    );
    writeFileSync(path.join(app, 'services.html'), '<div style="background-image:url(/img/bae0a9968302df37)"></div>');
    writeFileSync(path.join(app, 'services/index.html'), '<p>no images</p>');

    const r = findMissingLocalImages(repo);
    assert.equal(r.pagesFound, 3);
    assert.deepEqual(r.missing, [{ ref: '/img/bae0a9968302df37', pages: ['index.html', 'services.html'] }]);

    assert.deepEqual(localImageRefs('url(/img/a-640.webp) /img/b x/img/c https://h/img/d'), ['/img/a-640.webp', '/img/b']);
    // Component data Next inlines in scripts is not a request; only markup is.
    assert.deepEqual(localImageRefs('<script>self.__next_f.push([1,"{\"url\":\"/img/raw\"}"])</script><div style="background:url(/img/real-640.webp)"></div>'), ['/img/real-640.webp']);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('the export mounts the layout pieces after the template copy and before install', () => {
  const src = read(path.join(CONSOLE, 'src/app/api/build/export/route.ts'));
  const copy = src.indexOf('copyTemplate(repoRoot, slug, { overwrite })');
  const layout = src.indexOf('(await loadSiteLayout()).ensureSiteLayout(repoDirFor(repoRoot, slug))');
  const install = src.indexOf("runNpm('install'");
  assert.ok(copy > -1 && layout > copy && install > layout, 'after src/lib is in place, before the build proves it');
  assert.match(src.slice(layout, install), /if \(layout\.error\) \{[\s\S]*?return;/, 'an unplaceable layout stops the export');
});

test('the export runs that check after the build and before anything is committed', () => {
  const src = read(path.join(CONSOLE, 'src/app/api/build/export/route.ts'));
  const build = src.indexOf("runNpm('run build'");
  const check = src.indexOf('findMissingLocalImages(repoDir)');
  const refuse = src.indexOf('} else if (images.missing.length > 0) {');
  const deploy = src.indexOf('if (deploy) {');
  assert.ok(build > -1 && check > build && refuse > check && deploy > refuse);
  assert.match(src.slice(refuse, deploy), /return;/, 'a missing image stops the export');
});
