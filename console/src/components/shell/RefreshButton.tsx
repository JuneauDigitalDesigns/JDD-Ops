'use client';

import { ArrowsClockwise } from '@phosphor-icons/react';
import { UtilitySlot } from './slots';

/**
 * "Reload what I'm looking at", in the navbar's utility cluster.
 *
 * Refresh is a UTILITY, not a page action — it's the same class of thing as ⌘K and the
 * settings gear, which is why it sits with them rather than in the per-tool strip. The
 * alternative was worse: / had it in the bar and /pipeline had it in the toolbar, so the
 * same icon lived in two places depending on which route you were on.
 *
 * Icon-only. It's a verb everyone already knows, and the label was the widest thing in
 * the cluster.
 */
export default function RefreshButton({
  onClick,
  busy,
}: {
  onClick: () => void;
  busy: boolean;
}) {
  return (
    <UtilitySlot>
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        title="Refresh"
        aria-label="Refresh"
        className="flex h-7 w-7 items-center justify-center rounded-[6px] text-fg3 transition-colors hover:bg-[var(--surface-2)] hover:text-fg disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ArrowsClockwise size={15} className={busy ? 'animate-spin' : undefined} />
      </button>
    </UtilitySlot>
  );
}
