import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ensureSectionIds, type SiteComposition } from '@/lib/pages';

// Deliberately NOT `import 'server-only'`, even though this module touches the filesystem and
// is only ever used server-side. `server-only` throws under the tsx loader the console's test
// suite runs on, and this file owns the route-pruning logic — the code that DELETES page
// directories. Untestable deletion logic is how three subpages were silently removed from a
// live client. The pure-module-plus-server-wrapper split used for readback-parse.ts isn't
// available here: every function needs disk access. So the guard is traded for coverage, and
// the only importer is export.ts, which is server-only itself.

/**
 * The client repo's record of WHAT ITS SITE IS MADE OF — the whole SiteComposition, written
 * by the exporter and committed alongside the pages it generated.
 *
 * ## Why this file exists
 *
 * The composition used to be recoverable only by regex-parsing `src/app/page.tsx` back into a
 * studio state (`studio-readback.ts`). That parser is structurally incapable of describing a
 * multi-page site: it reads ONE file, home's, and returns the flat legacy
 * `{selections, order}` shape, which has no concept of a second page. So every time a
 * four-page client was reopened, the studio rebuilt its composition as a ONE-page site — and
 * the next export then wrote one page file and had `pruneStaleRoutes` DELETE
 * `src/app/services`, `/about` and `/contact`. A four-page site silently became a one-page
 * site, and the operator's only clue was the live URL.
 *
 * Reading a manifest the exporter itself wrote removes the inference entirely. The exporter no
 * longer has to guess what it did last time; it is told.
 *
 * ## Why in the repo, and committed
 *
 * The repo is already the source of truth for what the site contains, and keeping this beside
 * the pages it describes means the two travel together: clone the repo on another machine, or
 * after a cache clear, and the studio still opens the real site. That was the original reason
 * the page parser existed at all — this serves the same goal without the lossy round trip.
 *
 * `.studio/` is not in the template's `.gitignore`, deliberately: an ignored manifest would be
 * absent on exactly the fresh-clone path it exists to serve.
 *
 * ## Compatibility
 *
 * `version` is checked on read. A manifest from a FUTURE version is treated as unreadable
 * rather than parsed optimistically — a newer console writing a shape this one would
 * misinterpret should fall back to the page parser, not silently drop whatever it didn't
 * understand. Repos that predate the manifest simply have none, and the caller falls back.
 */
const MANIFEST_VERSION = 1;

type Manifest = {
  version: number;
  /** ISO timestamp of the export that wrote it. Diagnostic only; never read back as state. */
  writtenAt: string;
  composition: SiteComposition;
};

/** `.studio/composition.json` inside a client repo. */
export function manifestPath(repoDir: string): string {
  return resolve(repoDir, '.studio', 'composition.json');
}

/** The pre-manifest state file: a bare array of non-home routes, used only for pruning. */
export function legacyRoutesPath(repoDir: string): string {
  return resolve(repoDir, '.studio-pages.json');
}

/** Write the manifest, creating `.studio/` as needed. Called by the exporter after it has
 *  generated every page file, so a failed export leaves the previous manifest intact. */
export function writeCompositionManifest(repoDir: string, composition: SiteComposition): void {
  const manifest: Manifest = {
    version: MANIFEST_VERSION,
    writtenAt: new Date().toISOString(),
    composition,
  };
  mkdirSync(resolve(repoDir, '.studio'), { recursive: true });
  writeFileSync(manifestPath(repoDir), JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  // Supersede the pre-manifest state file rather than leaving it to rot beside its
  // replacement, where the next reader has to work out which one is authoritative.
  rmSync(legacyRoutesPath(repoDir), { force: true });
}

/**
 * Read the manifest, or null when there isn't a usable one (absent, unparseable, wrong
 * version, or structurally not a composition).
 *
 * Every failure collapses to null on purpose: the caller's fallback is the page parser, which
 * is lossy but safe, and that is a far better outcome than throwing on a corrupt file and
 * taking the whole Studio page down with it.
 *
 * `ensureSectionIds` runs on the way out so sections always carry the stable ids that
 * `sectionStyles` keys off, exactly as the bundle-hydration path guarantees.
 */
export function readCompositionManifest(repoDir: string): SiteComposition | null {
  const path = manifestPath(repoDir);
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return null;
    const m = parsed as Partial<Manifest>;
    if (m.version !== MANIFEST_VERSION) return null;
    const comp = m.composition;
    // Shape guard, not a full validation: the exporter validates before it writes, and
    // validateComposition runs again on the way back out. This only has to be sure we are
    // holding a composition rather than some other JSON.
    if (
      typeof comp !== 'object' ||
      comp === null ||
      !Array.isArray(comp.pages) ||
      comp.pages.length === 0 ||
      typeof comp.chrome !== 'object' ||
      comp.chrome === null
    ) {
      return null;
    }
    return ensureSectionIds(comp);
  } catch {
    return null;
  }
}

/**
 * The non-home routes a previous export generated, for pruning.
 *
 * Prefers the manifest; falls back to the legacy `.studio-pages.json` so the FIRST export
 * after this change still prunes the routes the previous one created. Without that fallback,
 * a client dropping a page in the same export that introduces the manifest would keep the
 * dropped page's directory on disk — and Next would keep serving it.
 */
export function previousRoutes(repoDir: string): string[] {
  const comp = readCompositionManifest(repoDir);
  if (comp) return comp.pages.map((p) => p.route).filter((r) => r !== '');

  const legacy = legacyRoutesPath(repoDir);
  if (!existsSync(legacy)) return [];
  try {
    const parsed = JSON.parse(readFileSync(legacy, 'utf8')) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((r): r is string => typeof r === 'string' && r !== '');
  } catch {
    return [];
  }
}

/**
 * Delete `src/app/<route>/` for any route a previous export generated that this composition no
 * longer has, then record the new composition.
 *
 * ── Read this before changing it ────────────────────────────────────────────
 *
 * This function DELETES DIRECTORIES from a client's repo, and it used to be driven by a
 * composition that had been *inferred* from a regex parse of home's page.tsx. When that
 * inference collapsed a four-page site into one page — which it did on every single reopen,
 * because the legacy shape it parses into cannot hold a second page — this is the code that
 * removed the other three. The site went from four routes to one, every subpage 404'd, and
 * nothing reported an error.
 *
 * Two invariants hold it together now:
 *   • The prior route list comes from the manifest the exporter itself wrote, never from an
 *     inference about what it wrote.
 *   • Home (`route === ''`) is never prunable: its route resolves to `src/app`, and deleting
 *     that removes the entire application.
 */
export function reconcileRoutes(repoDir: string, comp: SiteComposition): { pruned: string[] } {
  const current = new Set(comp.pages.map((p) => p.route).filter((r) => r !== ''));
  const pruned: string[] = [];

  for (const route of previousRoutes(repoDir)) {
    // The `!route` guard is load-bearing, not defensive noise: '' would resolve to src/app.
    if (!route || current.has(route)) continue;
    try {
      rmSync(resolve(repoDir, 'src', 'app', ...route.split('/')), { recursive: true, force: true });
      pruned.push(route);
    } catch {
      /* best-effort cleanup */
    }
  }

  // After the prune, so a failure above leaves the PREVIOUS manifest in place and the next
  // export tries the same reconciliation again rather than forgetting the orphaned route.
  writeCompositionManifest(repoDir, comp);
  return { pruned };
}
