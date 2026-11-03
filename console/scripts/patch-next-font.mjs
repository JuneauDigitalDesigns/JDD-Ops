#!/usr/bin/env node
/**
 * Backport Next 16's fix for extensionless Google Fonts URLs into the installed Next 14.
 *
 * Why this exists: about 5% of Google Fonts CSS responses (measured 2026-11-03, 5 of 100) list
 * font files as `https://fonts.gstatic.com/l/font?kit=…` instead of `…/xyz.woff2`. Next 14.2's
 * loader names the emitted file with
 *     /\.(woff|woff2|eot|ttf|otf)$/.exec(googleFontFileUrl)[1]
 * which throws `Cannot read properties of null (reading '1')` on those URLs. The console loads
 * seven families, so roughly every other `next build` failed in `next/font`. It hit Archivo on
 * Windows and Oswald in CI the same afternoon. Next 15.5 still has the bug. Next 16 fixed it in
 * find-font-files-in-css.js by reading the pathname, then the CSS format hint, then defaulting
 * to woff2. The bytes behind an /l/font URL are woff2 (they start with `wOF2`), because Next
 * fetches the CSS with a Chrome user agent.
 *
 * The extension only names the file emitted to .next/static/media; the content is unchanged.
 *
 * Usage:
 *   node scripts/patch-next-font.mjs   # runs as `postinstall`; idempotent
 *
 * Exits 1 when the loader has neither the original line nor the patched one. That means Next
 * changed underneath this script: check whether the new version handles /l/font URLs itself
 * (16 does) and delete this script and the postinstall rather than re-targeting it.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ORIGINAL = 'const ext = /\\.(woff|woff2|eot|ttf|otf)$/.exec(googleFontFileUrl)[1];';
export const PATCHED =
  "const ext = (/\\.(woff|woff2|eot|ttf|otf)$/.exec(googleFontFileUrl.split(/[?#]/, 1)[0]) || [, 'woff2'])[1]; /* jdd: patch-next-font.mjs */";

export const LOADER = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../node_modules/next/dist/compiled/@next/font/dist/google/loader.js',
);

/** 'patched' | 'already' | 'unknown' — the source is returned patched only for 'patched'. */
export function patchSource(src) {
  if (src.includes(PATCHED)) return { state: 'already', src };
  if (!src.includes(ORIGINAL)) return { state: 'unknown', src };
  return { state: 'patched', src: src.replace(ORIGINAL, PATCHED) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { state, src } = patchSource(readFileSync(LOADER, 'utf8'));
  if (state === 'unknown') {
    console.error(`patch-next-font: the expected line is not in ${LOADER}. See this script's header.`);
    process.exit(1);
  }
  if (state === 'patched') writeFileSync(LOADER, src);
  console.log(`patch-next-font: ${state === 'patched' ? 'patched' : 'already patched'} next/font google loader`);
}
