'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowsClockwise,
  CheckCircle,
  Circle,
  SpinnerGap,
  Warning,
  X,
  XCircle,
} from '@phosphor-icons/react';
import type { PlanDowngradePreview } from '@/lib/planDowngrade';
import type { StepResult } from '@/lib/teardownOps';

/**
 * The confirm flow for growth → starter. Same three states as DangerSection —
 * preview → typed confirmation → step results — scoped to the two resources a downgrade
 * actually destroys, and presented as a modal because it's launched from the plan pill
 * rather than from a nav section.
 *
 * The Airtable line is rendered in the neutral "kept" voice on purpose: an operator
 * scanning a destructive dialog should be able to see at a glance what is NOT going away.
 */

interface ExecuteResponse {
  ok?: boolean;
  error?: string;
  steps?: StepResult[];
  staleOnVercel?: string[];
  syncError?: string;
  redeploy?: { ok: boolean; error?: string };
  note?: string;
}

export default function PlanDowngradePanel({
  slug,
  onClose,
  onDone,
}: {
  slug: string;
  onClose: () => void;
  /** Called after a successful downgrade so the caller can refresh server state. */
  onDone: () => void;
}) {
  const [preview, setPreview] = useState<PlanDowngradePreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [confirming, setConfirming] = useState(false);
  const [confirmSlug, setConfirmSlug] = useState('');

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ExecuteResponse | null>(null);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/manage/plan/downgrade/preview?slug=${encodeURIComponent(slug)}`, {
        cache: 'no-store',
      });
      const body = (await res.json()) as { preview?: PlanDowngradePreview; error?: string };
      if (body.error) setLoadError(body.error);
      setPreview(body.preview ?? null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load the downgrade preview.');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  // Escape closes, except mid-run — interrupting the dialog while three destroy calls are
  // in flight would hide the only report of what happened.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !running) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, running]);

  async function execute() {
    if (!preview) return;
    setConfirming(false);
    setRunning(true);
    try {
      const res = await fetch('/api/manage/plan/downgrade/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, previewHash: preview.previewHash, confirmSlug }),
      });
      const body = (await res.json()) as ExecuteResponse;
      setResult(body);
      if (body.ok) onDone();
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : 'Downgrade failed.' });
    } finally {
      setRunning(false);
    }
  }

  const canArm = Boolean(preview) && confirmSlug === slug;

  return (
    <Overlay onClose={running ? () => {} : onClose}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-lg font-medium">
          {result ? 'Downgrade finished' : running ? 'Downgrading…' : `Downgrade ${preview?.brandName ?? slug} to starter?`}
        </h3>
        <button
          type="button"
          onClick={onClose}
          disabled={running}
          className="text-fg3 hover:text-fg disabled:opacity-40"
        >
          <X size={18} />
        </button>
      </div>

      {/* ── Result ─────────────────────────────────────────────────────────── */}
      {result && (
        <div className="flex flex-col gap-3">
          {result.error && (
            <span className="flex items-center gap-2 text-xs" style={{ color: 'var(--danger)' }}>
              <Warning size={13} weight="fill" /> {result.error}
            </span>
          )}
          {result.steps?.map((s, i) => (
            <div key={i} className="flex items-center gap-2 border-b border-rule pb-2 text-xs last:border-b-0">
              {s.outcome === 'deleted' || s.outcome === 'already-gone' ? (
                <CheckCircle size={14} weight="fill" style={{ color: 'var(--ok)' }} />
              ) : s.outcome === 'skipped' ? (
                <Circle size={14} style={{ color: 'var(--fg-3)' }} />
              ) : (
                <XCircle size={14} weight="fill" style={{ color: 'var(--danger)' }} />
              )}
              <span className="min-w-0 flex-1 truncate text-fg2">
                {s.resource}
                {s.target && s.target !== '—' ? ` — ${s.target}` : ''}
              </span>
              <span className="mono shrink-0 text-2xs text-fg3">{s.outcome}</span>
            </div>
          ))}
          {result.note && <p className="text-xs leading-[1.6] text-fg2">{result.note}</p>}
          {result.staleOnVercel && result.staleOnVercel.length > 0 && (
            <p className="text-xs leading-[1.6] text-fg3">
              {result.staleOnVercel.join(', ')} still exist on the Vercel project — the sync skips
              empty values and there's no delete. They're inert now that LEAD_DELIVERY_MODE is
              <code className="codechip">email</code>; remove them in the Vercel dashboard if you
              want them gone.
            </p>
          )}
          {result.syncError && (
            <span className="flex items-center gap-2 text-xs" style={{ color: 'var(--warn)' }}>
              <Warning size={12} /> Vercel sync: {result.syncError}
            </span>
          )}
          {result.redeploy && !result.redeploy.ok && result.redeploy.error && (
            <span className="flex items-center gap-2 text-xs" style={{ color: 'var(--warn)' }}>
              <Warning size={12} /> Redeploy: {result.redeploy.error}
            </span>
          )}
          <div className="flex justify-end">
            <button type="button" className="btn btn-sm" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* ── Running ────────────────────────────────────────────────────────── */}
      {!result && running && (
        <p className="flex items-center gap-2 text-xs text-fg3">
          <SpinnerGap size={13} className="animate-spin" /> Releasing the Twilio number and deleting
          the Retell agent…
        </p>
      )}

      {/* ── Preview ────────────────────────────────────────────────────────── */}
      {!result && !running && (
        <>
          {loading && <p className="text-xs text-fg3">Verifying what actually exists…</p>}

          {!loading && (loadError || !preview) && (
            <div className="flex flex-col gap-3">
              <span className="flex items-center gap-2 text-xs" style={{ color: 'var(--danger)' }}>
                <Warning size={13} /> {loadError ?? 'Could not build a preview for this client.'}
              </span>
              <div className="flex justify-end">
                <button type="button" className="btn btn-sm" onClick={onClose}>
                  Close
                </button>
              </div>
            </div>
          )}

          {!loading && preview && (
            <div className="flex flex-col gap-4">
              {preview.warnings.length > 0 && (
                <div className="flex flex-col gap-1">
                  {preview.warnings.map((w) => (
                    <span key={w} className="flex items-start gap-2 text-xs" style={{ color: 'var(--warn)' }}>
                      <Warning size={12} className="mt-0.5 shrink-0" /> {w}
                    </span>
                  ))}
                </div>
              )}

              <section className="flex flex-col gap-1">
                <span className="kicker">Will be destroyed</span>
                <ResourceRow label="Twilio number" name={preview.twilio.number ?? '—'} exists={preview.twilio.owned} />
                <ResourceRow label="Retell agent" name={preview.retell.agentId ?? '—'} exists={preview.retell.agentExists} />
                <ResourceRow label="Retell LLM" name={preview.retell.llmId ?? '—'} exists={preview.retell.llmId ? true : null} />
              </section>

              <section className="flex flex-col gap-1">
                <span className="kicker">Kept</span>
                <span className="text-xs text-fg2">
                  {preview.airtable.baseId
                    ? `Airtable base ${preview.airtable.baseName ? `${preview.airtable.baseName} (${preview.airtable.baseId})` : preview.airtable.baseId} — kept, along with its Call Log history.`
                    : 'No Airtable base on this client.'}
                </span>
                <span className="text-xs text-fg2">
                  The site, its repo, the Vercel project, and the domain are untouched. Only the
                  voice tier is removed.
                </span>
              </section>

              <section className="flex flex-col gap-1">
                <span className="kicker">Lead capture becomes</span>
                <span className="text-xs text-fg2">
                  Resend email to{' '}
                  {preview.leadEmail.to ? (
                    <code className="codechip">{preview.leadEmail.to}</code>
                  ) : (
                    <span style={{ color: 'var(--warn)' }}>nowhere — no brand.email in site.ts</span>
                  )}
                  {!preview.leadEmail.resendKeySet && ' (once RESEND_API_KEY is set in Environment)'}.
                </span>
              </section>

              <div className="flex items-center justify-between gap-2">
                <button type="button" onClick={() => void loadPreview()} className="btn btn-sm">
                  <ArrowsClockwise size={13} /> Refresh
                </button>
                <div className="flex gap-2">
                  <button type="button" className="btn btn-sm" onClick={onClose}>
                    Cancel
                  </button>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => setConfirming(true)}>
                    <Warning size={13} weight="fill" /> Downgrade to starter
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Typed confirmation ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {confirming && preview && (
          <motion.div
            className="absolute inset-0 flex flex-col justify-center rounded-[inherit] p-6"
            style={{ background: 'var(--bg)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <h4 className="mb-3 font-display text-base font-medium">Release these for real?</h4>
            <p className="mb-4 text-xs leading-[1.6] text-fg2">
              The Twilio number is returned to the pool and <strong>cannot be re-acquired</strong> —
              re-upgrading later gets a different number. The Retell agent and its LLM are deleted,
              including the tuned prompt. The Airtable base is kept.
            </p>
            <label className="mb-4 block">
              <span className="field-label">
                Type <code className="codechip">{slug}</code> to confirm
              </span>
              <input
                type="text"
                value={confirmSlug}
                onChange={(e) => setConfirmSlug(e.target.value)}
                spellCheck={false}
                autoFocus
              />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-sm" onClick={() => setConfirming(false)}>
                Back
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                disabled={!canArm}
                onClick={() => void execute()}
              >
                <Warning size={13} weight="fill" /> Yes, downgrade {slug}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Overlay>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center p-6"
      style={{ background: 'rgba(4,8,18,0.86)', backdropFilter: 'blur(8px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="panel relative w-full max-w-[560px] p-6"
        initial={{ scale: 0.96, y: 8 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

/** Same three-state glyph vocabulary DangerSection uses: exists / gone / couldn't verify. */
function ResourceRow({ label, name, exists }: { label: string; name: string; exists: boolean | null }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {exists === true ? (
        <CheckCircle size={12} weight="fill" style={{ color: 'var(--ok)' }} />
      ) : exists === false ? (
        <Circle size={12} style={{ color: 'var(--fg-3)' }} />
      ) : (
        <Warning size={12} style={{ color: 'var(--fg-3)' }} />
      )}
      <span className="w-[110px] shrink-0 text-fg3">{label}</span>
      <span className="min-w-0 flex-1 truncate text-fg2" title={name}>
        {exists === false ? <span className="text-fg3">not found</span> : name}
      </span>
    </div>
  );
}
