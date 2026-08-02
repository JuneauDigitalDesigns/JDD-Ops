'use client';

import { ArrowsClockwise, Warning, X } from '@phosphor-icons/react';

/**
 * "A refresh failed but the view is still good."
 *
 * The same block was copy-pasted into ClientIndex, PipelineView and OnboardTool — three
 * copies of the same warn-tinted strip, the same Retry, the same dismiss X, and three
 * chances to drift.
 *
 * The behaviour it encodes is the important part and is shared by all three: a failed
 * refresh must never replace the view. On the runbook that mattered most — a refetch runs
 * right after a provisioning run, and swapping in an error panel used to wipe the run's
 * tracker, log and outcome, hiding the actual failure. So the caller keeps its last-known
 * data, and this is the acknowledgement.
 */
export default function WarnBanner({
  message,
  onRetry,
  onDismiss,
  busy,
}: {
  message: string;
  onRetry: () => void;
  onDismiss: () => void;
  busy: boolean;
}) {
  return (
    <div
      role="status"
      className="flex shrink-0 items-center gap-2 border-b px-6 py-2"
      style={{ borderColor: 'var(--warn)', background: 'var(--warn-glow)' }}
    >
      <Warning size={14} weight="fill" style={{ color: 'var(--warn)', flexShrink: 0 }} />
      <span className="text-xs text-fg2">{message} Showing the last-known client data.</span>
      <button type="button" onClick={onRetry} className="btn btn-xs ml-auto" disabled={busy}>
        <ArrowsClockwise size={12} className={busy ? 'animate-spin' : undefined} /> Retry
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="rounded p-1 text-fg3 hover:text-fg"
      >
        <X size={13} />
      </button>
    </div>
  );
}
