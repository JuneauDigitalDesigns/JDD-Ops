'use client';
// One meeting, opened from its bar.
//
// Mirrors LeadModal's structure (overlay + panel, Escape to close, confirm-then-delete, a notes box
// that shows Save only when dirty). Status is set here with pills; the phone row reuses LeadModal's
// call/copy pattern. When the meeting came from a lead, a "View lead" link navigates back — the
// other half of the link the create wrote into the lead's activity trail.

import { useEffect, useRef, useState } from 'react';
import { ArrowSquareOut, Copy, Phone, PencilSimple, VideoCamera, X } from '@phosphor-icons/react';
import type { Meeting, MeetingStatus } from '@/lib/meetingTypes';
import { MEETING_STATUSES } from '@/lib/meetingTypes';
import { KIND_COLOR, KIND_LABEL, STATUS_LABEL } from '@/lib/meeting-meta';
import { dayLabel, endMinutes, formatTime } from '@/lib/meetingTime';

const KIND_ICON = { call: Phone, video: VideoCamera } as const;

export default function MeetingModal({
  meeting, busy, onClose, onPatch, onDelete, onEdit, onViewLead,
}: {
  meeting: Meeting;
  busy: boolean;
  onClose: () => void;
  onPatch: (patch: { status?: MeetingStatus; notes?: string | null }) => void;
  onDelete: (id: string) => void;
  onEdit: () => void;
  /** Navigate to the originating lead. Only rendered when meeting.leadId is set. */
  onViewLead: (leadId: string) => void;
}) {
  const [notes, setNotes] = useState(meeting.notes ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [phoneCopied, setPhoneCopied] = useState(false);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  const notesDirty = notes !== (meeting.notes ?? '');

  useEffect(() => {
    setNotes(meeting.notes ?? '');
    setConfirmDelete(false);
  }, [meeting.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function resizeNotes() {
    const el = notesRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 192)}px`;
  }
  useEffect(() => { resizeNotes(); }, [notes]);

  async function copyPhone() {
    if (!meeting.phone) return;
    try {
      await navigator.clipboard.writeText(meeting.phone);
      setPhoneCopied(true);
      setTimeout(() => setPhoneCopied(false), 1600);
    } catch { /* clipboard blocked */ }
  }

  const Icon = KIND_ICON[meeting.kind];
  const kindColor = KIND_COLOR[meeting.kind];

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
        aria-label={`${meeting.businessName} — meeting`}
        className="panel relative flex max-h-[88vh] w-full max-w-[520px] flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-rule px-5 py-4">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="truncate font-display text-xl font-semibold leading-none tracking-tightish">
              {meeting.businessName}
            </h2>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-fg2">
              {meeting.contactName && (
                <>
                  <span>{meeting.contactName}</span>
                  <span className="text-fg3">·</span>
                </>
              )}
              <span className="flex items-center gap-1" style={{ color: kindColor }}>
                <Icon size={11} weight="fill" /> {KIND_LABEL[meeting.kind]}
              </span>
              {meeting.trade && (
                <>
                  <span className="text-fg3">·</span>
                  <span className="text-fg3">{meeting.trade}</span>
                </>
              )}
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

        {/* Body */}
        <div className="no-scrollbar flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
          <div>
            <div className="mb-1 text-2xs text-fg3">When</div>
            <div className="text-sm text-fg1">
              {dayLabel(meeting.day)} · {formatTime(meeting.startMinutes)} – {formatTime(endMinutes(meeting))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-5 gap-y-4">
            {meeting.phone && (
              <div>
                <div className="mb-1 text-2xs text-fg3">Phone</div>
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={`tel:${meeting.phone.replace(/[^\d+]/g, '')}`}
                    className="btn btn-xs btn-accent"
                  >
                    <Phone size={12} weight="fill" /> {meeting.phone}
                  </a>
                  <button type="button" onClick={copyPhone} className="btn btn-xs">
                    <Copy size={12} /> {phoneCopied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            )}
            {meeting.leadId && (
              <div>
                <div className="mb-1 text-2xs text-fg3">Linked lead</div>
                <button
                  type="button"
                  onClick={() => onViewLead(meeting.leadId!)}
                  className="flex items-center gap-1.5 text-sm font-medium hover:underline"
                  style={{ color: 'var(--accent)' }}
                >
                  View lead <ArrowSquareOut size={13} />
                </button>
              </div>
            )}
          </div>

          {/* Status */}
          <div>
            <div className="mb-1.5 text-2xs text-fg3">Status</div>
            <div className="flex flex-wrap gap-1.5">
              {MEETING_STATUSES.map((s) => {
                const sel = meeting.status === s;
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={busy}
                    onClick={() => { if (!sel) onPatch({ status: s }); }}
                    className="rounded-[8px] border px-2.5 py-1 text-xs transition-colors"
                    style={{
                      borderColor: sel ? 'var(--accent)' : 'var(--rule)',
                      background: sel ? 'var(--accent-glow)' : 'transparent',
                      color: sel ? 'var(--accent)' : 'var(--fg-2)',
                      fontWeight: sel ? 600 : 400,
                    }}
                  >
                    {STATUS_LABEL[s]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <div className="mb-2 text-2xs text-fg3">Notes</div>
            <textarea
              ref={notesRef}
              value={notes}
              onChange={(e) => { setNotes(e.target.value); resizeNotes(); }}
              rows={3}
              placeholder="What the meeting is about, what came of it."
              className="w-full resize-none overflow-y-auto rounded-[8px] border border-rule bg-transparent p-2.5 text-sm leading-relaxed"
              style={{ maxHeight: '192px' }}
            />
            {notesDirty && (
              <button
                type="button"
                className="btn btn-sm mt-2"
                disabled={busy}
                onClick={() => onPatch({ notes: notes.trim() || null })}
              >
                Save notes
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 border-t border-rule px-5 py-3">
          {confirmDelete ? (
            <>
              <span className="text-xs text-fg2">Delete this meeting?</span>
              <button
                type="button"
                className="btn btn-sm"
                disabled={busy}
                style={{ color: 'var(--danger)' }}
                onClick={() => onDelete(meeting.id)}
              >
                Delete
              </button>
              <button type="button" className="btn btn-sm" onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              className="text-xs hover:underline"
              style={{ color: 'var(--danger)', opacity: 0.6 }}
              onClick={() => setConfirmDelete(true)}
            >
              Delete meeting
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button type="button" className="btn btn-sm" onClick={onEdit}>
              <PencilSimple size={13} /> Edit
            </button>
            <button type="button" className="btn btn-sm btn-primary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
