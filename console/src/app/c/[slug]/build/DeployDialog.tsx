'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowClockwise, ArrowCounterClockwise, ArrowRight, CheckCircle, CircleNotch,
  RocketLaunch, Warning, X,
} from '@phosphor-icons/react';
import type { SiteContent } from '@/data/site';
import { defaultSkin, type SkinId } from '@/lib/skins';
import type { Selections, SkinSelections, StudioReverts } from './page-order';
import {
  buildCommitMessage, describeComposition, diffComposition, diffContent, resolveRevert,
  type CompositionChange, type ContentChange, type DeployDiff,
} from '@/lib/deploy-diff';

/**
 * Ship studio changes to a client's LIVE site.
 *
 * The gate before the button is the whole point. This writes the client's repo, commits and
 * pushes, and Vercel redeploys — so the page real customers are looking at changes seconds
 * later. That is only safe if you can see exactly what you're about to change first, which
 * is why the diff is field-level and calls out copy and colour separately rather than
 * saying "content updated".
 *
 * Distinct from LaunchDialog, which is the FIRST export — creating the repo, choosing a
 * slug. By the time you're here the client exists and the only question is what changes.
 */

/** Mirrors DiffResponse in api/build/diff. */
interface DiffPayload {
  firstDeploy: boolean;
  blocker: string | null;
  blockerDetail: string | null;
  diff: DeployDiff;
  sync: {
    dirtyFiles: string[];
    ahead: number;
    behind: number;
    headSha: string;
    remoteSha: string | null;
    remoteDate: string | null;
    stale: boolean;
  } | null;
  baselineRef: string | null;
  contentComparable: boolean;
  compositionComparable: boolean;
  remoteBranch: string | null;
  resolvedBy: string;
  defaultBranch: string | null;
  /** Raw shipped content — what a per-row revert restores TO. */
  baselineContent: unknown | null;
  baselineComposition: {
    selections: Record<string, string>;
    skins: Record<string, string>;
    order: string[];
  } | null;
}

type Status =
  | { kind: 'diffing' }
  | { kind: 'ready'; payload: DiffPayload }
  | { kind: 'running'; steps: string[] }
  | { kind: 'done'; steps: string[] }
  | { kind: 'error'; message: string; detail?: string; steps: string[] };

/**
 * Paths the studio itself writes. Everything else in a deploy commit was authored by
 * provisioning (api routes, package.json, README) and rides along because `git add -A` is
 * what keeps the repo honest — but it must be shown, not smuggled.
 */
function isStudioOwned(path: string): boolean {
  return (
    path === 'src/data/site.ts' ||
    path === 'src/app/page.tsx' ||
    path.startsWith('src/components/catalog/')
  );
}

/** "7 Jul" — enough to recognise a stale baseline at a glance. */
function shortDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

const KIND_LABEL: Record<ContentChange['kind'], string> = {
  color: 'Colour',
  copy: 'Copy',
  image: 'Images',
  number: 'Numbers',
  flag: 'Toggles',
  other: 'Other',
};
const GROUP_ORDER: ContentChange['kind'][] = ['copy', 'color', 'image', 'number', 'flag', 'other'];

/** Server heartbeats every 10s; 90s of silence means the export is gone, not slow. */
const IDLE_TIMEOUT_MS = 90_000;

export default function DeployDialog({
  slug, brandName, selections, skins, order, effective, exportEntries, vertical, reverts, onClose,
}: {
  slug: string;
  brandName: string;
  selections: Selections;
  skins: SkinSelections;
  order: string[];
  effective: SiteContent;
  /** The same entry shape LaunchDialog posts, so the export route sees one format. */
  exportEntries: { categoryId: string; name: string; label?: string; skin?: string }[];
  vertical: string;
  /** Putting a single row back to what's live, without leaving the dialog. */
  reverts: StudioReverts;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<Status>({ kind: 'diffing' });
  /** Bumped by "Re-check against live" to refetch the baseline. */
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && status.kind !== 'running') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, status.kind]);

  // The studio side of the request, held in a ref so it can be POSTed without becoming a
  // dependency of the fetch below.
  const studioState = useRef({ selections, skins, order, effective });
  studioState.current = { selections, skins, order, effective };

  /**
   * Fetch the BASELINE — what git says is live.
   *
   * Deps are [slug, refreshKey] on purpose. This used to depend on the studio state as well,
   * and `effective` is a fresh object on every keystroke, so the dialog re-ran a `git fetch`
   * (4s) on every change. Now that the raw baseline comes back with the response, the studio
   * side is applied locally in `liveDiff` below and a revert costs nothing. The server-computed
   * diff still comes back and is still used when a baseline is unparseable.
   */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatus({ kind: 'diffing' });
      try {
        const s = studioState.current;
        const res = await fetch('/api/build/diff', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            slug,
            selections: s.selections,
            skins: s.skins,
            order: s.order,
            content: s.effective,
          }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error ?? 'Could not compute the diff.');
        setStatus({ kind: 'ready', payload: data as DiffPayload });
      } catch (e) {
        if (!cancelled) {
          setStatus({
            kind: 'error',
            message: e instanceof Error ? e.message : 'Could not compute the diff.',
            steps: [],
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, refreshKey]);

  const payload = status.kind === 'ready' ? status.payload : null;

  /**
   * The diff as it stands RIGHT NOW, recomputed locally from the raw baseline.
   *
   * Same pure functions the route uses, so the two can't disagree about the rules — only about
   * freshness, which is the point: reverting a row has to update this list instantly, and a
   * round trip per click would make the feature unusable.
   *
   * Falls back to the server's diff when neither baseline parsed; then there is nothing to
   * recompute from and the rows are display-only (reverts are gated off in that case).
   */
  const liveDiff = useMemo<DeployDiff>(() => {
    if (!payload) return { composition: [], content: [], clean: false };
    if (payload.baselineContent == null && payload.baselineComposition == null) {
      return payload.diff;
    }
    const content = payload.baselineContent != null
      ? diffContent(payload.baselineContent, effective)
      : [];
    const composition = payload.baselineComposition
      ? diffComposition(
          {
            selections: payload.baselineComposition.selections,
            skins: payload.baselineComposition.skins,
            order: payload.baselineComposition.order,
          },
          { selections, skins, order },
        )
      : [];
    // dirtyFiles/ahead are from fetch time and a revert can't change them — only something
    // outside the console writing the repo can, which is what "Re-check against live" is for.
    const clean =
      content.length === 0 &&
      composition.length === 0 &&
      (payload.sync?.dirtyFiles.length ?? 1) === 0 &&
      (payload.sync?.ahead ?? 1) === 0 &&
      payload.contentComparable &&
      payload.compositionComparable;
    return { content, composition, clean };
  }, [payload, effective, selections, skins, order]);

  // ── Commit message ────────────────────────────────────────────────────────
  const autoMessage = useMemo(
    () => buildCommitMessage(liveDiff, brandName),
    [liveDiff, brandName],
  );
  const [message, setMessage] = useState('');
  const [messageDirty, setMessageDirty] = useState(false);
  // Track the generated message until the operator takes ownership of it, then stop — having
  // their text replaced because they reverted a row would be its own small betrayal.
  useEffect(() => {
    if (!messageDirty) setMessage(autoMessage);
  }, [autoMessage, messageDirty]);

  /** Behind the remote means `git push` is rejected — refuse before anything is written. */
  const behindBlocked = (payload?.sync?.behind ?? 0) > 0;

  const deploy = useCallback(
    async (commitMessage: string) => {
      setStatus({ kind: 'running', steps: [] });

      let res: Response;
      try {
        res = await fetch('/api/build/export', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            slug,
            overwrite: true, // the repo exists; this is an update, not a first export
            selections: exportEntries,
            vertical,
            content: effective,
            deploy: true,
            commitMessage,
          }),
        });
      } catch {
        setStatus({ kind: 'error', message: 'Could not reach the export service.', steps: [] });
        return;
      }
      if (!res.body) {
        setStatus({ kind: 'error', message: 'No response stream from the export service.', steps: [] });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      const steps: string[] = [];

      /**
       * Idle watchdog. The server heartbeats every 10s through npm install and next build, so
       * silence this long means the export died in a way that never reached the stream — a
       * crashed dev server, a killed child, a lost connection. Without it this loop waits
       * forever on a `reader.read()` that will never resolve and the dialog sits on "working…"
       * with no way out but a reload.
       */
      let idle: ReturnType<typeof setTimeout> | undefined;
      let timedOut = false;
      const armWatchdog = () => {
        clearTimeout(idle);
        idle = setTimeout(() => {
          timedOut = true;
          reader.cancel().catch(() => {});
        }, IDLE_TIMEOUT_MS);
      };
      armWatchdog();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          armWatchdog();
          buf += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line) continue;
            let msg: { type: string; [k: string]: unknown };
            try {
              msg = JSON.parse(line);
            } catch {
              continue;
            }
            if (msg.type === 'heartbeat') {
              continue; // liveness only; nothing to show
            } else if (msg.type === 'step') {
              steps.push(String(msg.message));
              setStatus({ kind: 'running', steps: [...steps] });
            } else if (msg.type === 'done') {
              setStatus({ kind: 'done', steps: [...steps] });
            } else if (msg.type === 'error') {
              setStatus({
                kind: 'error',
                message: String(msg.message),
                detail: msg.detail ? String(msg.detail) : undefined,
                steps: [...steps],
              });
            }
          }
        }
      } catch {
        /* reader cancelled by the watchdog, or the connection dropped */
      } finally {
        clearTimeout(idle);
      }

      if (timedOut) {
        setStatus({
          kind: 'error',
          message: 'The export stopped reporting progress and was given up on after 90 seconds.',
          detail:
            `It may still be running on the server. Check clients/${slug}/repo with \`git log\` and \`git status\` before trying again — ` +
            'if it got as far as committing, deploying again is safe; if it got as far as pushing, the live site may already be updated.',
          steps: [...steps],
        });
      }
    },
    [slug, exportEntries, vertical, effective],
  );

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4">
      <div className="panel flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden p-0">
        <header className="flex shrink-0 items-center gap-3 border-b border-rule px-5 py-4">
          <RocketLaunch size={18} style={{ color: 'var(--accent)' }} />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-semibold text-fg">Deploy to {brandName}</h2>
            <p className="text-2xs text-fg3">
              Writes the repo, commits, and pushes. Vercel redeploys the live site.
            </p>
          </div>
          {status.kind !== 'running' && (
            <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-fg3 hover:text-fg">
              <X size={16} />
            </button>
          )}
        </header>

        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {status.kind === 'diffing' && (
            <p className="flex items-center gap-2 text-sm text-fg2">
              <CircleNotch size={15} className="animate-spin" /> Comparing with what&apos;s live…
            </p>
          )}

          {status.kind === 'ready' && (
            <DiffBody
              payload={status.payload}
              diff={liveDiff}
              effective={effective}
              reverts={reverts}
              slug={slug}
              onRecheck={() => setRefreshKey((k) => k + 1)}
            />
          )}

          {status.kind === 'ready' && !status.payload.blocker && !behindBlocked && (
            <section className="mt-5">
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <h3 className="kicker">Commit message</h3>
                {messageDirty && (
                  <button
                    type="button"
                    onClick={() => {
                      setMessage(autoMessage);
                      setMessageDirty(false);
                    }}
                    title="Replace with the message generated from the changes above"
                    className="flex shrink-0 items-center gap-1 text-2xs text-fg3 transition-colors hover:text-fg"
                  >
                    <ArrowCounterClockwise size={12} /> regenerate
                  </button>
                )}
              </div>
              <textarea
                className="input mono"
                rows={7}
                spellCheck={false}
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  setMessageDirty(true);
                }}
                aria-label="Commit message"
              />
              <p className="mt-1.5 text-2xs text-fg3">
                {messageDirty
                  ? 'Edited — this no longer tracks the changes above.'
                  : 'Updates automatically as you revert items above.'}
              </p>
            </section>
          )}

          {(status.kind === 'running' || status.kind === 'done') && (
            <ol className="flex flex-col gap-1.5">
              {status.steps.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-fg2">
                  <CheckCircle size={13} weight="fill" style={{ color: 'var(--ok)', marginTop: 2 }} />
                  {s}
                </li>
              ))}
              {status.kind === 'running' && (
                <li className="flex items-center gap-2 text-xs text-fg3">
                  <CircleNotch size={13} className="animate-spin" /> working…
                </li>
              )}
              {status.kind === 'done' && (
                <li className="mt-2 flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--ok)' }}>
                  <CheckCircle size={15} weight="fill" /> Pushed. Vercel is building the new version.
                </li>
              )}
            </ol>
          )}

          {status.kind === 'error' && (
            <div className="flex flex-col gap-2">
              <p className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--danger)' }}>
                <Warning size={15} weight="fill" /> {status.message}
              </p>
              {status.detail && (
                <pre className="mono max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-rule bg-[var(--bg-deep)] p-3 text-2xs text-fg2">
                  {status.detail}
                </pre>
              )}
            </div>
          )}
        </div>

        <footer className="flex shrink-0 items-center gap-2 border-t border-rule px-5 py-3">
          {status.kind === 'ready' && status.payload.blocker && (
            <>
              <span className="text-2xs" style={{ color: 'var(--danger)' }}>
                Can’t deploy this client.
              </span>
              <button type="button" onClick={onClose} className="btn btn-sm ml-auto">
                Close
              </button>
            </>
          )}
          {/* Behind the remote: the push WILL be rejected, so neither Deploy nor the escape
              hatch can help. This is the one refusal that isn't an inference of ours — it's
              what git will do. */}
          {status.kind === 'ready' && !status.payload.blocker && behindBlocked && (
            <>
              <span className="text-2xs" style={{ color: 'var(--danger)' }}>
                Bring the repo up to date first.
              </span>
              <button type="button" onClick={onClose} className="btn btn-sm ml-auto">
                Close
              </button>
            </>
          )}
          {status.kind === 'ready' && !status.payload.blocker && !behindBlocked && !liveDiff.clean && (
            <>
              <span className="text-2xs text-fg3">
                {status.payload.firstDeploy
                  ? 'First deploy — the whole site ships.'
                  : summarise(status.payload, liveDiff)}
              </span>
              <button type="button" onClick={onClose} className="btn btn-sm ml-auto">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deploy(message)}
                disabled={!message.trim()}
                title={!message.trim() ? 'A commit message is required.' : undefined}
                className="btn btn-sm btn-primary"
              >
                Deploy <ArrowRight size={13} weight="bold" />
              </button>
            </>
          )}
          {status.kind === 'ready' && !status.payload.blocker && !behindBlocked && liveDiff.clean && (
            <>
              <span className="text-2xs text-fg3">
                Nothing to deploy — the live site already matches.
              </span>
              <button type="button" onClick={onClose} className="btn btn-sm ml-auto">
                Close
              </button>
              {/* An escape hatch, on purpose. "Clean" is an inference from a git comparison,
                  and being unable to act when that inference is wrong is precisely what made
                  the original bug unrecoverable rather than merely annoying. */}
              <button
                type="button"
                onClick={() => deploy(message)}
                disabled={!message.trim()}
                className="btn btn-sm"
                title="Re-run the export, commit and push even though nothing looks different"
              >
                Deploy anyway
              </button>
            </>
          )}
          {(status.kind === 'done' || status.kind === 'error') && (
            <button type="button" onClick={onClose} className="btn btn-sm ml-auto">
              Close
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

/** Footer summary line — counts what will actually ship, not just the studio diff. */
function summarise(p: DiffPayload, diff: DeployDiff): string {
  const bits: string[] = [];
  if (diff.composition.length) bits.push(`${diff.composition.length} layout`);
  if (diff.content.length) bits.push(`${diff.content.length} content`);
  if (p.sync?.dirtyFiles.length) bits.push(`${p.sync.dirtyFiles.length} file(s) uncommitted`);
  if (p.sync?.ahead) bits.push(`${p.sync.ahead} unpushed commit(s)`);
  return bits.join(' · ') || 'changes pending';
}

function DiffBody({
  payload, diff, effective, reverts, slug, onRecheck,
}: {
  payload: DiffPayload;
  slug: string;
  /** Recomputed locally, so it reflects reverts made since the fetch. */
  diff: DeployDiff;
  effective: SiteContent;
  reverts: StudioReverts;
  onRecheck: () => void;
}) {
  const { sync, baselineRef, firstDeploy, blocker, blockerDetail } = payload;

  if (blocker) {
    return (
      <div className="flex flex-col gap-2">
        <p className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--danger)' }}>
          <Warning size={15} weight="fill" /> This client can’t be deployed from the console.
        </p>
        <p className="text-xs leading-[1.6] text-fg2">{blockerDetail}</p>
      </div>
    );
  }

  const unshipped = (sync?.ahead ?? 0) > 0 || (sync?.dirtyFiles.length ?? 0) > 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Where the comparison is measured from. Without this the dialog asserts a conclusion
          without saying what it checked — which is how a stale baseline hides. */}
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-3">
          {baselineRef ? (
            <p className="text-2xs text-fg3">
              Comparing against <code className="codechip">{baselineRef}</code>
              {sync?.remoteSha ? ` @ ${sync.remoteSha.slice(0, 7)}` : ''}
              {sync?.remoteDate ? ` (${shortDate(sync.remoteDate)})` : ''}
              {payload.remoteBranch ? (
                <>
                  {' · pushing to '}
                  <code className="codechip">origin/{payload.remoteBranch}</code>
                </>
              ) : null}
            </p>
          ) : (
            <p className="text-2xs text-fg3">Nothing has been pushed for this client yet.</p>
          )}
          <button
            type="button"
            onClick={onRecheck}
            title="Fetch from the remote and recompute what's live"
            className="flex shrink-0 items-center gap-1 text-2xs text-fg3 transition-colors hover:text-fg"
          >
            <ArrowClockwise size={12} /> re-check
          </button>
        </div>
        {/* A branch chosen by name-matching is a guess, and guessing wrong here means pushing
            somewhere Vercel doesn't build — which looks exactly like a successful deploy. */}
        {payload.resolvedBy === 'local-name' &&
          payload.defaultBranch &&
          payload.defaultBranch !== payload.remoteBranch && (
            <p className="flex items-center gap-1.5 text-2xs" style={{ color: 'var(--warn)' }}>
              <Warning size={11} weight="fill" /> The remote’s default branch is{' '}
              <code className="codechip">{payload.defaultBranch}</code> — pushing to{' '}
              <code className="codechip">{payload.remoteBranch}</code> will not update production.
            </p>
          )}
        {sync?.stale && (
          <p className="flex items-center gap-1.5 text-2xs" style={{ color: 'var(--warn)' }}>
            <Warning size={11} weight="fill" /> Couldn’t reach the remote — comparing against the
            last known state, which may be out of date.
          </p>
        )}
      </div>

      {/* Behind the remote: git will reject the push outright. Say so with the exact commands,
          because the alternative is a failed deploy whose error is a wall of git output. */}
      {(sync?.behind ?? 0) > 0 && (
        <section
          className="rounded-md border px-4 py-3"
          style={{ borderColor: 'var(--danger)', background: 'var(--danger-glow)' }}
        >
          <h3 className="kicker mb-1.5" style={{ color: 'var(--danger)' }}>
            Behind the live site
          </h3>
          <p className="text-xs leading-[1.6] text-fg2">
            <code className="codechip">{baselineRef}</code> has {sync!.behind} commit
            {sync!.behind === 1 ? '' : 's'} this repo doesn’t. Deploying would be rejected. Bring
            the repo up to date, then re-check:
          </p>
          <pre className="mono mt-2 overflow-x-auto rounded border border-rule bg-[var(--bg-deep)] p-2.5 text-2xs text-fg2">
{`cd clients/${slug}/repo
git fetch origin
git rebase origin/${payload.remoteBranch ?? 'main'}`}
          </pre>
        </section>
      )}

      {/* The section that would have prevented this whole bug report. */}
      {unshipped && <UnshippedSection sync={sync!} />}

      {!payload.contentComparable && !firstDeploy && (
        <p className="flex items-center gap-2 text-xs" style={{ color: 'var(--warn)' }}>
          <Warning size={13} weight="fill" /> Couldn’t read the shipped version of{' '}
          <code className="codechip">site.ts</code> — showing layout changes only.
        </p>
      )}

      {firstDeploy && (
        <p className="text-sm text-fg2">
          Nothing has been pushed for this client yet, so there’s nothing to compare against —
          the whole site will be built and pushed.
        </p>
      )}

      {!firstDeploy && diff.clean && (
        <p className="flex items-center gap-2 text-sm text-fg2">
          <CheckCircle size={15} weight="fill" style={{ color: 'var(--ok)' }} />
          No differences. The live site already matches the studio.
        </p>
      )}

      <DiffGroups
        diff={diff}
        baselineContent={payload.baselineContent}
        baselineComposition={payload.baselineComposition}
        effective={effective}
        reverts={reverts}
        /* Nothing to revert TO on a first deploy, and a control that silently does nothing is
           worse than no control at all. */
        canRevert={!firstDeploy && !blocker}
      />
    </div>
  );
}

/** The per-row revert affordance, matching /manage's EnvFieldRow. */
function RevertButton({ onClick, title }: { onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="flex shrink-0 items-center gap-1 text-2xs text-fg3 transition-colors hover:text-fg"
    >
      <ArrowCounterClockwise size={12} /> revert
    </button>
  );
}

/**
 * Work that exists locally but isn't on the live site: unpushed commits and uncommitted
 * files. The absence of this section is what made the original failure invisible — 33
 * modified files sat on disk, the studio matched them, and nothing on screen mentioned that
 * none of it had ever reached Vercel.
 *
 * The file list is shown in full, split by author. `git add -A` means a content tweak also
 * commits whatever provisioning last wrote (api routes, package.json), and that should be
 * visible before you press Deploy rather than discovered in the git history afterwards.
 */
function UnshippedSection({ sync }: { sync: NonNullable<DiffPayload['sync']> }) {
  const [open, setOpen] = useState(false);
  const studio = sync.dirtyFiles.filter(isStudioOwned);
  const other = sync.dirtyFiles.filter((f) => !isStudioOwned(f));

  return (
    <section
      className="rounded-md border px-4 py-3"
      style={{ borderColor: 'var(--warn)', background: 'var(--warn-glow)' }}
    >
      <h3 className="kicker mb-1.5" style={{ color: 'var(--warn)' }}>
        Not yet live
      </h3>
      <ul className="flex flex-col gap-0.5 text-xs text-fg2">
        {sync.ahead > 0 && (
          <li>
            {sync.ahead} commit{sync.ahead === 1 ? '' : 's'} committed but never pushed
          </li>
        )}
        {sync.dirtyFiles.length > 0 && (
          <li>
            {sync.dirtyFiles.length} file{sync.dirtyFiles.length === 1 ? '' : 's'} changed in the
            repo and not committed
          </li>
        )}
      </ul>

      {sync.dirtyFiles.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="mt-2 text-2xs underline underline-offset-2"
            style={{ color: 'var(--fg-2)' }}
          >
            {open ? 'Hide' : 'Show'} the {sync.dirtyFiles.length} file
            {sync.dirtyFiles.length === 1 ? '' : 's'} that will be committed
          </button>
          {open && (
            <div className="mt-2 flex flex-col gap-3">
              {studio.length > 0 && (
                <div>
                  <p className="kicker mb-1">From the studio · {studio.length}</p>
                  <ul className="mono flex flex-col gap-0.5 text-2xs text-fg2">
                    {studio.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}
              {other.length > 0 && (
                <div>
                  <p className="kicker mb-1">
                    Also committed — written by provisioning, not the studio · {other.length}
                  </p>
                  <ul className="mono flex max-h-40 flex-col gap-0.5 overflow-y-auto text-2xs text-fg3">
                    {other.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function DiffGroups({
  diff, baselineContent, baselineComposition, effective, reverts, canRevert,
}: {
  diff: DeployDiff;
  baselineContent: unknown | null;
  baselineComposition: DiffPayload['baselineComposition'];
  effective: SiteContent;
  reverts: StudioReverts;
  canRevert: boolean;
}) {
  const groups = GROUP_ORDER.map((kind) => ({
    kind,
    items: diff.content.filter((c) => c.kind === kind),
  })).filter((g) => g.items.length > 0);

  if (diff.composition.length === 0 && groups.length === 0) return null;

  // A `reordered` row carries no index, so it can't be inverted on its own — but the shipped
  // order can be restored wholesale. Show one row for the lot rather than N rows whose revert
  // buttons would all do the same thing.
  const reordered = diff.composition.filter((c) => c.kind === 'reordered');
  const structural = diff.composition.filter((c) => c.kind !== 'reordered');

  /** Put one composition row back, reading raw values from the baseline, never from the row. */
  const revertComposition = (c: CompositionChange) => {
    const base = baselineComposition;
    if (!base) return;
    const cat = c.categoryId;
    const name = base.selections[cat];
    // Read the raw baseline, never c.before — and resolve an absent skin the same way
    // diffComposition does, to the component's own default. Anything else writes back a value
    // the diff still considers different, and the row never goes away.
    const skin = (base.skins[cat] as SkinId | undefined)
      ?? (name ? defaultSkin(name) : undefined);
    switch (c.kind) {
      case 'added':
        reverts.removeSection(cat);
        break;
      case 'removed':
        if (name) reverts.restoreSection(cat, name, skin, base.order.indexOf(cat));
        break;
      case 'variant':
        if (name) reverts.restoreSection(cat, name, skin);
        break;
      case 'skin':
        if (name) reverts.setSkin(cat, skin ?? defaultSkin(name));
        break;
    }
  };

  const compositionRevertable = canRevert && Boolean(baselineComposition);
  const contentRevertable = canRevert && baselineContent != null;

  return (
    <div className="flex flex-col gap-5">
      {diff.composition.length > 0 && (
        <section>
          <h3 className="kicker mb-2">Layout · {diff.composition.length}</h3>
          <ul className="flex flex-col gap-1.5">
            {structural.map((c, i) => (
              <li key={`${c.kind}-${c.categoryId}-${i}`} className="flex items-start justify-between gap-3">
                <span className="text-xs text-fg2">{describeComposition(c)}</span>
                {compositionRevertable && (
                  <RevertButton
                    onClick={() => revertComposition(c)}
                    title={`Put the ${c.categoryId} section back to what's live`}
                  />
                )}
              </li>
            ))}
            {reordered.length > 0 && (
              <li className="flex items-start justify-between gap-3">
                <span className="text-xs text-fg2">
                  Reordered {reordered.length} section{reordered.length === 1 ? '' : 's'} ·{' '}
                  {reordered.map((c) => c.categoryId).join(', ')}
                </span>
                {compositionRevertable && (
                  <RevertButton
                    onClick={() => reverts.setOrder(baselineComposition!.order)}
                    title="Restore the section order that's live — reordering can only be undone as a whole"
                  />
                )}
              </li>
            )}
          </ul>
        </section>
      )}

      {groups.map((g) => (
        <section key={g.kind}>
          <h3 className="kicker mb-2">
            {KIND_LABEL[g.kind]} · {g.items.length}
          </h3>
          <ul className="flex flex-col gap-2">
            {g.items.map((c) => {
              // Resolved per render so the tooltip can warn when reverting this row widens to
              // its whole array — which makes its siblings disappear too.
              const plan = contentRevertable
                ? resolveRevert(baselineContent, effective, c.path)
                : null;
              return (
                <li key={c.path} className="flex items-start justify-between gap-3">
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="mono text-2xs text-fg3">{c.path}</span>
                    <span className="flex flex-wrap items-center gap-2 text-xs">
                      {g.kind === 'color' ? (
                        <>
                          <Swatch value={c.before} />
                          <ArrowRight size={11} className="text-fg3" />
                          <Swatch value={c.after} />
                        </>
                      ) : (
                        <>
                          <span className="text-fg3 line-through">{c.before ?? '(empty)'}</span>
                          <ArrowRight size={11} className="shrink-0 text-fg3" />
                          <span className="text-fg">{c.after ?? '(empty)'}</span>
                        </>
                      )}
                    </span>
                  </span>
                  {plan && (
                    <RevertButton
                      onClick={() => reverts.field(plan.path, plan.value)}
                      title={
                        plan.widened
                          ? `${c.path} doesn't exist on the live site — reverting restores the whole ${plan.path} list.`
                          : `Put ${c.path} back to what's live`
                      }
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** A colour change is unreadable as a hex pair — show the actual colours. */
function Swatch({ value }: { value: string | null }) {
  if (!value) return <span className="text-fg3">(empty)</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-3.5 w-3.5 shrink-0 rounded border"
        style={{ background: value, borderColor: 'var(--rule-strong)' }}
      />
      <span className="mono text-2xs text-fg2">{value}</span>
    </span>
  );
}
