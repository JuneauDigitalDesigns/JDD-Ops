import 'server-only';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { clientDir } from './paths';
import { parseExportedPage, type ReadBackEntry, type StudioReadBack } from './readback-parse';

/**
 * Read a client's page composition back OUT of their exported repo.
 *
 * The studio's composition — which component fills each slot, in what order, with which
 * skin — was only ever held in browser localStorage. That made the console unusable as the
 * primary editor: open a client on another machine, or after a cache clear, and the studio
 * showed an empty page for a site that has been live for months.
 *
 * Rather than introduce a third per-client file to keep in sync with the repo (and to drift
 * from it), we read the repo itself. It already IS the source of truth for what the page
 * contains, and wirePage() writes it in a shape deliberately kept "re-wireable on a later
 * export" — anchored comment markers, one component per line.
 *
 * This parser is the exact inverse of wirePage() in export.ts. If you change the emitted
 * shape there, change it here in the same commit or the studio will silently start showing
 * an empty page again.
 *
 * ── SUPERSEDED, for anything multi-page ─────────────────────────────────────
 *
 * This reads ONE file — home's — and returns the flat legacy `{selections, order}` shape,
 * which cannot represent a second page. A four-page client read back through here comes out
 * as a ONE-page composition, and the next export then writes one page and lets
 * pruneStaleRoutes delete `src/app/services`, `/about` and `/contact`.
 *
 * So the exporter now writes `.studio/composition.json` (see composition-manifest.ts) and
 * callers prefer that. This remains the fallback for repos exported before the manifest
 * existed, and for the deploy diff's `git show` baseline, where a historical page.tsx is all
 * there is to read. Prefer `readCompositionManifest` wherever a manifest might exist.
 *
 * NOT recoverable, and accepted: the `vertical` preset the client was started from. It only
 * supplies fallbacks for fields site.ts doesn't define, and site.ts is loaded separately as
 * the real content, so the cost is limited to placeholder imagery in the preview.
 *
 * The parsing itself lives in `readback-parse.ts` — pure, and therefore testable, since
 * `server-only` throws under the tsx test loader.
 */

export { parseExportedPage };
export type { ReadBackEntry, StudioReadBack };

/** Absolute path to the wired page for a client's exported repo. */
export function repoPagePath(slug: string): string {
  return resolve(clientDir(slug), 'repo', 'src', 'app', 'page.tsx');
}

/** True when this client has an exported repo whose page we can read. */
export function hasExportedPage(slug: string): boolean {
  return existsSync(repoPagePath(slug));
}

/**
 * Read + parse one client's exported page from the WORKING TREE, or null when there's
 * nothing to read.
 *
 * Right for seeding the studio — you want to edit the newest local state, exported or not.
 * WRONG as a deploy baseline: the working tree holds unshipped output, so diffing against it
 * compares the studio to itself. The deploy diff reads `git show <ref>:src/app/page.tsx`
 * through parseExportedPage instead (see api/build/diff).
 */
export function readStudioComposition(slug: string): StudioReadBack | null {
  const path = repoPagePath(slug);
  if (!existsSync(path)) return null;
  try {
    return parseExportedPage(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}
