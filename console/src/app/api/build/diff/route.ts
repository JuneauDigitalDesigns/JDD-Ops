import { NextResponse } from 'next/server';
import { resolve } from 'node:path';
import { isValidSlug } from '@/lib/export';
import { clientDir } from '@/lib/paths';
import { parseIntakeSource } from '@/lib/intake';
import { parseExportedPage } from '@/lib/studio-readback';
import {
  resolveDeployTarget,
  readSyncState,
  showAtRef,
  type RepoSyncState,
  type DeployResolution,
} from '@/lib/git-state';
import { diffComposition, diffContent, type DeployDiff } from '@/lib/deploy-diff';

/**
 * What would change on the LIVE site if this studio state were deployed.
 *
 * The baseline is what's committed at the remote ref — read with `git show`, not off disk.
 * That distinction is the entire fix: this route used to read the repo's working tree, which
 * a previous export had already overwritten, so it compared the studio against the studio's
 * own unshipped output and concluded everything matched while Vercel served a three-week-old
 * build. The working tree is where unshipped work LIVES; it can never be the baseline for
 * "what's different from live".
 *
 * Read-only — nothing here writes, stashes or checks out, so the operator's uncommitted work
 * is untouched and the dialog is safe to open on every keystroke of a rebuild.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface DiffResponse {
  /** Nothing has ever been pushed — the whole site is new. */
  firstDeploy: boolean;
  /** Set when the repo must not be deployed from; the dialog explains and disables Deploy. */
  blocker: string | null;
  blockerDetail: string | null;
  diff: DeployDiff;
  sync: RepoSyncState | null;
  /** The ref the diff is measured against, e.g. `origin/master`. */
  baselineRef: string | null;
  /** False when the shipped site.ts couldn't be read/parsed — say so, don't imply clean. */
  contentComparable: boolean;
  compositionComparable: boolean;
  /** The branch a deploy would push to. */
  remoteBranch: string | null;
  /** Which rule chose it, so the dialog can flag a guess rather than assert it. */
  resolvedBy: DeployResolution;
  /** The remote's default branch — what Vercel builds as production. */
  defaultBranch: string | null;
  /**
   * The parsed site.ts committed at baselineRef: the RAW shipped values.
   *
   * Shipped so the dialog can offer a per-row "revert". ContentChange.before is a DISPLAY
   * string from show() — an array collapses to "3 items", an object to "{…}" — so a change row
   * on its own can never be turned back into the value it replaced. Null when unparseable.
   */
  baselineContent: unknown | null;
  /** The composition parsed out of the committed page.tsx, for the same reason. */
  baselineComposition: {
    selections: Record<string, string>;
    skins: Record<string, string>;
    order: string[];
  } | null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const slug = String(body.slug ?? '').trim();
    if (!isValidSlug(slug)) {
      return NextResponse.json({ error: 'Invalid slug.' }, { status: 400 });
    }

    const repoDir = resolve(clientDir(slug), 'repo');
    const target = await resolveDeployTarget(repoDir);

    const empty: DeployDiff = { composition: [], content: [], clean: false };
    /** Fields that are only knowable once a deploy target resolved. */
    const noTarget = {
      remoteBranch: null,
      resolvedBy: 'none' as DeployResolution,
      defaultBranch: null,
      baselineContent: null,
      baselineComposition: null,
    };

    if (!target) {
      return NextResponse.json({
        firstDeploy: true,
        blocker: 'no-repo',
        blockerDetail: `No git repository at clients/${slug}/repo — export the site first.`,
        diff: empty,
        sync: null,
        baselineRef: null,
        contentComparable: false,
        compositionComparable: false,
        ...noTarget,
      } satisfies DiffResponse);
    }

    if (target.blocker) {
      // Refuse loudly. 'not-own-repo' in particular means git would operate on an ancestor
      // repo (for a client folder, that's the ops repo) — never let a deploy near that.
      const detail =
        target.blocker === 'not-own-repo'
          ? `clients/${slug}/repo is not its own git repository — git resolves it to ${target.toplevel}. Deploying would commit and push THAT repo. Run \`git init\` in the client repo and set its origin (onboard.js normally does this).`
          : `clients/${slug}/repo has no \`origin\` remote, so there is nowhere to deploy to.`;
      return NextResponse.json({
        firstDeploy: false,
        blocker: target.blocker,
        blockerDetail: detail,
        diff: empty,
        sync: null,
        baselineRef: null,
        contentComparable: false,
        compositionComparable: false,
        ...noTarget,
      } satisfies DiffResponse);
    }

    const sync = await readSyncState(repoDir, target);

    // Never pushed: there is no baseline to diff against, and everything is unshipped.
    if (!target.remoteRef || !sync.remoteSha) {
      return NextResponse.json({
        firstDeploy: true,
        blocker: null,
        blockerDetail: null,
        diff: { composition: [], content: [], clean: false },
        sync,
        baselineRef: null,
        contentComparable: false,
        compositionComparable: false,
        ...noTarget,
        remoteBranch: target.remoteBranch,
        resolvedBy: target.resolvedBy,
        defaultBranch: target.defaultBranch,
      } satisfies DiffResponse);
    }

    // ── Baselines, read out of git rather than off disk ────────────────────────────────
    const shippedContentSrc = await showAtRef(repoDir, target.remoteRef, 'src/data/site.ts');
    const shippedContent = shippedContentSrc ? await parseIntakeSource(shippedContentSrc) : null;
    const shippedSite = shippedContent?.sites?.[0] ?? null;
    const contentComparable = Boolean(shippedSite);

    const shippedPageSrc = await showAtRef(repoDir, target.remoteRef, 'src/app/page.tsx');
    const shippedComposition = shippedPageSrc ? parseExportedPage(shippedPageSrc) : null;
    const compositionComparable = Boolean(shippedComposition);

    const composition = shippedComposition
      ? diffComposition(
          {
            selections: shippedComposition.selections,
            skins: shippedComposition.skins,
            order: shippedComposition.order,
          },
          { selections: body.selections ?? {}, skins: body.skins ?? {}, order: body.order ?? [] },
        )
      : [];
    const content = shippedSite ? diffContent(shippedSite, body.content ?? {}) : [];

    /**
     * `clean` means "pressing Deploy would change nothing on the live site" — which is a
     * stronger claim than "the studio matches the baseline". Uncommitted files and unpushed
     * commits are both unshipped work, and treating them as clean is the exact bug being
     * fixed here. An unreadable baseline is also not clean: we don't know, and guessing
     * "fine" is how this went wrong the first time.
     */
    const clean =
      composition.length === 0 &&
      content.length === 0 &&
      sync.dirtyFiles.length === 0 &&
      sync.ahead === 0 &&
      contentComparable &&
      compositionComparable;

    return NextResponse.json({
      firstDeploy: false,
      blocker: null,
      blockerDetail: null,
      diff: { composition, content, clean },
      sync,
      baselineRef: target.remoteRef,
      contentComparable,
      compositionComparable,
      remoteBranch: target.remoteBranch,
      resolvedBy: target.resolvedBy,
      defaultBranch: target.defaultBranch,
      // The raw shipped state. The dialog recomputes the diff from this locally so a revert is
      // instant and doesn't cost a `git fetch` per click — and so a row can be resolved back to
      // an actual value rather than to the display string in ContentChange.before.
      baselineContent: shippedSite,
      baselineComposition: shippedComposition
        ? {
            selections: shippedComposition.selections,
            skins: shippedComposition.skins,
            order: shippedComposition.order,
          }
        : null,
    } satisfies DiffResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not compute the diff.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
