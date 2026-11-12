// Client photos load fast and cost no SEO (Xander 2026-11-11, via the orchestrator).
//
// What shipped before this:
// - Every vertical hero painted its LCP photo as a CSS background-image at one fixed width
//   (imageAt(slide, 1536)): invisible to the preload scanner, no srcset, so a phone downloaded the
//   1536px file, no AVIF though the pipeline writes it for the hero, and no fetch priority.
//   22 catalog components drew client photos that way.
// - The pipeline never applied EXIF orientation (a phone's portrait shot could ship sideways) and
//   read any size of input.
// These run the real encoder on real image bytes and render the real components.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { writeImage, isPlainSvg, MAX_INPUT_BYTES } from '../src/lib/image-encode.ts';
import { CONTENT as HVAC } from '../src/data/verticals/hvac.ts';

// tsx compiles JSX to classic React.createElement calls (see lead-form-prefill.test.mjs).
globalThis.React = React;
// Windows: sharp keeps input files open in its cache, which blocks the temp dir cleanup.
sharp.cache(false);

const CONSOLE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OPS = path.resolve(CONSOLE, '..');
const CATALOG = path.join(CONSOLE, 'src/components/catalog');
const read = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const PHOTO = { ratio: 3 / 2, avif: false, logo: false, widths: [640] };
const LOGO = { ratio: 1, avif: false, logo: true, widths: [640] };

function withDir(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), 'img-encode-'));
  return Promise.resolve(fn(dir)).finally(() => rmSync(dir, { recursive: true, force: true }));
}

/** A phone-style JPEG: landscape pixels, EXIF says "rotate 90°" (orientation 6), with GPS. */
async function phoneJpeg() {
  return sharp({ create: { width: 1200, height: 800, channels: 3, background: '#c33' } })
    .jpeg()
    .withExif({ IFD0: { Make: 'TestPhone', Model: 'X' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '28/1 32/1 0/1' } })
    .withMetadata({ orientation: 6 })
    .toBuffer();
}

// ── The encoder ────────────────────────────────────────────────────────────────

test('a phone photo is turned upright, and its EXIF and GPS never reach the site', async () => {
  const input = await phoneJpeg();
  const inMeta = await sharp(input).metadata();
  assert.equal(inMeta.orientation, 6, 'fixture: the input carries an orientation');
  assert.ok(inMeta.exif, 'fixture: the input carries EXIF');
  await withDir(async (dir) => {
    // A logo keeps its shape (no crop), so its output dimensions show the rotation.
    const base = await writeImage(input, dir, LOGO);
    const out = await sharp(readFileSync(path.join(dir, `${base.slice(5)}-640.webp`))).metadata();
    assert.ok(out.height > out.width, `upright: ${out.width}x${out.height} should be portrait`);
    assert.equal(out.exif, undefined, 'EXIF (and its GPS) stripped');
    assert.equal(out.orientation, undefined);
    // A photo slot too.
    const photo = await writeImage(input, dir, PHOTO);
    const pm = await sharp(readFileSync(path.join(dir, `${photo.slice(5)}-640.webp`))).metadata();
    assert.equal(pm.exif, undefined, 'EXIF stripped from a photo slot');
    assert.deepEqual([pm.width, pm.height], [640, 427], 'cropped to the slot ratio at the width asked');
  });
});

test('an oversized input is refused before it is decoded', async () => {
  await withDir(async (dir) => {
    await assert.rejects(writeImage(Buffer.alloc(MAX_INPUT_BYTES + 1), dir, PHOTO), /too large/);
    assert.deepEqual(readdirSync(dir), [], 'nothing written');
  });
});

test('a logo keeps its transparency; a plain SVG logo ships as the SVG, an active one is rasterized', async () => {
  const png = await sharp({ create: { width: 400, height: 200, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
  const plain = Buffer.from('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 20"><rect width="40" height="20" fill="#13293F"/></svg>');
  const active = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 20" onload="alert(1)"><rect width="40" height="20"/></svg>');
  assert.equal(isPlainSvg(plain), true);
  assert.equal(isPlainSvg(active), false);
  assert.equal(isPlainSvg(Buffer.from('<svg><script>x()</script></svg>')), false);
  assert.equal(isPlainSvg(Buffer.from('<svg><image href="https://evil.example/x.png"/></svg>')), false);
  assert.equal(isPlainSvg(png), false);
  await withDir(async (dir) => {
    const a = await writeImage(png, dir, LOGO);
    assert.equal((await sharp(readFileSync(path.join(dir, `${a.slice(5)}-640.webp`))).metadata()).hasAlpha, true, 'alpha kept');
    const b = await writeImage(plain, dir, LOGO);
    assert.match(b, /^\/img\/[0-9a-f]{16}\.svg$/);
    assert.equal(readFileSync(path.join(dir, b.slice(5))).toString(), plain.toString());
    const c = await writeImage(active, dir, LOGO);
    assert.match(c, /^\/img\/[0-9a-f]{16}$/, 'active SVG is rasterized, never served as a file');
    // A plain SVG for a PHOTO slot is still rasterized: only logos ship as vector.
    assert.match(await writeImage(plain, dir, PHOTO), /^\/img\/[0-9a-f]{16}$/);
  });
});

test('the pipeline hands every slot to the encoder with the export\'s own widths and ratios', () => {
  const src = read(path.join(CONSOLE, 'src/lib/image-pipeline.ts'));
  assert.match(src, /return writeImage\(buf, outDir, \{\n\s+ratio: RATIOS\[slot\.ratioKey\],\n\s+avif: AVIF_RATIO_KEYS\.includes\(slot\.ratioKey\) && !slot\.isLogo,\n\s+logo: Boolean\(slot\.isLogo\),\n\s+widths: WIDTHS,/);
  // Both sources reach that one call: a fetched URL, and a photo staged in console/.uploads (2026-11-12).
  assert.match(src, /buf = await readFile\(path\);[\s\S]*buf = Buffer\.from\(await res\.arrayBuffer\(\)\);/);
  assert.match(src, /content-length/, 'a declared size past the cap is refused before download');
  assert.doesNotMatch(src, /from 'sharp'/, 'one encoder, in image-encode.ts');
  assert.match(read(path.join(CONSOLE, 'src/lib/image-encode.ts')), /\.rotate\(\)/);
});

// ── The components ─────────────────────────────────────────────────────────────

function catalogFiles() {
  const out = [];
  for (const d of readdirSync(CATALOG)) for (const f of readdirSync(path.join(CATALOG, d))) if (f.endsWith('.tsx')) out.push(`${d}/${f}`);
  return out;
}

test('no catalog component paints a client photo as a CSS background', () => {
  const found = [];
  for (const rel of catalogFiles()) {
    const src = read(path.join(CATALOG, rel));
    if (/backgroundImage:\s*`url\(\$\{/.test(src) || /bg-\[url\(/.test(src)) found.push(rel);
  }
  assert.deepEqual(found, [], 'use <CoverImage> (lib/CoverImage.tsx): srcset, priority or lazy, dimensions');
});

test('every <img> in the catalog states its dimensions and how it loads', () => {
  const missing = [];
  for (const rel of catalogFiles()) {
    const src = read(path.join(CATALOG, rel));
    for (let i = src.indexOf('<img'); i >= 0; i = src.indexOf('<img', i + 4)) {
      let j = i, depth = 0;
      for (; j < src.length; j++) { if (src[j] === '{') depth++; else if (src[j] === '}') depth--; else if (src[j] === '>' && depth === 0) break; }
      const tag = src.slice(i, j);
      for (const attr of ['width=', 'height=', 'loading=']) if (!tag.includes(attr)) missing.push(`${rel}: <img> without ${attr}`);
    }
  }
  assert.deepEqual(missing, []);
});

async function render(rel, content, props = {}) {
  const mod = await import(`../src/components/catalog/${rel}`);
  return renderToStaticMarkup(React.createElement(mod.default, { content, ...props }));
}

/** HVAC content after the export localized its photos (`/img/<hash>`). */
function exported() {
  const c = structuredClone(HVAC);
  c.images.hero = { portrait: '/img/aaaaaaaaaaaaaaaa', slides: [{ url: '/img/aaaaaaaaaaaaaaaa', alt: 'Technician at a condenser in Winter Park' }] };
  c.services.items = c.services.items.map((it, i) => ({ ...it, image: { url: `/img/bbbbbbbbbbbbbbb${i}`, alt: it.t } }));
  return c;
}

test('each vertical hero loads its photo first: picture with AVIF and WebP srcsets, high priority, never lazy', async () => {
  for (const v of ['Hvac', 'Lawn', 'Plumbing', 'Roofing', 'Detail']) {
    const html = await render(`hero/${v}Hero.tsx`, exported());
    assert.match(html, /<source type="image\/avif" srcSet="\/img\/aaaaaaaaaaaaaaaa-640\.avif 640w, [^"]*2048\.avif 2048w" sizes="100vw"/, `${v}Hero: no AVIF srcset`);
    assert.match(html, /<source type="image\/webp" srcSet="\/img\/aaaaaaaaaaaaaaaa-640\.webp 640w/, `${v}Hero: no WebP srcset`);
    const img = /<img [^>]*src="\/img\/aaaaaaaaaaaaaaaa-1024\.webp"[^>]*>/.exec(html)?.[0] ?? '';
    assert.match(img, /loading="eager"/, `${v}Hero: the LCP photo must not be lazy`);
    assert.match(img, /fetchPriority="high"|fetchpriority="high"/, `${v}Hero: no fetch priority`);
    assert.match(img, /width="1536"/);
    assert.match(img, /alt="Technician at a condenser in Winter Park"/, `${v}Hero: alt is the photo's own words`);
  }
});

test('photos below the fold load lazily with a srcset (the HVAC service cards)', async () => {
  const html = await render('services/HvacServices.tsx', exported());
  const imgs = html.match(/<img [^>]*>/g) ?? [];
  assert.ok(imgs.length > 0, 'the cards show their photos');
  for (const img of imgs) {
    assert.match(img, /loading="lazy"/);
    assert.doesNotMatch(img, /fetchPriority|fetchpriority/);
  }
  assert.match(html, /<source type="image\/webp" srcSet="\/img\/bbbbbbbbbbbbbbb0-640\.webp 640w/);
  assert.doesNotMatch(html, /image\/avif/, 'no AVIF where the pipeline wrote none (service slots)');
});

test('CoverImage ships to client repos byte-identical', () => {
  assert.equal(read(path.join(OPS, 'template/src/lib/CoverImage.tsx')), read(path.join(CONSOLE, 'src/lib/CoverImage.tsx')));
});

test('a hero photo the client sent without words gets facts for alt text, never a guess at what it shows', async () => {
  for (const v of ['Hvac', 'Lawn', 'Plumbing', 'Roofing', 'Detail']) {
    const c = exported();
    c.images.hero.slides[0].alt = null; // what the intake writes for a general work photo
    c.brand.name = 'Tracewell Heating & Air';
    c.brand.address = '120 Park Ave, Winter Park, FL 32789';
    const html = await render(`hero/${v}Hero.tsx`, c);
    const img = /<img [^>]*src="\/img\/aaaaaaaaaaaaaaaa-1024\.webp"[^>]*>/.exec(html)?.[0] ?? '';
    assert.match(img, /alt="Tracewell Heating &amp; Air in Winter Park"/, `${v}Hero: ${/alt="[^"]*"/.exec(img)?.[0]}`);
  }
});
