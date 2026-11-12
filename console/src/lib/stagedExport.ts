/**
 * An export that fails never leaves the client's repo half-written (Xander 2026-11-12: "let's make
 * sure that that never happens").
 *
 * What happened: clients/_e2e_test_growth/repo after the 2026-11-11 22:13 export. It failed partway,
 * after copying the template (site.ts reverted to the template's) and the uploaded photos, and the
 * repo was left that way: neither the old site nor the new one.
 *
 * So the export works on a staged copy, never on the repo:
 * - `beginStagedExport` copies the repo (without node_modules and .next) to a sibling folder,
 *   clients/<slug>/.repo-staging-<time>, and points `repoDirFor` at it for this slug. Every write
 *   the export makes (template, components, site.ts, images, the composition manifest, routes),
 *   the install and the build land there.
 * - `commit` runs only once install, build and checks have passed: it swaps the staged tree in by
 *   renaming folders (same volume, so it is one step), then deletes the old tree. If the rename
 *   fails (a program holding files open), the old repo is put back and nothing changed.
 * - `abort` (any failure, any early return) deletes the staging folder. The repo is untouched,
 *   byte for byte, and the draft is kept: only a successful export deletes it.
 * Links inside a folder are cut before it is deleted (house rule: a recursive delete must never
 * follow a junction into another checkout).
 *
 * No `server-only` here, so the tests can drive it on a temp folder; lib/export.ts imports it.
 */
import { cpSync, existsSync, lstatSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { basename, resolve } from 'node:path';

/** Slugs with an export in progress, and where their repo is staged. Read by `repoDirFor`. */
const staged = new Map<string, string>();

/** The staged repo for this slug while an export runs, else undefined. */
export function stagedRepoDir(slug: string): string | undefined {
  return staged.get(slug);
}

/** Never copied into the staging folder: rebuilt there by the export's own install and build. */
const NOT_STAGED = new Set(['node_modules', '.next']);

/** Remove every symlink or junction under `dir` (the link only, never its target). */
export function cutLinks(dir: string): void {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const p = resolve(dir, name);
    let st;
    try { st = lstatSync(p); } catch { continue; }
    if (st.isSymbolicLink()) rmSync(p, { force: true }); // the link itself, not what it points at
    else if (st.isDirectory()) cutLinks(p);
  }
}

/** Delete a folder this module made, links cut first. */
export function removeTree(dir: string): void {
  if (!existsSync(dir)) return;
  cutLinks(dir);
  rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
}

export interface StagedExport {
  /** Where the export writes: the staged copy. */
  readonly stagingDir: string;
  /** The client's real repo. */
  readonly liveDir: string;
  /** Whether the real repo existed when the export began. */
  readonly existed: boolean;
  /** True once committed or aborted. */
  readonly done: boolean;
  /** Swap the staged tree in. Only after install, build and every check have passed. */
  commit(): void;
  /** Throw the staged tree away; the repo stays as it was. Safe to call more than once. */
  abort(): void;
}

export function beginStagedExport(repoRoot: string, slug: string): StagedExport {
  if (staged.has(slug)) throw new Error(`An export for ${slug} is already running. Wait for it to finish, then try again.`);
  const clientDir = resolve(repoRoot, 'clients', slug);
  const liveDir = resolve(clientDir, 'repo');
  // Leftovers from a run the console itself was stopped in the middle of.
  if (existsSync(clientDir)) {
    for (const name of readdirSync(clientDir)) {
      if (/^\.repo-(staging|old)-\d+$/.test(name)) removeTree(resolve(clientDir, name));
    }
  }
  const stamp = Date.now();
  const stagingDir = resolve(clientDir, `.repo-staging-${stamp}`);
  const existed = existsSync(liveDir);
  if (existed) {
    cpSync(liveDir, stagingDir, {
      recursive: true,
      verbatimSymlinks: true,
      filter: (src) => !NOT_STAGED.has(basename(src)),
    });
  }
  staged.set(slug, stagingDir);

  let done = false;
  return {
    stagingDir,
    liveDir,
    existed,
    get done() { return done; },
    commit() {
      if (done) return;
      staged.delete(slug);
      done = true;
      if (!existsSync(stagingDir)) throw new Error('The staged site is missing, so nothing was changed.');
      if (!existsSync(liveDir)) { renameSync(stagingDir, liveDir); return; }
      const oldDir = resolve(clientDir, `.repo-old-${stamp}`);
      try {
        renameSync(liveDir, oldDir);
      } catch (e) {
        removeTree(stagingDir);
        throw new Error(`Couldn't swap in the new site: a program has files in clients/${slug}/repo open (${(e as Error).message}). Close it and export again. Nothing was changed.`);
      }
      try {
        renameSync(stagingDir, liveDir);
      } catch (e) {
        renameSync(oldDir, liveDir); // put the old repo back exactly as it was
        removeTree(stagingDir);
        throw new Error(`Couldn't swap in the new site (${(e as Error).message}). Nothing was changed.`);
      }
      removeTree(oldDir);
    },
    abort() {
      staged.delete(slug);
      if (done) return;
      done = true;
      removeTree(stagingDir);
    },
  };
}
