/**
 * The site-wide pieces every client's `src/app/layout.tsx` must mount, added to a layout that
 * lacks them without touching anything else in it.
 *
 * Why this exists: a client repo's layout.tsx is copied from the template ONCE, when the repo is
 * created, and nothing refreshes it. It can't be template-owned, because it is where a client's own
 * things live (fonts, metadata, analytics like <SpeedInsights />; the reference client lost those
 * once to a blanket copy). So a repo created before the template mounted Lenis (`96dd76a`, Phase 6)
 * never got smooth scrolling or the mobile sticky call bar: `_e2e_test_growth` went live on
 * 2026-11-09 with `src/lib/SmoothScroll.tsx` and `lenis` installed and neither mounted.
 *
 * The rule: each piece is added only when missing, exactly as template/src/app/layout.tsx mounts
 * it, after `{children}`. A layout this can't place them in safely is reported, never guessed at.
 * Two callers, one implementation: onboard.js (step 3b, every run) and the console export.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const LAYOUT_FILE = 'src/app/layout.tsx';

/** What each piece needs in the repo's template-owned src/lib before a layout may import it. */
export const LAYOUT_LIB_FILES = ['src/lib/SmoothScroll.tsx', 'src/lib/StickyCallBar.tsx'];

const IMPORT_LINE = /^import\s[^;]*;\s*$/;

/**
 * `src` with any missing piece added, plus the names added. `{ error }` when the layout's shape
 * gives no single safe place to put them.
 */
export function ensureLayoutMounts(src) {
  const hasSmooth = /<SmoothScroll\b/.test(src);
  const hasBar = /<StickyCallBar\b/.test(src);
  if (hasSmooth && hasBar) return { src, added: [] };

  const nl = src.includes('\r\n') ? '\r\n' : '\n';
  const lines = src.split(/\r?\n/);
  const childrenAt = lines.flatMap((l, i) => (/^\s*\{children\}\s*$/.test(l) ? [i] : []));
  if (childrenAt.length !== 1) {
    return { error: `${LAYOUT_FILE} has ${childrenAt.length === 0 ? 'no' : 'more than one'} line that is just {children}, so there is no single place to mount the site-wide pieces.` };
  }
  let lastImport = -1;
  for (let i = 0; i < lines.length; i += 1) if (IMPORT_LINE.test(lines[i])) lastImport = i;
  if (lastImport < 0) return { error: `${LAYOUT_FILE} has no import lines to add to.` };

  const imports = [];
  const decls = [];
  const jsx = [];
  const added = [];
  const indent = /^\s*/.exec(lines[childrenAt[0]])[0];

  if (!hasSmooth) {
    // The template's own form: next/dynamic with ssr:false keeps Lenis out of the first paint.
    // A layout may already import next/dynamic, or export `dynamic` as route config, so the
    // binding is reused when present and otherwise given a name that can't collide.
    const existing = /^import\s+(\w+)\s+from\s+'next\/dynamic';/m.exec(src)?.[1];
    const loader = existing ?? 'nextDynamic';
    if (!existing) imports.push(`import nextDynamic from 'next/dynamic';`);
    decls.push(`const SmoothScroll = ${loader}(() => import('@/lib/SmoothScroll'), { ssr: false });`);
    jsx.push(`${indent}<SmoothScroll />`);
    added.push('SmoothScroll');
  }
  if (!hasBar) {
    imports.push(`import StickyCallBar from '@/lib/StickyCallBar';`);
    if (!/import\s*\{[^}]*\bCONTENT\b[^}]*\}\s*from\s*'@\/data\/site'/.test(src)) {
      imports.push(`import { CONTENT } from '@/data/site';`);
    }
    jsx.push(
      `${indent}<StickyCallBar phone={CONTENT.brand.phone} phoneHref={CONTENT.brand.phoneHref} assurance={null} badge={null} />`,
    );
    added.push('StickyCallBar');
  }

  const out = [...lines];
  out.splice(childrenAt[0] + 1, 0, ...jsx);
  out.splice(lastImport + 1, 0, ...imports, ...(decls.length ? ['', ...decls] : []));
  return { src: out.join(nl), added };
}

/**
 * Apply ensureLayoutMounts to a repo on disk. Returns `{ added }`, or `{ error }` without writing
 * anything when the layout can't be placed safely or the repo lacks the lib files it would import.
 */
export function ensureSiteLayout(repoDir, { write = true } = {}) {
  const file = resolve(repoDir, LAYOUT_FILE);
  if (!existsSync(file)) return { added: [], error: `${LAYOUT_FILE} is missing.` };
  const result = ensureLayoutMounts(readFileSync(file, 'utf8'));
  if (result.error) return { added: [], error: result.error };
  if (result.added.length === 0) return { added: [] };
  const missingLib = LAYOUT_LIB_FILES.filter((f) => !existsSync(resolve(repoDir, f)));
  if (missingLib.length) {
    return { added: [], error: `${missingLib.join(' and ')} ${missingLib.length === 1 ? 'is' : 'are'} missing, so ${LAYOUT_FILE} can't mount them. They come from template/src/lib.` };
  }
  if (write) writeFileSync(file, result.src, 'utf8');
  return { added: result.added };
}
