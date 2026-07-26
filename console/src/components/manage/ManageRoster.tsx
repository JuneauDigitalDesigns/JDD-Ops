'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowsClockwise,
  CaretRight,
  CheckCircle,
  Warning,
  XCircle,
} from '@phosphor-icons/react';
import PlanChip from '@/components/PlanChip';
import { relativeTime, absoluteTime } from '@/lib/relativeTime';
import type { Plan, ClientStatus } from '@/lib/types';

/**
 * The /manage landing: every client, with enough live signal to spot a broken one without
 * opening it — which is the thing the old two-panel page could not do at all.
 *
 * Rows, not a <table>: the console has no table markup anywhere, and flex rows match
 * ClientCard's existing idiom while letting columns collapse on narrow viewports.
 *
 * Drift is NOT fetched on load. Resolving it costs one Vercel request per key per site,
 * so it is a deliberate button — press "Check drift" and the column fills in.
 */

interface DeployView {
  state: string;
  createdAt: number | null;
  url: string | null;
  inspectorUrl: string | null;
}

interface HttpView {
  ok: boolean;
  status: number | null;
  ms: number;
  error?: string;
}

/** Server-rendered from disk by manage/page.tsx — present on first paint. */
interface Row {
  slug: string;
  brandName: string;
  plan: Plan;
  isEnterprise: boolean;
  detectedStatus: ClientStatus;
  hasIntake: boolean;
  manageable: boolean;
  reason: string | null;
  siteCount: number;
  liveUrl: string | null;
}

/** Arrives separately from /api/manage/roster, keyed by slug. */
interface Health {
  deploy: DeployView | null;
  http: HttpView | null;
}

const SHOW_ALL_KEY = 'manage:roster:showAll';

/** A check that hasn't come back yet — distinct from "—", which means "nothing to show". */
function Placeholder({ w }: { w: number }) {
  return (
    <span
      className="inline-block h-[8px] animate-pulse rounded-full"
      style={{ width: w, background: 'var(--rule)' }}
      aria-label="checking"
    />
  );
}

/** Vercel deployment states → the three colours the console already speaks. */
function deployColor(state: string): string {
  if (state === 'READY') return 'var(--ok)';
  if (state === 'ERROR' || state === 'CANCELED') return 'var(--danger)';
  return 'var(--warn)'; // BUILDING / QUEUED / INITIALIZING
}

export default function ManageRoster({ rows }: { rows: Row[] }) {
  const [health, setHealth] = useState<Record<string, Health> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vercelConfigured, setVercelConfigured] = useState(true);
  const [showAll, setShowAll] = useState(false);

  // Drift is filled in on demand, keyed by slug.
  const [drift, setDrift] = useState<Record<string, number | 'error'>>({});
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    try {
      setShowAll(localStorage.getItem(SHOW_ALL_KEY) === '1');
    } catch {
      /* private mode — default is fine */
    }
  }, []);

  const toggleShowAll = useCallback(() => {
    setShowAll((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SHOW_ALL_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  // Health only — the rows are already on screen from the server render.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/manage/roster', { cache: 'no-store' });
        const body = (await res.json()) as {
          health?: Record<string, Health>;
          vercelConfigured?: boolean;
          error?: string;
        };
        if (cancelled) return;
        if (body.error) setError(body.error);
        setHealth(body.health ?? {});
        setVercelConfigured(body.vercelConfigured ?? false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to check client health.');
          setHealth({});
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Resolve drift for every manageable client. Explicitly triggered — see the note above. */
  const checkDrift = useCallback(async () => {
    setScanning(true);
    const targets = rows.filter((r) => r.manageable);
    await Promise.all(
      targets.map(async (r) => {
        try {
          const res = await fetch(`/api/manage/env?slug=${encodeURIComponent(r.slug)}`, {
            cache: 'no-store',
          });
          const body = (await res.json()) as {
            sites?: Array<{ vercel: { drift: Array<{ state: string }> } }>;
          };
          const count = (body.sites ?? []).reduce(
            (n, s) =>
              n + s.vercel.drift.filter((d) => d.state === 'differs' || d.state === 'missing-remote').length,
            0,
          );
          setDrift((prev) => ({ ...prev, [r.slug]: count }));
        } catch {
          setDrift((prev) => ({ ...prev, [r.slug]: 'error' }));
        }
      }),
    );
    setScanning(false);
  }, [rows]);

  const visible = useMemo(() => rows.filter((r) => showAll || r.manageable), [rows, showAll]);
  const hiddenCount = rows.filter((r) => !r.manageable).length;

  return (
    <main className="no-scrollbar w-full flex-1 overflow-y-auto px-6 py-8 md:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <span className="flex items-center gap-2.5">
            <span className="h-px w-8 shrink-0" style={{ background: 'var(--accent)' }} />
            <span className="kicker">Manage</span>
          </span>
          <h1 className="font-display text-3xl font-semibold leading-none tracking-tightest text-fg">
            Clients
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={checkDrift}
            disabled={scanning || !rows?.some((r) => r.manageable)}
            className="btn btn-sm"
            title="Compare each client's .env.local against Vercel. One request per key, so this is not automatic."
          >
            <ArrowsClockwise size={13} className={scanning ? 'animate-spin' : undefined} />
            {scanning ? 'Checking…' : 'Check drift'}
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-4 flex items-center gap-2 text-xs" style={{ color: 'var(--danger)' }}>
          <Warning size={14} /> {error}
        </div>
      )}

      {!vercelConfigured && (
        <div
          className="mb-4 rounded-[10px] border px-4 py-2.5 text-xs"
          style={{ borderColor: 'var(--warn)', background: 'var(--warn-glow)', color: 'var(--fg-2)' }}
        >
          VERCEL_TOKEN is not set in jdd-ops/.env — deploy state and drift are unavailable.
        </div>
      )}

      {/* Column headers. Hidden below lg, where rows collapse to name + status. */}
      <div className="hidden items-center gap-4 border-b border-rule px-3 pb-2 lg:flex">
        <span className="kicker flex-1">Client</span>
        <span className="kicker w-[80px]">Drift</span>
        <span className="kicker w-[110px]">Last deploy</span>
        <span className="kicker w-[90px]">Site</span>
        <span className="w-4" />
      </div>

      {visible.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-20 text-center">
          <p className="text-sm text-fg2">
            {rows.length === 0 ? 'No clients under clients/ yet.' : 'No provisioned clients.'}
          </p>
          <p className="max-w-[420px] text-xs text-fg3">
            {rows.length === 0
              ? 'Run the Build wizard, then provision from the Onboarding runbook.'
              : 'A client shows up here once it has a .env.local on disk — that is what every tool on this page reads.'}
          </p>
        </div>
      )}

      <div className="flex flex-col">
        {visible.map((row) => (
          <RosterRow
            key={row.slug}
            row={row}
            health={health?.[row.slug]}
            pending={health === null}
            drift={drift[row.slug]}
          />
        ))}
      </div>

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={toggleShowAll}
          className="mt-4 text-xs text-fg3 transition-colors hover:text-fg"
        >
          {showAll
            ? `Hide ${hiddenCount} unprovisioned client${hiddenCount === 1 ? '' : 's'}`
            : `Show ${hiddenCount} unprovisioned client${hiddenCount === 1 ? '' : 's'}`}
        </button>
      )}
    </main>
  );
}

function RosterRow({
  row,
  health,
  pending,
  drift,
}: {
  row: Row;
  health?: Health;
  /** Health request still in flight — show a placeholder, not "—", which means "none". */
  pending: boolean;
  drift?: number | 'error';
}) {
  const deploy = health?.deploy ?? null;
  const http = health?.http ?? null;
  const waiting = pending && row.manageable;

  const body = (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-sm font-medium text-fg">{row.brandName}</span>
          <span className="truncate font-mono text-xs text-fg3">
            {row.slug}
            {row.siteCount > 1 && ` · ${row.siteCount} sites`}
          </span>
        </div>
        <PlanChip plan={row.plan} />
      </div>

      {row.manageable ? (
        <>
          <span className="w-[80px] text-xs">
            {drift === undefined ? (
              <span className="text-fg3">—</span>
            ) : drift === 'error' ? (
              <span style={{ color: 'var(--danger)' }}>failed</span>
            ) : drift === 0 ? (
              <span style={{ color: 'var(--ok)' }}>in sync</span>
            ) : (
              <span style={{ color: 'var(--warn)' }}>
                {drift} key{drift === 1 ? '' : 's'}
              </span>
            )}
          </span>

          <span
            className="flex w-[110px] items-center gap-1.5 text-xs"
            title={absoluteTime(deploy?.createdAt)}
          >
            {waiting ? (
              <Placeholder w={52} />
            ) : deploy ? (
              <>
                <span
                  className="h-[7px] w-[7px] shrink-0 rounded-full"
                  style={{ background: deployColor(deploy.state) }}
                />
                <span className="text-fg2">{relativeTime(deploy.createdAt)}</span>
                {deploy.state !== 'READY' && (
                  <span className="text-fg3">{deploy.state.toLowerCase()}</span>
                )}
              </>
            ) : (
              <span className="text-fg3">—</span>
            )}
          </span>

          <span
            className="flex w-[90px] items-center gap-1.5 text-xs"
            title={http?.error ?? row.liveUrl ?? ''}
          >
            {waiting ? (
              <Placeholder w={40} />
            ) : http ? (
              http.ok ? (
                <>
                  <CheckCircle size={13} weight="fill" style={{ color: 'var(--ok)' }} />
                  <span className="text-fg2">{http.status}</span>
                </>
              ) : (
                <>
                  <XCircle size={13} weight="fill" style={{ color: 'var(--danger)' }} />
                  <span className="text-fg2">{http.status ?? 'down'}</span>
                </>
              )
            ) : (
              <span className="text-fg3">—</span>
            )}
          </span>
        </>
      ) : (
        <span className="flex-1 text-xs text-fg3 lg:flex-none lg:w-[280px]">{row.reason}</span>
      )}
    </>
  );

  if (!row.manageable) {
    return (
      <div
        className="flex items-center gap-4 border-b border-rule px-3 py-3.5 opacity-55"
        title={row.reason ?? undefined}
      >
        {body}
        <span className="w-4" />
      </div>
    );
  }

  return (
    <Link
      href={`/manage/${row.slug}/overview`}
      className="group flex items-center gap-4 border-b border-rule px-3 py-3.5 transition-colors hover:bg-[var(--surface)]"
    >
      {body}
      <CaretRight
        size={14}
        className="shrink-0 text-fg3 transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}
