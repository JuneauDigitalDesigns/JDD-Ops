'use client';

import { relativeTime } from '@/lib/relativeTime';
import type { ClientHealth } from '@/lib/health';

/**
 * Live health for one client on the picker list: is the site up, and when did it last ship.
 *
 * The roster that used to carry this lived at /manage and is gone — the picker replaced it.
 * Losing the signal entirely would have been a real regression: "is anything down" is a
 * question you want answered before you pick who to work on, not after.
 *
 * Deliberately narrow and quiet. It renders nothing for a client with no health entry,
 * which is every client that isn't provisioned yet — most of the board, early on.
 */

export default function ClientHealthCell({ health }: { health: ClientHealth | undefined }) {
  if (!health || (!health.http && !health.deploy)) return null;

  const up = health.http?.ok ?? null;
  const color = up === null ? 'var(--fg-3)' : up ? 'var(--ok)' : 'var(--danger)';
  const label =
    up === null
      ? 'no probe'
      : up
        ? 'up'
        : health.http?.status
          ? String(health.http.status)
          : 'down';

  return (
    <div className="hidden shrink-0 flex-col items-end gap-1 lg:flex" style={{ width: 92 }}>
      <span className="flex items-center gap-1.5">
        <span
          className="h-[6px] w-[6px] shrink-0 rounded-full"
          style={{ background: color, boxShadow: `0 0 7px 1px ${color}` }}
        />
        <span className="text-2xs font-medium" style={{ color }}>
          {label}
        </span>
      </span>
      {health.deploy?.createdAt && (
        <span className="meta">
          shipped {relativeTime(health.deploy.createdAt)}
        </span>
      )}
    </div>
  );
}
