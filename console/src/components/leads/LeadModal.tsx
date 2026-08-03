'use client';
// One lead, opened.
//
// Two-column layout: left = act (contact info, editable), right = context (call, notes, activity).
// Stage is drag-only — no selector here. Field edits auto-save on blur and are diffed into the
// activity trail so corrections stay auditable.

import { useEffect, useRef, useState } from 'react';
import { CaretDown, CaretUp, Copy, EnvelopeSimple, Phone, X } from '@phosphor-icons/react';
import type { DemoCall, PlanInterest, QueuedLead } from '@/lib/leadTypes';
import { absoluteTime, relativeTime } from '@/lib/relativeTime';

const PLAN_LABEL: Record<string, string> = {
  starter: 'Starter',
  growth: 'Growth',
  enterprise: 'Enterprise',
};

type ModalPatch = {
  notes?: string;
  lostReason?: string;
  name?: string;
  businessName?: string;
  phone?: string;
  email?: string | null;
  trade?: string | null;
  planInterest?: PlanInterest | null;
};

function formatDuration(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms)) return '—';
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}m ${String(total % 60).padStart(2, '0')}s`;
}

function signupUrl(siteUrl: string, plan: string | null): string {
  const base = siteUrl.replace(/\/$/, '');
  return plan ? `${base}/agreement?plan=${plan}` : `${base}/pricing`;
}

/** Click-to-edit inline field. Blurs auto-save; Escape cancels. */
function EditField({
  label, value, type = 'text', onSave, missingLabel,
}: {
  label: string;
  value: string | undefined | null;
  type?: string;
  onSave: (v: string | null) => void;
  missingLabel?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');

  useEffect(() => {
    if (!editing) setDraft(value ?? '');
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed === (value ?? '')) return;
    onSave(trimmed || null);
  };

  const labelEl = <div className="mb-0.5 text-2xs text-fg3">{label}</div>;

  if (editing) {
    return (
      <div>
        {labelEl}
        <input
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          type={type}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit(); }
            if (e.key === 'Escape') { setEditing(false); setDraft(value ?? ''); }
          }}
          className="w-full rounded-[6px] border border-rule bg-transparent px-2 py-1 text-xs"
        />
      </div>
    );
  }

  return (
    <div>
      {labelEl}
      {value ? (
        <button
          type="button"
          onClick={() => { setDraft(value); setEditing(true); }}
          className="w-full cursor-text text-left text-xs text-fg hover:opacity-70"
        >
          {value}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => { setDraft(''); setEditing(true); }}
          className="text-left text-xs text-fg3 hover:text-fg"
        >
          + {missingLabel ?? `Add ${label.toLowerCase()}`}
        </button>
      )}
    </div>
  );
}

/** Three pill buttons for plan interest. Clicking the active pill clears it. */
function PlanPills({
  value, onChange,
}: {
  value: PlanInterest | null;
  onChange: (v: PlanInterest | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {(['starter', 'growth', 'enterprise'] as const).map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(value === p ? null : p)}
          className="rounded-[7px] border px-2.5 py-1 text-xs transition-colors"
          style={{
            borderColor: value === p ? 'var(--accent)' : 'var(--rule)',
            background: value === p ? 'var(--accent-glow)' : 'transparent',
            color: value === p ? 'var(--accent)' : 'var(--fg-2)',
          }}
        >
          {PLAN_LABEL[p]}
        </button>
      ))}
    </div>
  );
}

export default function LeadModal({
  lead, call, siteUrl, onClose, onPatch, onDelete,
}: {
  lead: QueuedLead;
  call: DemoCall | null;
  siteUrl: string;
  onClose: () => void;
  onPatch: (patch: ModalPatch) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [notes, setNotes] = useState(lead.notes ?? '');
  const [phoneCopied, setPhoneCopied] = useState(false);
  const [signupCopied, setSignupCopied] = useState(false);
  const [callExpanded, setCallExpanded] = useState(true);
  const [lostInput, setLostInput] = useState(false);
  const [lostDraft, setLostDraft] = useState(lead.lostReason ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [closeBlocked, setCloseBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const notesDirtyRef = useRef(false);

  const notesDirty = notes !== (lead.notes ?? '');
  notesDirtyRef.current = notesDirty;

  // Sync when a different lead is opened
  useEffect(() => {
    setNotes(lead.notes ?? '');
    setLostDraft(lead.lostReason ?? '');
    setLostInput(false);
    setConfirmDelete(false);
    setCloseBlocked(false);
  }, [lead.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') tryClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  function tryClose() {
    if (notesDirtyRef.current) { setCloseBlocked(true); return; }
    onClose();
  }

  async function run(patch: ModalPatch) {
    setBusy(true);
    try { await onPatch(patch); } finally { setBusy(false); }
  }

  function resizeNotes() {
    const el = notesRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 192)}px`;
  }

  useEffect(() => { resizeNotes(); }, [notes]);

  async function copyPhone() {
    try {
      await navigator.clipboard.writeText(lead.phone);
      setPhoneCopied(true);
      setTimeout(() => setPhoneCopied(false), 1600);
    } catch { /* clipboard blocked */ }
  }

  async function copySignup() {
    try {
      await navigator.clipboard.writeText(signupUrl(siteUrl, lead.planInterest));
      setSignupCopied(true);
      setTimeout(() => setSignupCopied(false), 1600);
    } catch { /* clipboard blocked */ }
  }

  const fromCall = lead.source === 'call';
  const isLost = lead.stage === 'lost';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(20,18,12,0.42)', backdropFilter: 'blur(2px)' }}
        onClick={tryClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${lead.businessName} — lead`}
        className="panel relative flex max-h-[86vh] w-full max-w-[840px] flex-col overflow-hidden"
      >
        {/* ── Header ── */}
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
              <span className="text-fg3">·</span>
              <span className="text-fg3" title={absoluteTime(lead.receivedAt)}>
                {relativeTime(lead.receivedAt)}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={tryClose}
            aria-label="Close"
            className="ml-auto shrink-0 rounded p-1 text-fg3 hover:text-fg"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Lost banner ── */}
        {isLost && (
          <div className="border-b border-rule px-5 py-2.5" style={{ background: 'var(--surface)' }}>
            {lostInput ? (
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-xs text-fg3">Reason:</span>
                <input
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                  value={lostDraft}
                  onChange={(e) => setLostDraft(e.target.value)}
                  placeholder="Why did it die?"
                  className="flex-1 rounded-[6px] border border-rule bg-transparent px-2 py-1 text-xs"
                />
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={busy}
                  onClick={async () => { await run({ lostReason: lostDraft }); setLostInput(false); }}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => { setLostInput(false); setLostDraft(lead.lostReason ?? ''); }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-fg3">
                  Lost{lead.lostReason ? ` — ${lead.lostReason}` : ''}
                </span>
                <button
                  type="button"
                  onClick={() => { setLostDraft(lead.lostReason ?? ''); setLostInput(true); }}
                  className="text-fg3 underline hover:text-fg"
                >
                  {lead.lostReason ? 'Edit reason' : '+ Add reason'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Two-column body ── */}
        <div className="no-scrollbar flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 gap-x-5 px-5 py-4">

            {/* ── LEFT: act ── */}
            <div className="flex flex-col gap-5">

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={`tel:${lead.phone.replace(/[^\d+]/g, '')}`}
                  className="btn btn-sm btn-primary"
                >
                  <Phone size={13} weight="fill" /> {lead.phone}
                </a>
                <button type="button" onClick={copyPhone} className="btn btn-sm">
                  <Copy size={13} /> {phoneCopied ? 'Copied' : 'Copy'}
                </button>
                <button
                  type="button"
                  onClick={copySignup}
                  className="btn btn-sm"
                  title={
                    lead.planInterest
                      ? `Copies ${lead.planInterest} agreement link`
                      : 'Copies pricing link'
                  }
                >
                  <Copy size={13} /> {signupCopied ? 'Copied!' : 'Copy signup link'}
                </button>
              </div>

              {/* Contact Info */}
              <section>
                <h3 className="meta mb-3">Contact Info</h3>
                <div className="flex flex-col gap-3">
                  <EditField
                    label="Business"
                    value={lead.businessName}
                    onSave={(v) => { if (v) run({ businessName: v }); }}
                  />
                  <EditField
                    label="Name"
                    value={lead.name}
                    onSave={(v) => { if (v) run({ name: v }); }}
                  />
                  <EditField
                    label="Phone"
                    value={lead.phone}
                    type="tel"
                    onSave={(v) => { if (v) run({ phone: v }); }}
                  />
                  <EditField
                    label="Email"
                    value={lead.email}
                    type="email"
                    missingLabel="Add email"
                    onSave={(v) => run({ email: v })}
                  />
                  <EditField
                    label="Trade"
                    value={lead.trade}
                    missingLabel="Add trade"
                    onSave={(v) => run({ trade: v })}
                  />
                  <div>
                    <div className="mb-1.5 text-2xs text-fg3">Plan</div>
                    <PlanPills
                      value={lead.planInterest}
                      onChange={(p) => run({ planInterest: p })}
                    />
                  </div>
                </div>
              </section>

              {/* What they said */}
              {lead.note && (
                <section>
                  <h3 className="meta mb-2">What they said</h3>
                  <p className="whitespace-pre-wrap rounded-[10px] border border-rule p-3 text-xs leading-relaxed text-fg2">
                    {lead.note}
                  </p>
                </section>
              )}

              {/* Won client slug */}
              {lead.convertedSlug && (
                <p className="text-xs" style={{ color: 'var(--ok)' }}>
                  Became a client — <span className="mono">{lead.convertedSlug}</span>
                </p>
              )}

              {/* Delete */}
              <div className="pt-1">
                {confirmDelete ? (
                  <div className="flex flex-col gap-2 rounded-[10px] border border-rule p-3">
                    <p className="text-xs text-fg2">This is permanent — are you sure?</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={busy}
                        style={{ color: 'var(--danger)' }}
                        onClick={() => onDelete(lead.id)}
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => setConfirmDelete(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="text-xs hover:underline"
                    style={{ color: 'var(--danger)', opacity: 0.55 }}
                    onClick={() => setConfirmDelete(true)}
                  >
                    Delete lead
                  </button>
                )}
              </div>
            </div>

            {/* ── RIGHT: context ── */}
            <div className="flex flex-col gap-5">

              {/* Call section (call leads only) */}
              {fromCall && (
                <section>
                  <div className="mb-2 flex items-center">
                    <h3 className="meta">The call</h3>
                    <button
                      type="button"
                      onClick={() => setCallExpanded((p) => !p)}
                      className="ml-auto rounded p-0.5 text-fg3 hover:text-fg"
                      aria-label={callExpanded ? 'Collapse call section' : 'Expand call section'}
                    >
                      {callExpanded ? <CaretUp size={12} /> : <CaretDown size={12} />}
                    </button>
                  </div>
                  {callExpanded && (
                    call ? (
                      <div className="flex flex-col gap-3 rounded-[10px] border border-rule p-3">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg2">
                          <span>{formatDuration(call.durationMs)}</span>
                          {call.outcome && (
                            <><span className="text-fg3">·</span><span>{call.outcome}</span></>
                          )}
                          {call.disconnectionReason && (
                            <><span className="text-fg3">·</span><span className="text-fg3">{call.disconnectionReason}</span></>
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
                    )
                  )}
                </section>
              )}

              {/* Notes */}
              <section>
                <h3 className="meta mb-2">Notes</h3>
                <textarea
                  ref={notesRef}
                  value={notes}
                  onChange={(e) => { setNotes(e.target.value); resizeNotes(); }}
                  rows={fromCall ? 3 : 6}
                  placeholder="What you learned, what you promised, what's next."
                  className="w-full resize-none overflow-y-auto rounded-[8px] border border-rule bg-transparent p-2.5 text-xs leading-relaxed"
                  style={{ maxHeight: '192px' }}
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

              {/* Activity */}
              <section>
                <h3 className="meta mb-2">Activity</h3>
                <ul
                  className="flex flex-col gap-1.5 overflow-y-auto"
                  style={{ maxHeight: '160px' }}
                >
                  {[...lead.activity].reverse().map((a, i) => (
                    <li key={`${a.at}-${i}`} className="flex gap-2.5 text-xs">
                      <span className="mono shrink-0 text-fg3" title={absoluteTime(a.at)}>
                        {relativeTime(a.at)}
                      </span>
                      <span className="text-fg2">{a.text}</span>
                    </li>
                  ))}
                  {lead.activity.length === 0 && (
                    <li className="text-xs text-fg3">Nothing yet.</li>
                  )}
                </ul>
              </section>
            </div>
          </div>
        </div>

        {/* ── Unsaved notes guard ── */}
        {closeBlocked && (
          <div className="flex items-center gap-3 border-t border-rule px-5 py-3">
            <p className="flex-1 text-xs text-fg2">Unsaved notes — discard?</p>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => { setNotes(lead.notes ?? ''); setCloseBlocked(false); onClose(); }}
            >
              Discard
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setCloseBlocked(false)}
            >
              Keep editing
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
