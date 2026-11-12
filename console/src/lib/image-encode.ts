// The encode step of the export's image pipeline (image-pipeline.ts), kept apart from it because
// that module is server-only and pulls in the export, while this needs only sharp. The tests
// (console/test/image-performance.test.mjs) drive it with real image bytes.
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

/** The largest file the export will read (Xander 2026-11-11). The agency's upload caps at 10 MB. */
export const MAX_INPUT_BYTES = 25 * 1024 * 1024;
/** The largest image, in pixels, sharp will decode: about 60 megapixels, above any phone camera. */
export const MAX_INPUT_PIXELS = 60_000_000;

/**
 * An SVG logo that is safe to serve as a file from the client's own domain: no script, no event
 * handler, no embedded HTML, no external reference. Shown through <img> a script can't run, but a
 * visitor can open /img/<hash>.svg directly, so anything active is rasterized instead.
 */
export function isPlainSvg(buf: Buffer): boolean {
  const text = buf.subarray(0, 512 * 1024).toString('utf8');
  if (!/^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE[^>]*>\s*)?<svg[\s>]/i.test(text)) return false;
  return !/<script|\son[a-z]+\s*=|<foreignObject|javascript:|(?:xlink:)?href\s*=\s*["']\s*(?:https?:|\/\/|data:)/i.test(text);
}

/**
 * Encode one image into outDir and return what the slot should hold. Exported for the tests, which
 * drive it with real image bytes instead of a network fetch.
 *
 * - Orientation: `.rotate()` applies the EXIF orientation a phone writes, so a portrait shot
 *   never ships sideways.
 * - Metadata: sharp writes none unless asked (no `withMetadata`), so EXIF, GPS and camera data
 *   never reach the site. The test reads the output back to hold this.
 * - Size: refuses past MAX_INPUT_BYTES / MAX_INPUT_PIXELS; never upscales (`withoutEnlargement`).
 * - A logo keeps its transparency (WebP carries alpha), is never cropped or graded, and a plain
 *   SVG logo is served as the SVG itself (`/img/<hash>.svg`, a concrete file imageAt passes through).
 */
export async function writeImage(
  buf: Buffer,
  outDir: string,
  opts: { ratio: number; avif: boolean; logo: boolean; widths: readonly number[] },
): Promise<string> {
  if (buf.length > MAX_INPUT_BYTES) throw new Error('image too large');
  const hash = createHash('sha256').update(buf).digest('hex').slice(0, 16);
  if (opts.logo && isPlainSvg(buf)) {
    await writeFile(join(outDir, `${hash}.svg`), buf);
    return `/img/${hash}.svg`;
  }
  // density: an SVG logo that isn't plain is rasterized sharp enough for a 2x screen.
  const input = () => sharp(buf, { limitInputPixels: MAX_INPUT_PIXELS, density: 300 }).rotate();

  for (const w of opts.widths) {
    // A fresh decode per width keeps each output independent; `withoutEnlargement` means a source
    // smaller than a width is never upscaled (pixels never exceed the source, honouring the plan)
    // while the file is still emitted at every width name so a component srcSet never 404s.
    const base = opts.logo
      // Logo: no crop, no grade, no recolour; bound the long edge to w.
      ? input().resize(w, w, { fit: 'inside', withoutEnlargement: true })
      : input()
          .resize(w, Math.round(w / opts.ratio), { fit: 'cover', position: 'attention', withoutEnlargement: true })
          // ONE fixed grade, two passes (decision 15/55): saturation pull + contrast lift. No tint
          // pass - decision 9 already warms the ground, and a tint on top pushes the page to sepia.
          .modulate({ saturation: 0.88, brightness: 1.02 })
          .linear(1.04, -6);
    await base.clone().webp({ quality: 80 }).toFile(join(outDir, `${hash}-${w}.webp`));
    if (opts.avif) await base.clone().avif({ quality: 55 }).toFile(join(outDir, `${hash}-${w}.avif`));
  }
  return `/img/${hash}`;
}
