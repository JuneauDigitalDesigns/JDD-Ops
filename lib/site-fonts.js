/**
 * The client site's self-hosted fonts: template/src/lib/fonts.loader.ts and the woff2 files in
 * template/src/lib/fonts/, which onboard.js writes into every client repo on every run.
 *
 * Why onboard.js owns these and not just template/: a client repo is a COPY of the template,
 * taken once by `npm run new-client` or the console's first export. A fix to the template never
 * reaches a repo that already exists. The fonts fix matters precisely for repos that already
 * exist: their loader imports next/font/google, so every Vercel build downloads seven families
 * from Google and fails at random (an extensionless `/l/font` URL crashes Next 14.2's loader on
 * ~5% of responses, and a failed download fails the build). Writing these files on every run is
 * the same contract lib/site-routes has with the API routes: the run that deploys a repo is the
 * run that makes sure it is current.
 *
 * Files are copied byte-for-byte (copyFileSync). The API routes go through readFileSync('utf8'),
 * which would corrupt a woff2.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

export const FONT_LOADER = 'src/lib/fonts.loader.ts';
export const FONT_DIR = 'src/lib/fonts';

/** Repo-relative POSIX paths of everything this module writes, read from the template. */
export function siteFontFiles(templateDir) {
  const dir = resolve(templateDir, FONT_DIR);
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => statSync(join(dir, f)).isFile()).sort() : [];
  return [FONT_LOADER, ...files.map((f) => `${FONT_DIR}/${f}`)];
}

/**
 * The woff2 paths fonts.loader.ts asks next/font/local for, repo-relative. The build fails with
 * module-not-found when one is missing, so the caller checks them before a deploy finds out.
 */
export function loaderFontPaths(loaderSrc) {
  return [...loaderSrc.matchAll(/path:\s*'\.\/([^']+)'/g)].map((m) => `src/lib/${m[1]}`);
}

/** Copy the loader and every font file from the template into the repo. Returns what it wrote. */
export function writeSiteFonts(repoDir, templateDir) {
  const written = [];
  for (const rel of siteFontFiles(templateDir)) {
    const from = resolve(templateDir, rel);
    if (!existsSync(from)) throw new Error(`template is missing ${rel}`);
    const to = resolve(repoDir, rel);
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
    written.push(rel);
  }
  return written;
}

const SOURCE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const SKIP = new Set(['node_modules', '.next', '.git', 'out']);

/**
 * Source files under `<dir>/<under>` (default `src`) that import next/font/google, relative to `dir`.
 *
 * Any one of them puts Google back in the build path: next/font/google fetches at build time
 * whether or not the page uses the font. A catalog component or a hand-edited layout can bring
 * it back after the loader is fixed, so this looks at the whole tree, not just the loader.
 */
export function googleFontImports(dir, { under = 'src' } = {}) {
  const hits = [];
  const walk = (d) => {
    if (!existsSync(d)) return;
    for (const name of readdirSync(d)) {
      if (SKIP.has(name)) continue;
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (SOURCE.test(name) && /from\s+['"]next\/font\/google['"]/.test(readFileSync(p, 'utf8'))) {
        hits.push(relative(dir, p).split(sep).join('/'));
      }
    }
  };
  walk(resolve(dir, under));
  return hits.sort();
}
