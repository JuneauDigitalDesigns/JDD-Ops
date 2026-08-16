'use client';

import { useEffect, useState } from 'react';
import type { Stage } from '@jdd/schema';
import type { ClientStatus } from '@/lib/types';
import { useClient } from './ClientProvider';

/**
 * Where this client stands, and what is stopping them moving on.
 *
 * ── It REPLACES the disk status rather than sitting beside it ───────────────
 *
 * ClientReadout used to render `ctx.detectedStatus` — "Ready to provision", "Portal +
 * checkpoints" — which is derived purely from what's on disk. The client record now carries
 * a real stage derived from disk AND the portal AND Stripe AND breakage history.
 *
 * Showing both would put two competing lifecycle answers a few pixels apart in the console
 * bar, which is exactly the disagreement this whole project set out to remove, reintroduced
 * as a UI bug. So the derived stage wins where it exists, and the disk status remains the
 * fallback for clients that have no record yet — which is honest, because for those clients
 * disk really is all we know.
 *
 * Rendered inline by ClientReadout rather than portaling into the same slot: two portals
 * into one target append by mount order, so they would race and swap places between loads.
 *
 * ── Why a blocker and not a progress bar ────────────────────────────────────
 *
 * Nine stages rendered as a track would spend most of its width on states a client left
 * months ago. The only parts anyone acts on are where they are and what is in the way.
 * `reason` is the rule that actually fired inside deriveStage, so the explanation is the
 * cause rather than a second guess at it.
 */

const STAGE_TONE: Record<Stage, string> = {
  lead: 'var(--fg-3)',
  won: 'var(--accent)',
  building: 'var(--warn)',
  provisioned: 'var(--accent)',
  live: 'var(--ok)',
  'at-risk': 'var(--warn)',
  dormant: 'var(--fg-3)',
  cancelling: 'var(--danger)',
  churned: 'var(--danger)',
};

const DISK_STATUS: Record<ClientStatus, { label: string; tone: string }> = {
  'needs-build': { label: 'Needs build', tone: 'var(--warn)' },
  ready: { label: 'Ready to provision', tone: 'var(--accent)' },
  provisioned: { label: 'Wire callback', tone: 'var(--accent)' },
  'portal-pending': { label: 'Portal + checkpoints', tone: 'var(--ok)' },
  live: { label: 'Live', tone: 'var(--ok)' },
  unknown: { label: 'Unknown', tone: 'var(--fg-3)' },
};

interface Lifecycle {
  stage: Stage | null;
  reason: string | null;
  leadId: string | null;
}

export default function LifecycleSpine() {
  const { ctx } = useClient();
  const [life, setLife] = useState<Lifecycle | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/manage/lifecycle?slug=${encodeURIComponent(ctx.slug)}`, {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const body = (await res.json()) as Lifecycle;
        if (!cancelled) setLife(body);
      } catch {
        // The spine is context, not content. A failed read falls back to the disk status
        // rather than putting an error across the top of every tool.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ctx.slug]);

  const stage = life?.stage ?? null;
  const fallback = DISK_STATUS[ctx.detectedStatus] ?? DISK_STATUS.unknown;

  const label = stage ? stage.replace('-', ' ') : fallback.label;
  const tone = stage ? (STAGE_TONE[stage] ?? 'var(--fg-3)') : fallback.tone;

  return (
    <span
      className="flex shrink-0 items-center gap-1.5"
      title={
        stage
          ? life?.reason
            ? `${label} — ${life.reason}`
            : label
          : `${fallback.label} (from disk; no client record yet)`
      }
    >
      <span
        className="h-[6px] w-[6px] shrink-0 rounded-full"
        style={{ background: tone, boxShadow: `0 0 6px ${tone}` }}
      />
      <span className="meta whitespace-nowrap capitalize">{label}</span>
      {/* The blocker, when there is one and there's room. Truncated hard: this sits in a
          bar, and a long reason pushing the utilities off-screen would be worse than not
          showing it — the full text is in the title either way. */}
      {stage && life?.reason && (
        <span className="meta hidden max-w-[22ch] truncate xl:inline" style={{ color: 'var(--fg-3)' }}>
          · {life.reason}
        </span>
      )}
    </span>
  );
}
