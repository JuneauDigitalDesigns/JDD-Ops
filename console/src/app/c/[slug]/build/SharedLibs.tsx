'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowSquareOut, CircleNotch, Warning } from '@phosphor-icons/react';
import type { SharedLibUpgrade } from '@/lib/sharedLibs';

/**
 * The shared-library update an export would make, and the box that confirms it.
 *
 * Shared by the Launch/Re-export and Deploy dialogs, which both run the same export. The list is
 * the server's own plan (/api/build/export/plan), not a summary of it: the export refuses unless
 * the confirmation names exactly this from → to, so what is shown here is what will be written.
 */

export type { SharedLibUpgrade };

/** `{ from, to }` to post as the export's `uiUpgrade` once the box is ticked. */
export function upgradeConfirmation(plan: SharedLibUpgrade | null, confirmed: boolean) {
  return plan && confirmed ? { from: plan.from, to: plan.to } : undefined;
}

export function useSharedLibPlan(slug: string | null) {
  const [plan, setPlan] = useState<SharedLibUpgrade | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (!slug) {
      setPlan(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/build/export/plan?slug=${encodeURIComponent(slug)}`, { cache: 'no-store' })
      .then(async (r) => {
        const body = (await r.json()) as { uiUpgrade?: SharedLibUpgrade | null; error?: string };
        if (cancelled) return;
        if (!r.ok) throw new Error(body.error ?? 'Could not read the repo’s shared libraries.');
        setPlan(body.uiUpgrade ?? null);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not read the repo’s shared libraries.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, key]);

  const reload = useCallback(() => setKey((k) => k + 1), []);
  return { plan, setPlan, loading, error, reload };
}

function FileList({ title, items }: { title: string; items: string[] }) {
  const [open, setOpen] = useState(items.length <= 6);
  if (items.length === 0) return null;
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="kicker text-left underline-offset-2 hover:underline"
      >
        {title} · {items.length}
      </button>
      {open && (
        <ul className="mono mt-1 flex max-h-40 flex-col gap-0.5 overflow-y-auto text-2xs text-fg2">
          {items.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SharedLibsPanel({
  plan,
  confirmed,
  onConfirmedChange,
  disabled,
}: {
  plan: SharedLibUpgrade;
  confirmed: boolean;
  onConfirmedChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const from = plan.fromTag ?? plan.from;
  const to = plan.toTag ?? plan.to;
  const refreshed = plan.templateFiles.map((f) => (f.kind === 'added' ? `${f.path} (new)` : f.path));
  const routes = plan.routes.map((f) => (f.kind === 'added' ? `${f.path} (new)` : f.path));

  return (
    <section
      className="rounded-md border px-4 py-3"
      style={{ borderColor: 'var(--warn)', background: 'var(--warn-glow)' }}
      aria-label="Shared libraries"
    >
      <h3 className="kicker mb-1.5" style={{ color: 'var(--warn)' }}>
        Shared libraries
      </h3>
      <p className="text-xs text-fg2">
        @jdd/ui <code className="codechip">{from}</code> → <code className="codechip">{to}</code>. The
        template uses {to}; this repo uses {from}. Nothing is exported until the update below is
        confirmed.
      </p>

      <ul className="mono mt-2 flex flex-col gap-0.5 text-2xs text-fg2">
        <li>package.json — @jdd/ui pin {from} → {to}</li>
        <li>
          package-lock.json — {plan.hasLockfile ? 're-resolved' : 'created'} by npm install {plan.to}
        </li>
        {plan.addedDeps.length > 0 && <li>package.json — adds {plan.addedDeps.join(', ')} from the template</li>}
      </ul>
      <FileList title="Refreshed from template/" items={refreshed} />
      <FileList title="Rewritten from lib/site-routes" items={routes} />
      <p className="mt-2 text-2xs text-fg3">
        Then the site is built. Nothing is committed or pushed unless this runs as a deploy.
      </p>

      <label className="mt-3 flex items-center gap-2 text-sm font-medium text-fg">
        <input
          type="checkbox"
          checked={confirmed}
          disabled={disabled}
          onChange={(e) => onConfirmedChange(e.target.checked)}
        />
        Update shared libraries
      </label>
    </section>
  );
}

/** The `next` line every export refusal carries. */
export function NextStep({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <p className="text-xs leading-[1.6] text-fg2">
      <span className="font-semibold text-fg">Next: </span>
      {text}
    </p>
  );
}

// ─── the build Vercel starts from the push ─────────────────────────────────────

interface DeploymentRecord {
  id: string;
  url: string | null;
  inspectorUrl: string | null;
  state: string;
  target: string | null;
  commitSha: string | null;
}

const POLL_MS = 5_000;
/** A Vercel build of a client site takes 1–3 minutes; past this the dialog stops asking. */
const GIVE_UP_MS = 15 * 60_000;
const TERMINAL = new Set(['READY', 'ERROR', 'CANCELED']);

const STATE_LABEL: Record<string, string> = {
  QUEUED: 'Queued',
  INITIALIZING: 'Starting',
  BUILDING: 'Building',
  READY: 'Ready',
  ERROR: 'Build failed',
  CANCELED: 'Canceled',
};

function stateColor(state: string): string {
  if (state === 'READY') return 'var(--ok)';
  if (state === 'ERROR' || state === 'CANCELED') return 'var(--danger)';
  return 'var(--warn)';
}

/**
 * The Vercel build of the commit just pushed: its state, and links to it.
 *
 * The push is where the console's part ends; Vercel's GitHub integration starts the build. Before
 * this the dialog said "Vercel is building" and stopped, and whether it built — or failed — was
 * only visible in /manage → Deployments or on vercel.com.
 */
export function DeployProgress({ slug, sha, branch }: { slug: string; sha: string; branch: string }) {
  const [found, setFound] = useState<DeploymentRecord | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const started = Date.now();

    const tick = async () => {
      try {
        const qs = new URLSearchParams({ slug, target: 'any', limit: '10' });
        const res = await fetch(`/api/manage/deployments?${qs.toString()}`, { cache: 'no-store' });
        const body = (await res.json()) as { error?: string; reason?: string; deployments?: DeploymentRecord[] };
        if (cancelled) return;
        if (body.error || (body.reason && !body.deployments?.length)) {
          setReason(body.error ?? body.reason ?? null);
        } else {
          setReason(null);
        }
        const match = body.deployments?.find((d) => d.commitSha && d.commitSha.startsWith(sha)) ?? null;
        if (match) setFound(match);
        if (match && TERMINAL.has(match.state)) return;
      } catch {
        /* one failed poll is not a verdict; the next one decides */
      }
      if (cancelled) return;
      if (Date.now() - started > GIVE_UP_MS) {
        setGaveUp(true);
        return;
      }
      timer = setTimeout(tick, POLL_MS);
    };
    void tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [slug, sha]);

  const manageHref = `/manage/${encodeURIComponent(slug)}/deployments`;
  const state = found?.state ?? null;

  return (
    <section className="mt-3 rounded-md border border-rule px-4 py-3" aria-label="Vercel build">
      <h3 className="kicker mb-1.5">Vercel build</h3>
      <p className="flex flex-wrap items-center gap-2 text-xs text-fg2">
        {state ? (
          <>
            <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: stateColor(state) }} />
            <span className="font-medium text-fg">{STATE_LABEL[state] ?? state.toLowerCase()}</span>
            {!TERMINAL.has(state) && !gaveUp && <CircleNotch size={12} className="animate-spin text-fg3" />}
          </>
        ) : gaveUp ? (
          <span>No build of {sha.slice(0, 7)} appeared within 15 minutes.</span>
        ) : (
          <>
            <CircleNotch size={12} className="animate-spin text-fg3" /> Waiting for Vercel to start a build of{' '}
            <code className="codechip">{sha.slice(0, 7)}</code> on <code className="codechip">{branch}</code>
          </>
        )}
      </p>

      {reason && (
        <p className="mt-1.5 flex items-center gap-1.5 text-2xs" style={{ color: 'var(--warn)' }}>
          <Warning size={11} weight="fill" /> {reason}
        </p>
      )}

      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs">
        {found?.inspectorUrl && (
          <a href={found.inspectorUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 underline">
            Build log <ArrowSquareOut size={11} />
          </a>
        )}
        {state === 'READY' && found?.url && (
          <a href={found.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 underline">
            {found.url.replace(/^https:\/\//, '')} <ArrowSquareOut size={11} />
          </a>
        )}
        <a href={manageHref} className="underline">
          Deployments
        </a>
      </p>

      {state === 'ERROR' && (
        <div className="mt-2">
          <NextStep text="The push reached GitHub but Vercel’s build failed. Open the build log; once the cause is fixed, Deploy again." />
        </div>
      )}
      {gaveUp && !state && (
        <div className="mt-2">
          <NextStep text="Open Deployments to see whether Vercel picked the push up; a push to a branch Vercel does not build never starts one." />
        </div>
      )}
    </section>
  );
}
