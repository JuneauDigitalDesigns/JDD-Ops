'use client';

import { useState } from 'react';
import { CircleNotch, Warning } from '@phosphor-icons/react';
import { VERTICALS } from '@/lib/verticals';
import { slugify } from '@/lib/slugify';
import type { QueuedLead } from '@/lib/leadTypes';
import type { Plan } from '@/lib/types';

const PLANS: Plan[] = ['starter', 'growth', 'enterprise'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Convert a won lead into a client.
 *
 * Prefilled from the lead, and deliberately strict about the two things a lead can't be trusted
 * to have: a plan (planInterest is often null, and there is no default to guess) and an email
 * (the join key to the client's portal account, which is what later unlocks Build).
 *
 * Creating the client does not start any build. The new client waits on the agency-site
 * onboarding; Manage is where the welcome email goes out.
 */
export default function ConvertDialog({
  lead,
  onConverted,
  onClose,
}: {
  lead: QueuedLead;
  onConverted: (slug: string) => void;
  onClose: () => void;
}) {
  const [slug, setSlug] = useState(slugify(lead.businessName));
  const [email, setEmail] = useState(lead.email ?? '');
  const [plan, setPlan] = useState<Plan | ''>(lead.planInterest ?? '');
  const [vertical, setVertical] = useState(VERTICALS[0].id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slugOk = /^[A-Za-z0-9_-]+$/.test(slug.trim());
  const emailOk = EMAIL_RE.test(email.trim());
  const canSubmit = slugOk && emailOk && plan !== '' && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/leads/convert', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: lead.id,
          slug: slug.trim(),
          email: email.trim(),
          plan,
          vertical,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { slug?: string; error?: string };
      if (!res.ok || !data.slug) throw new Error(data.error ?? 'Could not convert this lead.');
      onConverted(data.slug);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not convert this lead.');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
      <div role="dialog" aria-modal="true" className="panel w-full max-w-md p-6 shadow-panel">
        <h3 className="font-display text-lg font-medium text-fg">Convert to client</h3>
        <p className="mt-1 text-sm text-fg2">
          Creates <code className="codechip">clients/&lt;slug&gt;/site.ts</code> for{' '}
          <span className="font-medium text-fg">{lead.businessName}</span>. Build and Onboard stay
          locked until they finish onboarding on the site.
        </p>

        <div className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="field-label">Email, used to match their portal account</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@business.com"
              className="rounded-md border border-rule bg-[var(--surface)] px-3 py-2 text-sm text-fg"
            />
            {email.trim() && !emailOk && (
              <span className="text-2xs" style={{ color: 'var(--warn)' }}>
                That doesn&apos;t look like an email address.
              </span>
            )}
          </label>

          <label className="flex flex-col gap-1">
            <span className="field-label">Slug, the folder name under clients/</span>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
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
                {plan === '' && (
                  <option value="" disabled>
                    Choose a plan
                  </option>
                )}
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
            Convert to client
          </button>
        </div>
      </div>
    </div>
  );
}
