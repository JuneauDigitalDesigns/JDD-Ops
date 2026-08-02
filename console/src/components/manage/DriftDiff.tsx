'use client';

import { useState } from 'react';
import { ArrowLineDown, ArrowLineUp, SpinnerGap, Warning } from '@phosphor-icons/react';
import type { DriftState } from '@/lib/useEnvEditor';

/**
 * Shown under a key that differs from Vercel: what disk has, what Vercel has, and the two
 * ways out.
 *
 * "Push local" syncs every var for this site, not just this key — vercel-sync.js exposes
 * only a whole-file sync, and the button says so rather than implying a surgical write.
 * "Pull remote" IS per-key, because it writes .env.local, which onboard.js treats as the
 * source of truth.
 *
 * The remote value is not rendered. The drift check deliberately doesn't decrypt master
 * credentials (one request per key), so showing a "remote" column would print an empty
 * box for exactly the keys you'd most want to compare.
 */
export default function DriftDiff({
  slug,
  siteSlug,
  envKey,
  localValue,
  state,
  onSynced,
}: {
  slug: string;
  siteSlug: string;
  envKey: string;
  localValue: string;
  state: DriftState;
  onSynced: () => void;
}) {
  const [busy, setBusy] = useState<'push' | 'pull' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(direction: 'push' | 'pull') {
    setBusy(direction);
    setError(null);
    try {
      const res = await fetch('/api/manage/env/sync-key', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug, site: siteSlug, key: envKey, direction }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (body.error) setError(body.error);
      else onSynced();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      className="mt-1 flex flex-col gap-2 rounded-[8px] border p-2.5"
      style={{ borderColor: 'var(--rule)', background: 'var(--bg-deep)' }}
    >
      <div className="flex items-center gap-2 text-2xs" style={{ color: 'var(--danger)' }}>
        <Warning size={12} weight="fill" />
        {state === 'missing-remote'
          ? 'This key is on disk but not on Vercel.'
          : 'Disk and Vercel disagree on this value.'}
      </div>

      <div className="flex items-baseline gap-2 text-xs">
        <span className="meta shrink-0">
          disk
        </span>
        <span className="min-w-0 flex-1 truncate font-mono text-fg2" title={localValue}>
          {localValue || '(empty)'}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => run('push')}
          disabled={busy !== null}
          className="btn btn-xs"
          title="Push every env var for this site to Vercel (the sync is whole-file and idempotent)"
        >
          {busy === 'push' ? <SpinnerGap size={12} className="animate-spin" /> : <ArrowLineUp size={12} />}
          Push local
        </button>
        {state !== 'missing-remote' && (
          <button
            type="button"
            onClick={() => run('pull')}
            disabled={busy !== null}
            className="btn btn-xs"
            title="Overwrite this one key in .env.local with what Vercel holds"
          >
            {busy === 'pull' ? <SpinnerGap size={12} className="animate-spin" /> : <ArrowLineDown size={12} />}
            Pull remote
          </button>
        )}
        <span className="text-2xs text-fg3">
          Push sends all of this site&apos;s vars; pull rewrites only {envKey}.
        </span>
      </div>

      {error && (
        <span className="text-2xs" style={{ color: 'var(--danger)' }}>
          {error}
        </span>
      )}
    </div>
  );
}
