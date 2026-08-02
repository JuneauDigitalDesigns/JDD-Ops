'use client';

import { useState } from 'react';
import { CircleNotch, Warning } from '@phosphor-icons/react';
import type { IntakeSummary } from '@/lib/useIntakeQueue';

/**
 * Slug confirmation before the import writes anything.
 *
 * The queue's guess is usually right, but this creates the folder every downstream tool keys
 * off — the repo name, the Vercel project, the portal account record all derive from it — and
 * renaming it later means re-provisioning. So it gets one look.
 */
export default function IntakeImportDialog({
  intake,
  onConfirm,
  onClose,
}: {
  intake: IntakeSummary;
  /** Resolves to null on success, or a message to display. */
  onConfirm: (slug: string, overwrite: boolean) => Promise<string | null>;
  onClose: () => void;
}) {
  const [slug, setSlug] = useState(intake.slugGuess || '');
  const [overwrite, setOverwrite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = /^[A-Za-z0-9_-]+$/.test(slug.trim());

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    const message = await onConfirm(slug.trim(), overwrite);
    if (message) {
      setError(message);
      setBusy(false);
      return;
    }
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Import ${intake.brandName}`}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="panel w-full max-w-md p-6 shadow-overlay">
        <h3 className="font-display text-lg font-semibold text-fg">
          Import “{intake.brandName}”
        </h3>
        <p className="mt-1 text-sm text-fg2">
          Confirm the client slug — this creates{' '}
          <code className="codechip">clients/&lt;slug&gt;/site.ts</code> and turns this signup
          into a client you can build.
        </p>

        <label className="mt-4 block">
          <span className="field-label">Slug</span>
          <input
            type="text"
            value={slug}
            autoFocus
            onChange={(e) => setSlug(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
            // font-mono, not the .mono-field class: that one is scoped to `.manage-chrome
            // input.mono-field` in globals.css and does nothing out here on the index. A slug
            // is a machine value — it needs to be mono so a typo'd character is visible.
            className="input font-mono"
          />
        </label>
        {!valid && slug.trim() !== '' && (
          <p className="meta mt-1.5" style={{ color: 'var(--warn)' }}>
            Letters, numbers, hyphens and underscores only.
          </p>
        )}

        <label className="mt-3 flex items-center gap-2 text-sm text-fg2">
          <input
            type="checkbox"
            checked={overwrite}
            onChange={(e) => setOverwrite(e.target.checked)}
          />
          Overwrite if it already exists
        </label>

        {error && (
          <div
            className="mt-4 flex items-start gap-2 rounded-[8px] border px-3 py-2 text-xs"
            style={{
              borderColor: 'var(--warn)',
              background: 'var(--warn-glow)',
              color: 'var(--fg-2)',
            }}
          >
            <Warning size={14} weight="fill" style={{ color: 'var(--warn)', flexShrink: 0 }} />
            {error}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="btn btn-sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!valid || busy}
            className="btn btn-sm btn-primary"
          >
            {busy && <CircleNotch size={13} className="animate-spin" />}
            Import
          </button>
        </div>
      </div>
    </div>
  );
}
