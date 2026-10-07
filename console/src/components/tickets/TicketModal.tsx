'use client';
// One ticket, opened on the operator side.
//
// Two-column layout: left = the conversation (thread + reply box), right = control (status,
// activity trail, delete). Status is a selector here, not drag-only — the operator may set any
// status, and the modal is where you'd know it changed. Replies append to the thread and fire
// the client notification email from the API route.

import { useEffect, useRef, useState } from 'react';
import { PaperPlaneRight, X } from '@phosphor-icons/react';
import type { Ticket, TicketStatus } from '@jdd/schema';
import { TICKET_STATUSES } from '@jdd/schema';
import { TICKET_COLOR, TICKET_LABEL } from '@/lib/ticket-meta';
import { absoluteTime, relativeTime } from '@/lib/relativeTime';

const CATEGORY_LABEL: Record<string, string> = {
  billing: 'Billing',
  technical: 'Technical',
  content: 'Content',
  voice_agent: 'Voice agent',
  other: 'Other',
};

export default function TicketModal({
  ticket, onClose, onPatch, onDelete,
}: {
  ticket: Ticket;
  onClose: () => void;
  onPatch: (patch: { status?: TicketStatus; message?: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const replyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setReply('');
    setConfirmDelete(false);
  }, [ticket.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function run(patch: { status?: TicketStatus; message?: string }) {
    setBusy(true);
    try {
      await onPatch(patch);
    } finally {
      setBusy(false);
    }
  }

  async function sendReply() {
    const text = reply.trim();
    if (!text) return;
    await run({ message: text });
    setReply('');
    replyRef.current?.focus();
  }

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
        aria-label={`${ticket.subject} — ticket`}
        className="panel relative flex max-h-[86vh] w-full max-w-[840px] flex-col overflow-hidden"
      >
        {/* ── Header ── */}
        <div className="flex items-start gap-3 border-b border-rule px-5 py-4">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="truncate font-display text-xl font-semibold leading-none tracking-tightish">
              {ticket.subject}
            </h2>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-fg2">
              <span>{ticket.siteSlug}</span>
              <span className="text-fg3">·</span>
              <span className="text-fg3">{CATEGORY_LABEL[ticket.category] ?? ticket.category}</span>
              <span className="text-fg3">·</span>
              <span className="text-fg3" title={absoluteTime(ticket.createdAt)}>
                {relativeTime(ticket.createdAt)}
              </span>
              <span
                className="ml-1 flex items-center gap-1.5 rounded-full px-2 py-0.5"
                style={{ background: 'var(--surface)', color: TICKET_COLOR[ticket.status] }}
              >
                <span
                  className="h-[6px] w-[6px] rounded-full"
                  style={{ background: TICKET_COLOR[ticket.status] }}
                />
                {TICKET_LABEL[ticket.status]}
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

        {/* ── Two-column body ── */}
        <div className="no-scrollbar flex-1 overflow-y-auto">
          <div className="grid grid-cols-[1.6fr_1fr] gap-x-5 px-5 py-4">

            {/* ── LEFT: conversation ── */}
            <div className="flex flex-col gap-4">
              <section>
                <h3 className="meta mb-2">Conversation</h3>
                <ul className="flex flex-col gap-2.5">
                  {ticket.messages.map((m, i) => (
                    <li
                      key={`${m.at}-${i}`}
                      className="flex flex-col gap-1 rounded-[10px] border p-3"
                      style={{
                        borderColor: 'var(--rule)',
                        background: m.author === 'operator' ? 'var(--accent-glow)' : 'var(--surface)',
                      }}
                    >
                      <div className="flex items-center gap-2 text-2xs text-fg3">
                        <span style={{ color: m.author === 'operator' ? 'var(--accent)' : undefined }}>
                          {m.author === 'operator' ? 'You' : 'Client'}
                        </span>
                        <span title={absoluteTime(m.at)}>{relativeTime(m.at)}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-xs leading-relaxed text-fg">{m.text}</p>
                    </li>
                  ))}
                  {ticket.messages.length === 0 && (
                    <li className="text-xs text-fg3">No messages yet.</li>
                  )}
                </ul>
              </section>

              {/* Reply */}
              <section>
                <h3 className="meta mb-2">Reply</h3>
                <textarea
                  ref={replyRef}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={4}
                  placeholder="Write a reply. The client is emailed a link back to this thread."
                  className="w-full resize-none rounded-[8px] border border-rule bg-transparent p-2.5 text-xs leading-relaxed"
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                      e.preventDefault();
                      sendReply();
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn btn-sm btn-primary mt-2"
                  disabled={busy || !reply.trim()}
                  onClick={sendReply}
                >
                  <PaperPlaneRight size={13} weight="fill" /> Send reply
                </button>
              </section>
            </div>

            {/* ── RIGHT: control ── */}
            <div className="flex flex-col gap-5">
              {/* Status */}
              <section>
                <h3 className="meta mb-2">Status</h3>
                <div className="flex flex-wrap gap-1.5">
                  {TICKET_STATUSES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={busy}
                      onClick={() => { if (s !== ticket.status) run({ status: s }); }}
                      className="rounded-[7px] border px-2.5 py-1 text-xs transition-colors"
                      style={{
                        borderColor: s === ticket.status ? TICKET_COLOR[s] : 'var(--rule)',
                        background: s === ticket.status ? 'var(--accent-glow)' : 'transparent',
                        color: s === ticket.status ? TICKET_COLOR[s] : 'var(--fg-2)',
                      }}
                    >
                      {TICKET_LABEL[s]}
                    </button>
                  ))}
                </div>
              </section>

              {/* Activity */}
              <section>
                <h3 className="meta mb-2">Activity</h3>
                <ul
                  className="flex flex-col gap-1.5 overflow-y-auto"
                  style={{ maxHeight: '160px' }}
                >
                  {[...ticket.activity].reverse().map((a, i) => (
                    <li key={`${a.at}-${i}`} className="flex gap-2.5 text-xs">
                      <span className="mono shrink-0 text-fg3" title={absoluteTime(a.at)}>
                        {relativeTime(a.at)}
                      </span>
                      <span className="text-fg2">{a.text}</span>
                    </li>
                  ))}
                  {ticket.activity.length === 0 && (
                    <li className="text-xs text-fg3">Nothing yet.</li>
                  )}
                </ul>
              </section>

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
                        onClick={() => onDelete(ticket.id)}
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
                    Delete ticket
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
