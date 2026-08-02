'use client';
// One lead, opened.
//
// This is the screen that stops the board being a parking lot. Everything here is a thing
// you DO — hear the call, ring them back, send them the paperwork, record why it died —
// rather than a field you maintain.

import { useEffect, useState } from 'react';
import {
  ArrowSquareOut, Copy, EnvelopeSimple, Phone, X,
} from '@phosphor-icons/react';
import { LEAD_COLOR, LEAD_LABEL } from '@/lib/lead-meta';
import { LEAD_STAGES, type DemoCall, type LeadStage, type QueuedLead } from '@/lib/leadTypes';
import { absoluteTime, relativeTime } from '@/lib/relativeTime';

const PLAN_LABEL: Record<string, string> = {
  starter: 'Starter',
  growth: 'Growth',
  enterprise: 'Enterprise',
};

function formatDuration(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms)) return '—';
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}m ${String(total % 60).padStart(2, '0')}s`;
}

/**
 * Where to send someone who's ready.
 *
 * /pricing does NOT read a `plan` query param — the site's own pricing buttons navigate to
 * /agreement?plan={slug}, so that is the only link that actually preselects anything. With
 * no stated plan interest we send them to /pricing to choose, because deep-linking someone
 * into an agreement for a tier they never named is presumptuous.
 */
function signupUrl(siteUrl: string, plan: string | null): string {
  const base = siteUrl.replace(/\/$/, '');
  return plan ? `${base}/agreement?plan=${plan}` : `${base}/pricing`;
}

export default function LeadModal({
  lead, call, siteUrl, onClose, onPatch,
}: {
  lead: QueuedLead;
  call: DemoCall | null;
  siteUrl: string;
  onClose: () => void;
  onPatch: (patch: { stage?: LeadStage; notes?: string; lostReason?: string }) => Promise<void>;
}) {
  const [notes, setNotes] = useState(lead.notes ?? '');
  const [lostReason, setLostReason] = useState(lead.lostReason ?? '');
  const [askLost, setAskLost] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const notesDirty = notes !== (lead.notes ?? '');

  async function run(patch: Parameters<typeof onPatch>[0]) {
    setBusy(true);
    try {
      await onPatch(patch);
    } finally {
      setBusy(false);
    }
  }

  async function copyPhone() {
    try {
      await navigator.clipboard.writeText(lead.phone);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — the tel: link is still right there */
    }
  }

  const fromCall = lead.source === 'call';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(20,18,12,0.42)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${lead.businessName} — lead`}
        className="panel relative flex max-h-[86vh] w-full max-w-[620px] flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-rule px-5 py-4">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="truncate font-display text-xl font-semibold leading-none tracking-tightish">
              {lead.businessName}
            </h2>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-fg2">
              <span>{lead.name}</span>
              <span className="text-fg3">·</span>
              <span className="flex items-center gap-1 text-fg3">
                {fromCall ? <Phone size={11} weight="fill" /> : <EnvelopeSimple size={11} />}
                {fromCall ? 'Called the demo' : 'Interest form'}
              </span>
              {lead.planInterest && (
                <>
                  <span className="text-fg3">·</span>
                  <span style={{ color: 'var(--accent)' }}>
                    {PLAN_LABEL[lead.planInterest] ?? lead.planInterest}
                  </span>
                </>
              )}
              <span className="text-fg3">·</span>
              <span className="text-fg3" title={absoluteTime(lead.receivedAt)}>
                {relativeTime(lead.receivedAt)}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-auto shrink-0 rounded p-1 text-fg3 hover:text-fg"
          >
            <X size={16} />
          </button>
        </div>

        <div className="no-scrollbar flex-1 overflow-y-auto px-5 py-4">
          {/* Primary actions */}
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <a href={`tel:${lead.phone.replace(/[^\d+]/g, '')}`} className="btn btn-sm btn-primary">
              <Phone size={13} weight="fill" /> {lead.phone}
            </a>
            <button type="button" onClick={copyPhone} className="btn btn-sm">
              <Copy size={13} /> {copied ? 'Copied' : 'Copy'}
            </button>
            <a
              href={signupUrl(siteUrl, lead.planInterest)}
              target="_blank"
              rel="noreferrer"
              className="btn btn-sm"
              title={
                lead.planInterest
                  ? `Opens the agreement prefilled with ${lead.planInterest}`
                  : 'No stated plan — opens pricing so they can choose'
              }
            >
              <ArrowSquareOut size={13} /> Send signup link
            </a>
          </div>

          {/* The call — the reason a call lead is worth more than a form lead */}
          {fromCall && (
            <section className="mb-5">
              <h3 className="meta mb-2">The call</h3>
              {call ? (
                <div className="flex flex-col gap-3 rounded-[10px] border border-rule p-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg2">
                    <span>{formatDuration(call.durationMs)}</span>
                    {call.outcome && (
                      <>
                        <span className="text-fg3">·</span>
                        <span>{call.outcome}</span>
                      </>
                    )}
                    {call.disconnectionReason && (
                      <>
                        <span className="text-fg3">·</span>
                        <span className="text-fg3">{call.disconnectionReason}</span>
                      </>
                    )}
                  </div>
                  {call.recordingUrl ? (
                    // eslint-disable-next-line jsx-a11y/media-has-caption
                    <audio controls preload="none" src={call.recordingUrl} className="w-full" />
                  ) : (
                    <p className="text-xs text-fg3">No recording on this call.</p>
                  )}
                  {call.summary && (
                    <p className="whitespace-pre-wrap text-xs leading-relaxed text-fg2">
                      {call.summary}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-fg3">
                  The call record for this lead isn&apos;t in the queue anymore.
                </p>
              )}
            </section>
          )}

          {lead.note && (
            <section className="mb-5">
              <h3 className="meta mb-2">What they said</h3>
              <p className="whitespace-pre-wrap rounded-[10px] border border-rule p-3 text-xs leading-relaxed text-fg2">
                {lead.note}
              </p>
            </section>
          )}

          {/* Stage */}
          <section className="mb-5">
            <h3 className="meta mb-2">Stage</h3>
            <div className="flex flex-wrap gap-1.5">
              {LEAD_STAGES.map((s) => {
                const active = lead.stage === s;
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (active) return;
                      // Losing a deal should cost one more keystroke than winning one —
                      // the reason is the only thing a dead lead can still teach you.
                      if (s === 'lost') setAskLost(true);
                      else run({ stage: s });
                    }}
                    className="rounded-[7px] border px-2.5 py-1 text-xs transition-colors disabled:opacity-50"
                    style={{
                      borderColor: active ? LEAD_COLOR[s] : 'var(--rule)',
                      background: active ? 'var(--accent-glow)' : 'transparent',
                      color: active ? LEAD_COLOR[s] : 'var(--fg-2)',
                    }}
                  >
                    {LEAD_LABEL[s]}
                  </button>
                );
              })}
            </div>

            {lead.convertedSlug && (
              <p className="mt-2 text-xs" style={{ color: 'var(--ok)' }}>
                Became a client — <span className="mono">{lead.convertedSlug}</span>
              </p>
            )}

            {askLost && (
              <div className="mt-3 flex flex-col gap-2 rounded-[10px] border p-3" style={{ borderColor: 'var(--rule)' }}>
                <label className="meta" htmlFor="lost-reason">Why did it die?</label>
                <input
                  id="lost-reason"
                  value={lostReason}
                  onChange={(e) => setLostReason(e.target.value)}
                  placeholder="Price, timing, went with someone else…"
                  className="w-full rounded-[7px] border border-rule bg-transparent px-2.5 py-1.5 text-xs"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={busy}
                    onClick={async () => {
                      await run({ stage: 'lost', lostReason });
                      setAskLost(false);
                    }}
                  >
                    Mark lost
                  </button>
                  <button type="button" className="btn btn-sm" onClick={() => setAskLost(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {lead.lostReason && !askLost && (
              <p className="mt-2 text-xs text-fg3">Lost — {lead.lostReason}</p>
            )}
          </section>

          {/* Notes */}
          <section className="mb-5">
            <h3 className="meta mb-2">Notes</h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="What you learned, what you promised, what's next."
              className="w-full rounded-[8px] border border-rule bg-transparent p-2.5 text-xs leading-relaxed"
            />
            {notesDirty && (
              <button
                type="button"
                className="btn btn-sm mt-2"
                disabled={busy}
                onClick={() => run({ notes })}
              >
                Save notes
              </button>
            )}
          </section>

          {/* Activity — newest first */}
          <section>
            <h3 className="meta mb-2">Activity</h3>
            <ul className="flex flex-col gap-1.5">
              {[...lead.activity].reverse().map((a, i) => (
                <li key={`${a.at}-${i}`} className="flex gap-2.5 text-xs">
                  <span className="mono shrink-0 text-fg3" title={absoluteTime(a.at)}>
                    {relativeTime(a.at)}
                  </span>
                  <span className="text-fg2">{a.text}</span>
                </li>
              ))}
              {lead.activity.length === 0 && <li className="text-xs text-fg3">Nothing yet.</li>}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
