'use client';

import { useState } from 'react';
import { CircleNotch, Warning } from '@phosphor-icons/react';
import { VERTICALS } from '@/lib/verticals';
import type { Plan } from '@/lib/types';

const PLANS: Plan[] = ['starter', 'growth', 'enterprise'];

/**
 * Create a client by hand.
 *
 * The intake queue is how clients normally arrive, but it only fires when someone finishes
 * signup. This covers the rest: a client who called instead, or one whose signup stalled
 * half-finished. It writes a real clients/<slug>/site.ts from the chosen vertical preset,
 * because a client that isn't on disk can't be picked, built, or provisioned.
 */
export default function NewClientDialog({
  onCreated,
  onClose,
}: {
  onCreated: (slug: string) => void;
  onClose: () => void;
}) {
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [plan, setPlan] = useState<Plan>('growth');
  const [vertical, setVertical] = useState(VERTICALS[0].id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slugOk = /^[A-Za-z0-9_-]+$/.test(slug.trim());
  const canSubmit = slugOk && name.trim().length > 0 && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/clients/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: slug.trim(), name: name.trim(), plan, vertical }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not create client.');
      onCreated(data.slug);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create client.');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="panel w-full max-w-md p-6 shadow-panel">
        <h3 className="font-display text-lg font-medium text-fg">New client</h3>
        <p className="mt-1 text-sm text-fg2">
          Writes <code className="codechip">clients/&lt;slug&gt;/site.ts</code> from the vertical
          preset. Everything but the name stays a placeholder for the Intake step to fill in.
        </p>

        <div className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="field-label">Display name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Arthur's Plumbing"
              className="rounded-md border border-rule bg-[var(--surface)] px-3 py-2 text-sm text-fg"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="field-label">Slug — the folder name under clients/</span>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="arthurs-plumbing"
              className="rounded-md border border-rule bg-[var(--surface)] px-3 py-2 font-mono text-sm text-fg"
            />
            {slug.trim() && !slugOk && (
              <span className="text-2xs" style={{ color: 'var(--warn)' }}>
                Letters, numbers, - and _ only.
              </span>
            )}
          </label>

          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1">
              <span className="field-label">Plan</span>
              <select
                value={plan}
                onChange={(e) => setPlan(e.target.value as Plan)}
                className="rounded-md border border-rule bg-[var(--surface)] px-3 py-2 text-sm capitalize text-fg"
              >
                {PLANS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-1 flex-col gap-1">
              <span className="field-label">Vertical</span>
              <select
                value={vertical}
                onChange={(e) => setVertical(e.target.value as typeof vertical)}
                className="rounded-md border border-rule bg-[var(--surface)] px-3 py-2 text-sm text-fg"
              >
                {VERTICALS.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {error && (
          <div
            className="mt-3 flex items-center gap-2 rounded-md border px-3 py-2 text-xs"
            style={{ borderColor: 'var(--warn)', background: 'var(--warn-glow)', color: 'var(--fg-2)' }}
          >
            <Warning size={14} weight="fill" style={{ color: 'var(--warn)' }} /> {error}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-sm" disabled={busy}>
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={!canSubmit} className="btn btn-sm btn-primary">
            {busy && <CircleNotch size={14} className="animate-spin" />}
            Create &amp; build
          </button>
        </div>
      </div>
    </div>
  );
}
