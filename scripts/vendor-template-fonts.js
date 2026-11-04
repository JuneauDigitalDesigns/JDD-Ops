#!/usr/bin/env node
/**
 * vendor-template-fonts.js — download the template's Google fonts ONCE, into the repo.
 *
 * Usage: node scripts/vendor-template-fonts.js [--check]
 *
 * Why this exists: the template used to load its seven families through `next/font/google`,
 * which downloads every declared family from Google during `next build` — on Vercel, for every
 * client deploy, whether or not the brand uses the font. That made every client build depend on
 * Google twice over:
 *   1. ~5% of Google Fonts CSS responses (measured 2026-11-03) list a file as
 *      `fonts.gstatic.com/l/font?kit=…` with no extension. Next 14.2's loader crashes on those
 *      (`Cannot read properties of null (reading '1')`). Seven families meant a large share of
 *      builds rolled that die. JDD-Ops #16 patched the console; the template had no patch.
 *   2. A download that fails at build time fails the build. That is what broke an agency
 *      production build on 2026-11-04 (module-not-found on the Hanken Grotesk CSS).
 * So the files now live in template/src/lib/fonts/ and fonts.loader.ts loads them with
 * `next/font/local`. A build reads them from disk and never touches the network.
 *
 * This script is how the files got there, and how to add a family or a weight: edit FAMILIES,
 * run it, then add the matching `localFont` entry to template/src/lib/fonts.loader.ts (next/font
 * needs literal arguments, so the loader cannot read this list). The root suite
 * (test/template-fonts.test.mjs) fails if the loader names a file that is missing or not woff2.
 *
 * It requests the CSS the way next/font/google does (a Chrome user agent, so Google answers with
 * woff2) and keeps only the `latin` subset, which is what the loader asked for before. An
 * extensionless `/l/font` URL is accepted only when its bytes start with the woff2 magic `wOF2`.
 *
 * `--check` downloads nothing to disk and reports whether the committed files match what Google
 * serves now. A mismatch is not a bug (Google re-releases fonts); it is a decision to re-vendor.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const FONT_DIR = resolve(ROOT, 'template/src/lib/fonts');

/** family: Google's name. file: our basename. license: the google/fonts repo path of its OFL. */
export const FAMILIES = [
  { family: 'Instrument Sans', file: 'instrument-sans', weights: ['400', '700'], license: 'ofl/instrumentsans' },
  { family: 'Schibsted Grotesk', file: 'schibsted-grotesk', weights: ['400', '800'], license: 'ofl/schibstedgrotesk' },
  { family: 'Bricolage Grotesque', file: 'bricolage-grotesque', weights: ['400', '800'], license: 'ofl/bricolagegrotesque' },
  { family: 'Figtree', file: 'figtree', weights: ['400', '800'], license: 'ofl/figtree' },
  { family: 'Archivo', file: 'archivo', weights: ['500', '800'], license: 'ofl/archivo' },
  { family: 'Oswald', file: 'oswald', weights: ['600', '700'], license: 'ofl/oswald' },
  { family: 'Inter', file: 'inter', weights: ['400', '600', '700'], license: 'ofl/inter' },
];

// The user agent next/font/google sends, so Google serves the same woff2 a build would have got.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36';

async function get(url, as) {
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return as === 'text' ? res.text() : Buffer.from(await res.arrayBuffer());
}

/** The latin-subset woff2 URL per weight, from one css2 response. */
export function latinUrls(css) {
  const out = {};
  // Each block is preceded by a `/* subset */` comment.
  for (const m of css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g)) {
    if (m[1] !== 'latin') continue;
    const weight = /font-weight:\s*(\d+)/.exec(m[2])?.[1];
    const url = /src:\s*url\(([^)]+)\)/.exec(m[2])?.[1];
    if (weight && url) out[weight] = url;
  }
  return out;
}

async function main() {
  const check = process.argv.includes('--check');
  mkdirSync(FONT_DIR, { recursive: true });
  let drift = 0;
  const licenses = [];
  for (const f of FAMILIES) {
    const q = `${f.family.replace(/ /g, '+')}:wght@${f.weights.join(';')}`;
    const css = await get(`https://fonts.googleapis.com/css2?family=${q}&display=swap`, 'text');
    const urls = latinUrls(css);
    for (const w of f.weights) {
      if (!urls[w]) throw new Error(`${f.family} ${w}: no latin @font-face in Google's CSS`);
    }
    // Google serves these families as ONE variable file per subset and lists it once per
    // requested weight, so the weights usually share a URL. Write one file per distinct URL:
    // `{file}.woff2` when they all share it, `{file}-{weights}.woff2` for a static family.
    const distinct = [...new Set(f.weights.map((w) => urls[w]))];
    for (const url of distinct) {
      const ws = f.weights.filter((w) => urls[w] === url);
      const name = distinct.length === 1 ? `${f.file}.woff2` : `${f.file}-${ws.join('-')}.woff2`;
      const bytes = await get(url);
      if (bytes.subarray(0, 4).toString('latin1') !== 'wOF2') {
        throw new Error(`${f.family} ${ws.join('/')}: ${url} is not woff2`);
      }
      const dest = resolve(FONT_DIR, name);
      const sha = (b) => createHash('sha256').update(b).digest('hex').slice(0, 12);
      if (check) {
        const same = existsSync(dest) && sha(readFileSync(dest)) === sha(bytes);
        if (!same) drift++;
        console.log(`  ${same ? 'same   ' : 'CHANGED'} ${name}`);
      } else {
        writeFileSync(dest, bytes);
        console.log(`  wrote ${name} (weights ${ws.join(', ')}; ${bytes.length.toLocaleString()} bytes, ${sha(bytes)})`);
      }
    }
    if (!check) {
      const ofl = await get(`https://raw.githubusercontent.com/google/fonts/main/${f.license}/OFL.txt`, 'text');
      licenses.push(`${'='.repeat(78)}\n${f.family} (${f.file}*.woff2)\n${'='.repeat(78)}\n\n${ofl.trim()}\n`);
    }
  }
  if (!check) {
    writeFileSync(
      resolve(FONT_DIR, 'LICENSES.txt'),
      'Every font in this folder is licensed under the SIL Open Font License 1.1, reproduced below\n' +
        'per family with its copyright notice. Fetched by jdd-ops/scripts/vendor-template-fonts.js.\n\n' +
        licenses.join('\n'),
    );
    console.log('  wrote LICENSES.txt');
  }
  if (check && drift) {
    console.log(`\n${drift} file(s) differ from what Google serves now. Re-run without --check to re-vendor.`);
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(`vendor-template-fonts: ${e.message}`);
    process.exit(1);
  });
}
