'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowCounterClockwise, SpinnerGap } from '@phosphor-icons/react';
import { relativeTime, absoluteTime } from '@/lib/relativeTime';
import type { UndoEntry } from '@/lib/undo';

/**
 * Repairs made from here that can still be put back.
 *
 * ── Why this exists at all ──────────────────────────────────────────────────
 *
 * The Undo button originally lived on the finding row that produced it. That could never
 * work: applying a fix triggers a re-sweep, the re-sweep clears the finding it just fixed,
 * and the row unmounts — taking the Undo button with it in the same tick it appeared. The
 * whole reversal mechanism was verified at the API level and was unreachable in the UI.
 *
 * An undo belongs to the repair, not to the problem. The problem is gone — that was the
 * point — so the affordance has to outlive it. This reads the undo log directly, so it
 * survives sweeps, navigation and reloads, right up to the entry's 14-day TTL.
 *
 * Only shows entries that are still undoable: `listUndo` filters out spent and expired
 * ones, so an empty list here genuinely means there is nothing to put back.
 */
export default function RecentRepairs({ slug }: { slug: string }) {
  const [entries, setEntries] = useState<UndoEntry[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/manage/repair/undo?slug=${encodeURIComponent(slug)}`, {
        cache: 'no-store',
      });
      const body = (await res.json()) as { entries?: UndoEntry[] };
      setEntries(body.entries ?? []);
    } catch {
      setEntries([]);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  const undo = useCallback(
    async (id: string) => {
      setBusy(id);
      setError(null);
      setNote(null);
      try {
        const res = await fetch('/api/manage/repair/undo', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id }),
        });
        const body = await res.json();
        if (!res.ok) setError(body?.error ?? `Undo failed (${res.status})`);
        // Some undos are partial by design — an env restore rewrites .env.local but does
        // not redeploy. The route says so, and that has to reach the operator or they will
        // believe the live site changed.
        else if (body.note) setNote(body.note);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(null);
      }
    },
    [load],
  );

  // Absent rather than an empty panel: on a client you have never repaired, a "Recent
  // repairs — none" box is a permanent reminder of nothing.
  if (!entries || entries.length === 0) return null;

  return (
    <section className="panel flex flex-col gap-2 p-5">
      <h2 className="font-display text-lg font-semibold tracking-tightish text-fg">
        Recent repairs
      </h2>
      <p className="meta">Still reversible. Older than two weeks drops off.</p>

      {error && <p className="meta" style={{ color: 'var(--danger)' }}>{error}</p>}
      {note && <p className="meta" style={{ color: 'var(--warn)' }}>{note}</p>}

      <ul className="flex flex-col">
        {entries.map((e) => (
          <li
            key={e.id}
            className="flex items-start justify-between gap-3 border-b py-2 last:border-b-0"
            style={{ borderColor: 'var(--rule)' }}
          >
            <div className="min-w-0">
              <p className="text-[13px]" style={{ color: 'var(--fg-1)' }}>
                {e.summary}
              </p>
              <p className="meta mt-0.5">
                {e.siteSlug} · <span title={absoluteTime(e.ts)}>{relativeTime(e.ts)}</span>
              </p>
            </div>
            <button
              type="button"
              className="btn btn-xs shrink-0"
              onClick={() => undo(e.id)}
              disabled={busy !== null}
              title="Restore the previous value"
            >
              {busy === e.id ? (
                <SpinnerGap size={12} className="animate-spin" />
              ) : (
                <ArrowCounterClockwise size={12} />
              )}
              Undo
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
