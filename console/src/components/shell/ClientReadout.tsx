'use client';

import type { ClientStatus } from '@/lib/types';
import { useClient } from '@/components/client/ClientProvider';
import { ReadoutSlot } from './slots';

/**
 * The CONTEXT zone: which client you're working on, stated once and never again.
 *
 * ── Deliberately inert ──────────────────────────────────────────────────────────────────
 * Nothing in here is clickable — not the slug, not the status dot. The bar's rule is that
 * the left navigates and the right past the hairline is utilities; a lone link buried in
 * the middle of a read-only cluster is exactly the kind of thing that made the old bar
 * confusing. Switching clients is ⌘K or the mark.
 *
 * ── Deliberately not badges ─────────────────────────────────────────────────────────────
 * PlanChip and StatusBadge both render pills. Pills read as interactive and carry weight,
 * and this cluster's whole job is to be legible without competing with the controls to its
 * left. So plan and status render as plain .meta text here. Both components survive
 * unchanged on the client cards, where a pill IS the right call
 * because it's the primary thing in its row.
 *
 * The one non-text element is the status dot, which is doing real work: color-coded state
 * is scannable at a glance in a way a word never is.
 */

const STATUS: Record<ClientStatus, { label: string; tone: string }> = {
  'needs-build': { label: 'Needs build', tone: 'var(--warn)' },
  ready: { label: 'Ready to provision', tone: 'var(--accent)' },
  provisioned: { label: 'Wire callback', tone: 'var(--accent)' },
  'portal-pending': { label: 'Portal + checkpoints', tone: 'var(--ok)' },
  live: { label: 'Live', tone: 'var(--ok)' },
  unknown: { label: 'Unknown', tone: 'var(--fg-3)' },
};

export default function ClientReadout() {
  const { ctx } = useClient();
  const status = STATUS[ctx.detectedStatus] ?? STATUS.unknown;

  return (
    <ReadoutSlot>
      {/* aria-hidden: the bar's <title> and the page heading already name the client, and
          a screen reader announcing "arthur-plumbing growth live" on every navigation is
          noise. This is a visual convenience. */}
      <div className="flex min-w-0 items-center gap-2 pr-1" aria-hidden>
        <span className="meta truncate" title={ctx.brandName} style={{ color: 'var(--fg-2)' }}>
          {ctx.slug}
        </span>

        <Dot />
        <span className="meta shrink-0">{ctx.plan}</span>

        <Dot />
        <span className="flex shrink-0 items-center gap-1.5">
          <span
            className="h-[6px] w-[6px] shrink-0 rounded-full"
            style={{ background: status.tone, boxShadow: `0 0 6px ${status.tone}` }}
          />
          <span className="meta whitespace-nowrap">{status.label}</span>
        </span>
      </div>
    </ReadoutSlot>
  );
}

/** Separator. A middot rather than a rule — three hairlines in one cluster reads as a table. */
function Dot() {
  return (
    <span className="shrink-0 select-none text-fg3/50" style={{ fontSize: 11 }}>
      ·
    </span>
  );
}
