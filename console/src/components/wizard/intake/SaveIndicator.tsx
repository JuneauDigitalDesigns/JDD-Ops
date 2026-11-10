'use client';

/**
 * The intake's one save status (autosave, Xander 2026-11-10). Every field saves as it is typed,
 * so there is no Save button; this says whether the save landed. A failure stays on screen,
 * with the reason on hover and a retry, until a save succeeds. It was silent before.
 */
import { CheckCircle, CircleNotch, WarningCircle } from '@phosphor-icons/react';
import type { SaveStatus } from '@/lib/autosave';

export const SAVE_LABEL = {
  saved: 'Saved',
  saving: 'Saving…',
  error: 'Not saved. Retrying',
  retry: 'Retry now',
} as const;

export default function SaveIndicator({ status, onRetry }: { status: SaveStatus; onRetry: () => void }) {
  if (status.state === 'error') {
    return (
      <span
        role="alert"
        title={status.error}
        className="inline-flex shrink-0 items-center gap-2 rounded-md px-2 py-1 text-xs font-semibold"
        style={{ background: 'var(--warn-glow)', color: '#7d500f' }}
      >
        <WarningCircle size={14} weight="fill" style={{ color: 'var(--warn)' }} />
        {SAVE_LABEL.error}
        <button type="button" onClick={onRetry} className="btn btn-sm h-6 min-h-0 px-2 text-xs">{SAVE_LABEL.retry}</button>
      </span>
    );
  }
  const busy = status.state === 'pending' || status.state === 'saving';
  return (
    <span role="status" aria-live="polite" className="inline-flex shrink-0 items-center gap-1.5 font-chromeMono text-2xs text-uiFg3">
      {busy
        ? <CircleNotch size={13} className="animate-spin" />
        : <CheckCircle size={13} weight="fill" style={{ color: 'var(--ok)' }} />}
      {busy ? SAVE_LABEL.saving : SAVE_LABEL.saved}
    </span>
  );
}
