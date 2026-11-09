// Every local image a built site asks for, checked against the files the repo actually has.
//
// node:fs + node:path ONLY, so the console tests can load it directly.
//
// `_e2e_test_growth` went live with `background-image:url(/img/bae0a9968302df37)`: the export
// pipeline's localized BASE, which is not a file (the files are `<hash>-<width>.webp`). The build
// passed, the deploy passed, and the hero was a 404. This reads the pages `next build` just wrote
// — exactly what a visitor is served — and lists any `/img/…` address with no file in public/.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** A root-relative `/img/...` address, not part of a longer URL (`https://cdn/img/x` is someone else's). */
const LOCAL_IMG = /(?<![\w.:/-])\/img\/[A-Za-z0-9._-]+/g;

/**
 * Every `/img/...` address in a page's markup — attributes and inline styles, what a browser
 * actually fetches. Script bodies are dropped first: Next inlines component data there (the RSC
 * payload, JSON-LD), and a raw `/img/<hash>` inside data is not a request.
 */
export function localImageRefs(html: string): string[] {
  const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  return [...new Set(markup.match(LOCAL_IMG) ?? [])];
}

function htmlPages(dir: string, out: string[]): void {
  if (!existsSync(dir)) return;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = resolve(dir, e.name);
    if (e.isDirectory()) htmlPages(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
}

export interface MissingImage {
  ref: string;
  /** Built pages that reference it, relative to .next/server/app. */
  pages: string[];
}

/**
 * Local image addresses in the built pages of `repoDir` with no file behind them in public/.
 * `pagesFound` is 0 when there was nothing to read (no build output), which a caller must not
 * treat as a pass.
 */
export function findMissingLocalImages(repoDir: string): { pagesFound: number; missing: MissingImage[] } {
  const appDir = resolve(repoDir, '.next', 'server', 'app');
  const pages: string[] = [];
  htmlPages(appDir, pages);
  const byRef = new Map<string, string[]>();
  for (const page of pages) {
    const rel = page.slice(appDir.length + 1).split('\\').join('/');
    for (const ref of localImageRefs(readFileSync(page, 'utf8'))) {
      if (existsSync(resolve(repoDir, 'public', ...ref.slice(1).split('/')))) continue;
      byRef.set(ref, [...(byRef.get(ref) ?? []), rel]);
    }
  }
  return {
    pagesFound: pages.length,
    missing: [...byRef].map(([ref, ps]) => ({ ref, pages: ps })).sort((a, b) => a.ref.localeCompare(b.ref)),
  };
}
