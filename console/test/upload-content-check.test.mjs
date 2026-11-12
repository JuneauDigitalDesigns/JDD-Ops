// Uploads are checked for what they are, not what they're called (Xander 2026-11-12: "fix the JPEG
// extension issue. We should be catching that when it uploads").
//
// The front-to-back test staged a file named .jpg that wasn't an image: /api/build/upload checked the
// extension and the 8 MB cap only, so it staged, and the operator learned at export, when #97's
// "could not be prepared for the web" stopped it. The intake, the Studio's image tiles and the Brand
// drawer all post to that one route, and none of them showed the route's error anyway.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

import { checkUpload } from '../src/lib/uploadCheck.ts';

const CONSOLE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(path.join(CONSOLE, p), 'utf8').replace(/\r\n/g, '\n');
const img = (fmt) => sharp({ create: { width: 40, height: 30, channels: 3, background: '#e60' } })[fmt]().toBuffer();
const SVG = Buffer.from('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>');

test('a file named .jpg that is not an image is refused, with the route\'s own words', async () => {
  for (const [name, bytes] of [
    ['notes.jpg', Buffer.from('this is a text file, renamed')],
    ['empty.jpg', Buffer.alloc(0)],
    ['page.png', Buffer.from('<html><body>not a picture</body></html>')],
  ]) {
    const r = await checkUpload(bytes, name, { allowSvg: false });
    assert.deepEqual(r, { ok: false, error: 'Unsupported image type.' }, name);
  }
});

test('a JPEG, PNG and WebP pass, stored under the extension of what they really are', async () => {
  assert.deepEqual(await checkUpload(await img('jpeg'), 'job.jpg', { allowSvg: false }), { ok: true, ext: '.jpg' });
  assert.deepEqual(await checkUpload(await img('png'), 'logo.png', { allowSvg: false }), { ok: true, ext: '.png' });
  assert.deepEqual(await checkUpload(await img('webp'), 'job.webp', { allowSvg: false }), { ok: true, ext: '.webp' });
  // Real content under the wrong name: kept, under its true extension.
  assert.deepEqual(await checkUpload(await img('png'), 'photo.jpg', { allowSvg: false }), { ok: true, ext: '.png' });
});

test('a file that starts like an image but won\'t decode is refused', async () => {
  const jpeg = await img('jpeg');
  const cut = jpeg.subarray(0, 40); // the JPEG signature, then nothing usable
  assert.deepEqual(await checkUpload(cut, 'cut.jpg', { allowSvg: false }), { ok: false, error: 'Unsupported image type.' });
});

test('SVG only for the logo, as before', async () => {
  assert.deepEqual(await checkUpload(SVG, 'logo.svg', { allowSvg: true }), { ok: true, ext: '.svg' });
  assert.deepEqual(await checkUpload(SVG, 'job.svg', { allowSvg: false }), { ok: false, error: 'Unsupported image type.' });
});

test('every console upload goes through the check, and each place shows the refusal', () => {
  const route = read('src/app/api/build/upload/route.ts');
  assert.match(route, /await checkUpload\(/, 'the one upload route checks the content');
  assert.ok(route.indexOf('checkUpload(') < route.indexOf('writeFileSync('), 'before anything is staged');
  assert.match(route, /allowSvg: form\.get\('path'\) === 'images\.footer\.logoImage'/);
  for (const f of ['src/components/wizard/intake/ServicesStep.tsx', 'src/components/fields/index.tsx', 'src/app/c/[slug]/build/brand/ImageTile.tsx']) {
    const src = read(f);
    assert.match(src, /setUploadError\(d\.error/, `${f}: the route's error is shown, not dropped`);
    assert.match(src, /\{uploadError && /, `${f}: rendered where the upload was made`);
  }
});
