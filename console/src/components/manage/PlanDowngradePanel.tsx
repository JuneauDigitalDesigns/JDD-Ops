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
import { useManage } from './ManageContext';
import type { PlanDowngradePreview } from '@/lib/planDowngrade';
import type { StepResult } from '@/lib/teardownOps';

/**
 * Growth → starter, in two steps that happen weeks apart.
 *
 *   1. Billing. "Email the client the Starter terms" asks the agency to send them the link
 *      (contract v5.3 §15.2: they accept a new agreement). Their acceptance schedules the change
 *      in Stripe for the end of the period they've paid for, with no credit (§15.4). The portal
 *      record moves to starter when it lands. The console never touches Stripe.
 *   2. Env and site.ts. Once the portal shows starter: preview → typed confirmation → results,
 *      which turns LEAD_CALLBACK off and moves site.ts. Nothing is released or deleted; Starter
 *      runs the same voice stack as Growth.
 *
 * Step 2 used to run at once and flip the portal record too, so the client lost Growth on the
 * day it was asked for. Its copy also still described releasing the number and deleting the
 * agent, which the route stopped doing after the 2026-10-12 reprice.
 */

interface RequestState {
  recordPlan?: string;
  email?: string;
  planChange?: {
    status: 'awaiting-acceptance' | 'scheduled' | 'done' | 'cancelled';
    effectiveAt: number;
  } | null;
  error?: string;
}

function day(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

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
  const { confirmWrite } = useManage();
  const [preview, setPreview] = useState<PlanDowngradePreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [confirming, setConfirming] = useState(false);
  const [confirmSlug, setConfirmSlug] = useState('');

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ExecuteResponse | null>(null);
  const [billing, setBilling] = useState<RequestState | null>(null);
  const [billingBusy, setBillingBusy] = useState(false);

  const loadBilling = useCallback(async () => {
    try {
      const res = await fetch(`/api/manage/plan/downgrade/request?slug=${encodeURIComponent(slug)}`, { cache: 'no-store' });
      setBilling((await res.json()) as RequestState);
    } catch (err) {
      setBilling({ error: err instanceof Error ? err.message : 'Could not read the billing state.' });
    }
  }, [slug]);

  useEffect(() => {
    void loadBilling();
  }, [loadBilling]);

  async function billingAction(method: 'POST' | 'DELETE') {
    const ok = await confirmWrite(
      method === 'POST'
        ? {
            title: 'Email the client the Starter terms',
            effect: `Emails ${billing?.email ?? 'the client'} a link to accept the Starter terms. When they accept, Stripe moves ${slug} to Starter at the end of the period they have paid for. Nothing is charged or credited.`,
          }
        : {
            title: 'Withdraw the downgrade',
            effect: `Cancels the pending downgrade for ${slug}. If the client already accepted, the Stripe schedule is released and they stay on Growth.`,
          },
    );
    if (!ok) return;
    setBillingBusy(true);
    try {
      const res = await fetch('/api/manage/plan/downgrade/request', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      const body = (await res.json()) as RequestState;
      if (body.error) setBilling((b) => ({ ...(b ?? {}), error: body.error }));
      else await loadBilling();
    } finally {
      setBillingBusy(false);
    }
  }

  // Step 2 waits for the change to land on the portal record. A client with no portal account
  // (the request route answers with an error and no recordPlan) has no portal billing to wait for.
  const pending =
    billing?.planChange &&
    (billing.planChange.status === 'awaiting-acceptance' || billing.planChange.status === 'scheduled')
      ? billing.planChange
      : null;
  const landed = billing?.recordPlan === 'starter' || Boolean(billing?.error && !billing.recordPlan);

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
    if (
      !(await confirmWrite({
        title: 'Switch env and site.ts to starter',
        effect: `Turns LEAD_CALLBACK off and moves site.ts for ${slug} to starter, then redeploys. Nothing is released or deleted.`,
      }))
    ) {
      return;
    }
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
          <SpinnerGap size={13} className="animate-spin" /> Updating env and site.ts, then redeploying…
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

          <section className="mb-4 flex flex-col gap-2 border-b border-rule pb-4">
            <span className="kicker">1 · Billing</span>
            {!billing && <span className="text-xs text-fg3">Reading the portal record…</span>}
            {billing?.error && (
              <span className="flex items-start gap-2 text-xs" style={{ color: 'var(--warn)' }}>
                <Warning size={12} className="mt-0.5 shrink-0" /> {billing.error}
              </span>
            )}
            {billing && !billing.error && billing.recordPlan === 'starter' && (
              <span className="text-xs text-fg2">The portal record is on starter: the change has taken effect.</span>
            )}
            {billing && !billing.error && billing.recordPlan !== 'starter' && !pending && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-fg2">
                  Not requested. The client accepts the Starter terms, and Stripe moves them at the end of their paid period.
                </span>
                <button type="button" className="btn btn-sm shrink-0" disabled={billingBusy} onClick={() => void billingAction('POST')}>
                  Email the client the Starter terms
                </button>
              </div>
            )}
            {pending && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-fg2">
                  {pending.status === 'awaiting-acceptance'
                    ? `Waiting for ${billing?.email} to accept. Once they do, it takes effect on ${day(pending.effectiveAt)}.`
                    : `Scheduled: Stripe moves ${billing?.email} to Starter on ${day(pending.effectiveAt)}. The portal follows.`}
                </span>
                <div className="flex shrink-0 gap-2">
                  {pending.status === 'awaiting-acceptance' && (
                    <button type="button" className="btn btn-sm" disabled={billingBusy} onClick={() => void billingAction('POST')}>
                      Resend
                    </button>
                  )}
                  <button type="button" className="btn btn-sm" disabled={billingBusy} onClick={() => void billingAction('DELETE')}>
                    Withdraw
                  </button>
                </div>
              </div>
            )}
          </section>

          {!loading && preview && (
            <div className="flex flex-col gap-4">
              <span className="kicker">2 · Env and site.ts</span>
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
                <span className="kicker">Voice stack (kept, verified)</span>
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
                  Nothing is destroyed. The site, its repo, the Vercel project, the domain, the
                  Twilio number and the Retell agent are all untouched — Starter runs the same
                  voice stack as Growth.
                </span>
              </section>

              <section className="flex flex-col gap-1">
                <span className="kicker">What actually changes</span>
                <ul className="text-xs text-fg2 flex flex-col gap-1">
                  <li>
                    Web forms drop straight into the portal inbox — the agent no longer calls the
                    submitter back first.
                  </li>
                  <li>CRM access is withdrawn; the Inbox stays.</li>
                  <li>The included-minutes allowance moves to the Starter cap.</li>
                </ul>
              </section>

              <div className="flex items-center justify-between gap-2">
                <button type="button" onClick={() => void loadPreview()} className="btn btn-sm">
                  <ArrowsClockwise size={13} /> Refresh
                </button>
                <div className="flex gap-2">
                  <button type="button" className="btn btn-sm" onClick={onClose}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    disabled={!landed}
                    title={landed ? undefined : 'Runs once the portal record shows starter'}
                    onClick={() => setConfirming(true)}
                  >
                    <Warning size={13} weight="fill" /> Switch env and site.ts
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
            <h4 className="mb-3 font-display text-base font-medium">Switch {slug} to starter?</h4>
            <p className="mb-4 text-xs leading-[1.6] text-fg2">
              Turns LEAD_CALLBACK off and moves site.ts to starter, then redeploys. The number, the
              agent, its LLM and the Airtable base all stay.
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
                <Warning size={13} weight="fill" /> Yes, switch {slug}
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
