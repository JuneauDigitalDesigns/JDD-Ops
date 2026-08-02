import 'server-only';
import { execFile } from 'node:child_process';

/**
 * Every git question the deploy path asks, in one place.
 *
 * The console deploys by writing a client repo, committing, and pushing — so "what is
 * actually live?" is a git question, not a filesystem one. Answering it from the working
 * tree is what produced the bug this module exists to kill: a failed export left 33 modified
 * files on disk, the studio matched those files, and the deploy dialog concluded the site was
 * up to date while Vercel served a three-week-old build.
 *
 * Two rules hold throughout:
 *   • READ-ONLY on the working tree. Baselines come from `git show <ref>:<path>`. Never
 *     stash, never check out — the operator's uncommitted work must survive untouched.
 *   • NEVER assume a branch name. Client repos vary: `_e2e_test_growth` is on `master` with
 *     only `origin/master`, `_e2e-starter` is on `feat/manage-redesign`, and onboard.js
 *     pushes `HEAD:main`. All three shapes are real.
 */

/** Kill a `git fetch` that outlives this — the dialog opens often and must not hang on it. */
const FETCH_TIMEOUT_MS = 4000;

/**
 * Compare two filesystem paths for identity.
 *
 * git reports forward slashes even on Windows while Node hands back backslashes, and drive
 * letters differ in case between the two — so a raw string compare would fail on every
 * Windows repo and silently disable the containment check below. Normalise both sides.
 */
function samePath(a: string, b: string): boolean {
  const norm = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  return norm(a) === norm(b);
}

export interface GitResult {
  code: number;
  stdout: string;
  stderr: string;
  /** True when the process was killed for exceeding its timeout. */
  timedOut: boolean;
}

/**
 * Run one git command. No shell, so nothing here needs quoting or escaping, and a path or
 * branch containing spaces can't turn into two arguments.
 *
 * `GIT_TERMINAL_PROMPT=0` is the difference between a deploy that fails in seconds and one that
 * hangs forever: a push to a remote git can't authenticate otherwise blocks on a username prompt
 * that nothing on this side can answer, and the NDJSON stream just stops mid-flight.
 * `GIT_OPTIONAL_LOCKS=0` keeps the read-only calls (status, rev-list) from taking the index lock,
 * so opening the deploy dialog can't collide with a build running in the same repo.
 */
function git(
  repoDir: string,
  args: string[],
  opts?: { timeout?: number; env?: NodeJS.ProcessEnv },
): Promise<GitResult> {
  return new Promise((resolve) => {
    const child = execFile(
      'git',
      args,
      {
        cwd: repoDir,
        timeout: opts?.timeout,
        maxBuffer: 10 * 1024 * 1024,
        windowsHide: true,
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: '0',
          GIT_OPTIONAL_LOCKS: '0',
          ...opts?.env,
        },
      },
      (err, stdout, stderr) => {
        // execFile's error carries `killed`/`signal` when it enforced the timeout, but the
        // callback's declared type doesn't include them — hence the narrow cast.
        const e = err as (Error & { killed?: boolean; signal?: string; code?: number }) | null;
        const timedOut = Boolean(e?.killed || e?.signal);
        resolve({
          code: e ? (typeof e.code === 'number' ? e.code : 1) : 0,
          stdout: stdout.toString(),
          stderr: stderr.toString(),
          timedOut,
        });
      },
    );
    // execFile already rejects on spawn failure; this guard keeps a missing git binary from
    // becoming an unhandled rejection.
    child.on('error', () => resolve({ code: 1, stdout: '', stderr: '', timedOut: false }));
  });
}

/**
 * The same primitive, for callers outside this module — specifically the export route's commit
 * and push.
 *
 * It exists because the export route was running git through `spawn(…, { shell: true })`, which
 * on Windows joins argv with spaces and hands the result to cmd.exe with NO quoting. A multi-line
 * commit message passed as one argument arrived as eight, everything after the first newline
 * discarded, so `git commit -m <message>` became `git commit -m studio:` followed by a list of
 * bogus pathspecs — every deploy failed at the commit. `shell: true` is genuinely required for
 * npm on Windows (npm is npm.cmd); it is never required for git, which is a real .exe. So git
 * goes through here and npm stays behind its own runner.
 */
export function runGit(
  repoDir: string,
  args: string[],
  opts?: { timeout?: number; env?: NodeJS.ProcessEnv },
): Promise<GitResult> {
  return git(repoDir, args, opts);
}

/** Why a repo can't be deployed from. Null reason = it can. */
export type DeployBlocker =
  /** No repo directory, or it isn't under git at all. */
  | 'no-repo'
  /**
   * The directory is inside an ANCESTOR git repo rather than being its own. Deploying would
   * operate on that ancestor — for a client under jdd-ops/clients/, that is the OPS repo.
   */
  | 'not-own-repo'
  /** Its own repo, but no `origin` to push to. */
  | 'no-remote';

export interface DeployTarget {
  /** The local branch HEAD is on. */
  branch: string;
  /** Remote-tracking ref to compare against, e.g. `origin/master`. Null when never pushed. */
  remoteRef: string | null;
  /** The remote branch name to push to, e.g. `master`. */
  remoteBranch: string;
  /** True when the branch has no configured upstream, so the push must set one (-u). */
  needsUpstream: boolean;
  /** False when the repo has no `origin` at all — there is nowhere to deploy. */
  hasRemote: boolean;
  /** Set when this repo must NOT be deployed from. Callers must refuse when non-null. */
  blocker: DeployBlocker | null;
  /** `git rev-parse --show-toplevel`, for error messages that name what was actually found. */
  toplevel: string | null;
  /**
   * The remote's default branch — what GitHub serves and what Vercel builds as PRODUCTION.
   * Null when neither `origin/HEAD` nor the remote itself will say.
   */
  defaultBranch: string | null;
  /** Which rule below chose `remoteBranch`, so the dialog can name the choice instead of
   *  silently asserting a branch. */
  resolvedBy: DeployResolution;
}

export type DeployResolution =
  | 'upstream'
  | 'remote-default'
  | 'sole-remote'
  | 'local-name'
  | 'unpushed'
  /** No usable target — the repo is blocked, so nothing was resolved. */
  | 'none';

/**
 * The remote's default branch.
 *
 * Asked locally first: `origin/HEAD` is a symref written at clone time, so it costs nothing.
 * It is also never refreshed, so it can name a branch that has since been renamed or deleted —
 * hence the caller validates the answer against the real remote-tracking refs before trusting it,
 * and the `ls-remote` fallback (on a short leash) covers repos cloned before the symref existed.
 *
 * Never throws; a null answer just means the caller falls through to the next tier.
 */
async function remoteDefaultBranch(repoDir: string): Promise<string | null> {
  const symref = await git(repoDir, ['symbolic-ref', '--quiet', 'refs/remotes/origin/HEAD']);
  if (symref.code === 0) {
    const name = symref.stdout.trim().replace(/^refs\/remotes\/origin\//, '');
    if (name) return name;
  }

  const ls = await git(repoDir, ['ls-remote', '--symref', 'origin', 'HEAD'], {
    timeout: FETCH_TIMEOUT_MS,
  });
  if (ls.code !== 0) return null;
  // "ref: refs/heads/main\tHEAD"
  const m = /^ref:\s+refs\/heads\/(\S+)\s+HEAD$/m.exec(ls.stdout);
  return m ? m[1] : null;
}

/**
 * Work out what this repo deploys to.
 *
 * Deliberately tiered rather than reading a config value, because provisioned repos disagree
 * with each other about branch naming and none of them is wrong:
 *   1. A configured upstream is the operator's own answer — always wins.
 *   2. The remote's DEFAULT branch, because that is the one Vercel builds as production.
 *   3. Exactly one `origin/*` branch is unambiguous even without tracking configured, which
 *      is the state onboard.js leaves behind (it pushes without -u).
 *   4. Otherwise prefer the remote branch matching the local name.
 *   5. Nothing pushed under this name yet; the push will create it.
 *
 * Tier 2 is the fix for a silent, total failure. `_e2e_test_growth` sits on local `master` with
 * no upstream and BOTH `origin/main` and `origin/master` present. Matching on the local name
 * (tier 4, which used to be tier 2) picked `origin/master` — so Deploy pushed successfully,
 * reported success, and production never moved, because GitHub's default branch (and therefore
 * Vercel's production branch) is `main`. It also made the diff baseline `origin/master`, which
 * was identical to HEAD, so the dialog cheerfully reported almost nothing to ship.
 *
 * Returns null when the directory isn't a git repo at all.
 */
export async function resolveDeployTarget(repoDir: string): Promise<DeployTarget | null> {
  const inside = await git(repoDir, ['rev-parse', '--is-inside-work-tree']);
  if (inside.code !== 0 || inside.stdout.trim() !== 'true') return null;

  const branchRes = await git(repoDir, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const branch = branchRes.stdout.trim() || 'HEAD';

  /**
   * CONTAINMENT CHECK — the most important line in this file.
   *
   * `--is-inside-work-tree` is true for any directory inside ANY ancestor repo, so a client
   * folder that was never `git init`ed resolves to whatever repo encloses it. For
   * clients/<slug>/repo that ancestor is jdd-ops itself: the OPS repo, which holds master
   * credentials and provisioning scripts. Without this check, Deploy on such a client would
   * run `git add -A && git commit && git push` against the ops repo and ship every unrelated
   * in-progress file under a "studio: update <brand>" message.
   *
   * Two of four client repos are in exactly this state today (no own .git), so this is a
   * live hazard, not a theoretical one. Anything but an exact match is refused.
   */
  const top = await git(repoDir, ['rev-parse', '--show-toplevel']);
  const toplevel = top.code === 0 ? top.stdout.trim() : null;
  if (!toplevel || !samePath(toplevel, repoDir)) {
    return {
      branch,
      remoteRef: null,
      remoteBranch: branch,
      needsUpstream: true,
      hasRemote: false,
      blocker: 'not-own-repo',
      toplevel,
      defaultBranch: null,
      resolvedBy: 'none',
    };
  }

  const remotes = await git(repoDir, ['remote']);
  const hasRemote = remotes.stdout.split(/\r?\n/).some((r) => r.trim() === 'origin');
  if (!hasRemote) {
    return {
      branch,
      remoteRef: null,
      remoteBranch: branch,
      needsUpstream: true,
      hasRemote: false,
      blocker: 'no-remote',
      toplevel,
      defaultBranch: null,
      resolvedBy: 'none',
    };
  }

  const defaultBranch = await remoteDefaultBranch(repoDir);

  // 1. Configured upstream — the operator's own answer.
  const upstream = await git(repoDir, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
  if (upstream.code === 0 && upstream.stdout.trim()) {
    const remoteRef = upstream.stdout.trim(); // e.g. "origin/master"
    return {
      branch,
      remoteRef,
      remoteBranch: remoteRef.replace(/^origin\//, ''),
      needsUpstream: false,
      hasRemote: true,
      blocker: null,
      toplevel,
      defaultBranch,
      resolvedBy: 'upstream',
    };
  }

  // The candidate set: real remote branches. origin/HEAD is a symref, not a branch.
  const remoteBranches = await git(repoDir, ['branch', '-r', '--format=%(refname:short)']);
  const candidates = remoteBranches.stdout
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.startsWith('origin/') && !s.startsWith('origin/HEAD'));

  // 2. The remote's default branch — what Vercel builds as production.
  //
  //    Only accepted when it actually exists among the tracking refs. origin/HEAD is written once
  //    at clone time and never refreshed, so it can name a deleted branch; pushing to a name with
  //    no tracking ref silently CREATES a branch, which is the class of failure being fixed here.
  if (defaultBranch && candidates.includes(`origin/${defaultBranch}`)) {
    return {
      branch,
      remoteRef: `origin/${defaultBranch}`,
      remoteBranch: defaultBranch,
      needsUpstream: true,
      hasRemote: true,
      blocker: null,
      toplevel,
      defaultBranch,
      resolvedBy: 'remote-default',
    };
  }

  // 3. Exactly one origin/* branch — unambiguous even without tracking configured, which is the
  //    state onboard.js leaves behind (it pushes without -u).
  if (candidates.length === 1) {
    return {
      branch,
      remoteRef: candidates[0],
      remoteBranch: candidates[0].replace(/^origin\//, ''),
      needsUpstream: true,
      hasRemote: true,
      blocker: null,
      toplevel,
      defaultBranch,
      resolvedBy: 'sole-remote',
    };
  }

  // 4. Several remote branches and no default — prefer one matching the local name.
  const sameName = candidates.find((c) => c === `origin/${branch}`);
  if (sameName) {
    return {
      branch,
      remoteRef: sameName,
      remoteBranch: branch,
      needsUpstream: true,
      hasRemote: true,
      blocker: null,
      toplevel,
      defaultBranch,
      resolvedBy: 'local-name',
    };
  }

  // 5. Nothing pushed yet under this name.
  return {
    branch,
    remoteRef: null,
    remoteBranch: branch,
    needsUpstream: true,
    hasRemote: true,
    blocker: null,
    toplevel,
    defaultBranch,
    resolvedBy: 'unpushed',
  };
}

export interface RepoSyncState {
  /** Paths with staged or unstaged changes, from `git status --porcelain`. */
  dirtyFiles: string[];
  /** Commits on HEAD that the remote ref doesn't have. */
  ahead: number;
  /** Commits on the remote ref that HEAD doesn't have. */
  behind: number;
  headSha: string;
  remoteSha: string | null;
  /** ISO date of the remote ref's commit, for "comparing against … (7 Jul)". */
  remoteDate: string | null;
  /** True when the fetch failed or timed out and the CACHED remote ref was used instead. */
  stale: boolean;
}

/**
 * How far this repo is from what's deployed.
 *
 * Fetches first so `origin/<branch>` reflects the real remote, but treats a slow or failed
 * fetch as non-fatal: a stale baseline with a warning beats a dialog that hangs. Offline is a
 * normal condition, not an error.
 */
export async function readSyncState(repoDir: string, target: DeployTarget): Promise<RepoSyncState> {
  let stale = false;
  if (target.hasRemote) {
    const fetched = await git(repoDir, ['fetch', '--quiet', 'origin'], { timeout: FETCH_TIMEOUT_MS });
    if (fetched.code !== 0 || fetched.timedOut) stale = true;
  }

  const status = await git(repoDir, ['status', '--porcelain']);
  const dirtyFiles = status.stdout
    .split(/\r?\n/)
    .map((line) => line.slice(3).trim()) // strip the two status chars + space
    .filter(Boolean);

  const head = await git(repoDir, ['rev-parse', 'HEAD']);
  const headSha = head.stdout.trim();

  let remoteSha: string | null = null;
  let remoteDate: string | null = null;
  let ahead = 0;
  let behind = 0;

  if (target.remoteRef) {
    const remote = await git(repoDir, ['rev-parse', target.remoteRef]);
    if (remote.code === 0) {
      remoteSha = remote.stdout.trim();
      const date = await git(repoDir, ['log', '-1', '--format=%cI', target.remoteRef]);
      if (date.code === 0) remoteDate = date.stdout.trim() || null;

      // `--left-right` on a symmetric range: left = remote-only (behind), right = ours (ahead).
      const counts = await git(repoDir, [
        'rev-list', '--left-right', '--count', `${target.remoteRef}...HEAD`,
      ]);
      if (counts.code === 0) {
        const [b, a] = counts.stdout.trim().split(/\s+/).map((n) => Number(n) || 0);
        behind = b ?? 0;
        ahead = a ?? 0;
      }
    }
  } else {
    // Nothing on the remote: every commit here is unshipped.
    const count = await git(repoDir, ['rev-list', '--count', 'HEAD']);
    ahead = Number(count.stdout.trim()) || 0;
  }

  return { dirtyFiles, ahead, behind, headSha, remoteSha, remoteDate, stale };
}

/**
 * One file's content at a ref — the deploy baseline read.
 *
 * `git show <ref>:<path>` reads straight out of the object database, so it reports what was
 * COMMITTED regardless of what the working tree currently holds. That distinction is the
 * whole point: the working tree is where the studio's unshipped edits live.
 *
 * Paths are always forward-slashed here, even on Windows — git's internal path syntax, not
 * the platform's.
 */
export async function showAtRef(
  repoDir: string,
  ref: string,
  path: string,
): Promise<string | null> {
  const res = await git(repoDir, ['show', `${ref}:${path}`]);
  if (res.code !== 0) return null;
  return res.stdout;
}
