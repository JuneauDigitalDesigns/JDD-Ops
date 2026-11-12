// Photos added in the intake go through the image pipeline at export (Xander 2026-11-12: they
// "must not skip image compression"). Before this, resolveUploads copied each staged original into
// public/images and pointed the site at /images/<file>: the phone's full-size JPEG, EXIF and GPS
// intact, no WebP widths, no orientation fix. materializeImages only handled http(s) URLs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';

const CONSOLE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(path.join(CONSOLE, p), 'utf8').replace(/\r\n/g, '\n');
// Windows: sharp keeps input files open in its cache, which blocks the temp dir cleanup.
sharp.cache(false);

const FILE = 'd68f8deb-0223-40ee-b47e-296ae9f0f0b5.jpg'; // one of Xander's real staged names
const REF = `upload://${FILE}`;

/** A phone photo: landscape pixels, EXIF orientation 6, GPS. */
const phoneJpeg = () =>
  sharp({ create: { width: 1600, height: 1200, channels: 3, background: '#4a7' } })
    .jpeg()
    .withExif({ IFD0: { Make: 'TestPhone' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '28/1 32/1 0/1' } })
    .withMetadata({ orientation: 6 })
    .toBuffer();

/** Run `body` (an ES module's code) against the server-only console modules, return its stdout JSON. */
function runServer(dir, body, args = []) {
  const script = path.join(dir, `run-${Math.random().toString(36).slice(2)}.mjs`);
  writeFileSync(script, body);
  // These modules are server-only: the react-server condition resolves `server-only` to an empty
  // module, and tsx loads them as the suite does.
  return JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', script, ...args], { cwd: CONSOLE, encoding: 'utf8' }));
}
const mod = (p) => JSON.stringify(pathToFileURL(path.join(CONSOLE, p)).href);

test('resolveUploads leaves a staged photo for the pipeline and empties only a vanished one', () => {
  const stage = mkdtempSync(path.join(tmpdir(), 'stage-'));
  try {
    writeFileSync(path.join(stage, FILE), 'x');
    const content = { services: { items: [{ image: { url: REF } }] }, work: { projects: [{ image: { url: 'upload://00000000-0000-0000-0000-000000000000.jpg' } }] } };
    const { out, missing, refs, none } = runServer(stage, `
      import { resolveUploads, stagedRefsIn } from ${mod('src/lib/export.ts')};
      const { content: out, missing } = resolveUploads(JSON.parse(process.argv[2]), process.argv[3]);
      process.stdout.write(JSON.stringify({ out, missing, refs: stagedRefsIn(out), none: stagedRefsIn({ a: ['/img/abc', { b: 'https://x' }] }) }));
    `, [JSON.stringify(content), stage]);
    assert.equal(out.services.items[0].image.url, REF, 'kept as a staged ref: no raw copy, no /images/ path');
    assert.equal(out.work.projects[0].image.url, '', 'gone from the stage: the slot falls back to a placeholder');
    assert.deepEqual(missing, ['00000000-0000-0000-0000-000000000000.jpg']);
    assert.deepEqual(refs, ['services.items.0.image.url']);
    assert.deepEqual(none, []);
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
});

test('an intake photo exports as pipeline files (upright, no EXIF or GPS, WebP widths), never the raw original', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'export-'));
  const stage = path.join(root, '.uploads');
  try {
    mkdirSync(stage, { recursive: true });
    mkdirSync(path.join(root, 'clients', 'demo', 'repo'), { recursive: true });
    writeFileSync(path.join(stage, FILE), await phoneJpeg());
    const content = {
      _meta: {},
      images: { hero: { slides: [] }, about: {}, testimonials: {}, footer: {} },
      services: { items: [{ t: 'AC Installation & Service', image: { url: REF, alt: 'AC' } }] },
      work: { projects: [{ t: 'AC', image: { url: REF, alt: 'AC' }, service: 'ac-installation-service' }] },
    };
    // image-pipeline.ts is server-only, so it runs in a child process with the react-server
    // condition (server-only resolves to an empty module there), through the same tsx loader.
    const script = path.join(root, 'run.mjs');
    writeFileSync(script, `
      import { materializeImages } from ${JSON.stringify(pathToFileURL(path.join(CONSOLE, 'src/lib/image-pipeline.ts')).href)};
      const content = JSON.parse(process.argv[2]);
      const r = await materializeImages(process.argv[3], 'demo', content, () => {}, process.argv[4]);
      process.stdout.write(JSON.stringify(r));
    `);
    const out = JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', script, JSON.stringify(content), root, stage], { cwd: CONSOLE, encoding: 'utf8' }));
    const base = out.content.services.items[0].image.url;
    assert.match(base, /^\/img\/[0-9a-f]{16}$/, 'the slot holds the pipeline base, not the staged ref or /images/');
    assert.equal(out.content.work.projects[0].image.url, base, 'the same photo encodes once');
    assert.deepEqual(out.failed, []);
    assert.equal(out.content._meta.local_images[REF], base);

    const img = path.join(root, 'clients', 'demo', 'repo', 'public', 'img');
    const files = readdirSync(img).sort();
    assert.deepEqual(files, [640, 1024, 1536, 2048].map((w) => `${base.slice(5)}-${w}.webp`).sort(), 'WebP widths only');
    assert.equal(existsSync(path.join(root, 'clients', 'demo', 'repo', 'public', 'images')), false, 'no raw copy in public/images');
    const meta = await sharp(readFileSync(path.join(img, `${base.slice(5)}-640.webp`))).metadata();
    assert.equal(meta.exif, undefined, 'EXIF and GPS stripped');
    assert.deepEqual([meta.width, meta.height], [640, 427], 'cropped to the service ratio at the width asked');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the export refuses a staged photo the pipeline could not encode, and never copies a raw original', () => {
  const route = read('src/app/api/build/export/route.ts');
  assert.match(route, /resolveUploads\(content\)/);
  assert.match(route, /const unprocessed = stagedRefsIn\(shipped\);\s*if \(unprocessed\.length > 0\) \{\s*throw new Error\(/);
  assert.ok(route.indexOf('stagedRefsIn(shipped)') < route.indexOf('writeSiteContent(repoRoot, slug, shipped)'), 'checked before site.ts is written');
  assert.doesNotMatch(read('src/lib/export.ts'), /publicImg|\/images\/\$\{file\}/, 'no raw copy into public/images');
});
