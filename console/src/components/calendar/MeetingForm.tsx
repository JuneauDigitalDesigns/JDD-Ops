'use client';
// Create or edit one meeting.
//
// Rendered as a dialog over the grid by CalendarView. The same form serves three entries: click a
// day (create, blank identity), "Add to calendar" from a lead (create, identity prefilled), and
// Edit from the detail modal (edit, every field filled). Mode is derived from whether `initial.id`
// is set.
//
// Overlap is advisory: firstConflict is read live from the full meeting list and shown as a muted
// warning, but Save is never disabled by it (the user chose "warn but allow").

import { useMemo, useState } from 'react';
import { Phone, VideoCamera, Warning, X } from '@phosphor-icons/react';
import type { Meeting, MeetingKind } from '@/lib/meetingTypes';
import { MEETING_DURATIONS, MEETING_KINDS, MEETING_TIME_STEP } from '@/lib/meetingTypes';
import { KIND_COLOR, KIND_LABEL } from '@/lib/meeting-meta';
import { firstConflict, formatTime } from '@/lib/meetingTime';

export interface MeetingFormValues {
  /** Present = edit an existing meeting; absent = create. */
  id?: string;
  day: string;
  startMinutes: number;
  durationMinutes: number;
  kind: MeetingKind;
  businessName: string;
  contactName: string;
  trade: string;
  phone: string;
  notes: string;
  /** Carried through on create so the API links the meeting + writes the lead's activity. */
  leadId?: string;
}

const KIND_ICON = { call: Phone, video: VideoCamera } as const;

/** 0, 15, 30 … 1425 — every start slot at MEETING_TIME_STEP granularity. */
const TIME_OPTIONS: number[] = (() => {
  const out: number[] = [];
  for (let m = 0; m < 24 * 60; m += MEETING_TIME_STEP) out.push(m);
  return out;
})();

export default function MeetingForm({
  initial, allMeetings, busy, onSubmit, onCancel,
}: {
  initial: MeetingFormValues;
  allMeetings: Meeting[];
  busy: boolean;
  onSubmit: (values: MeetingFormValues) => void;
  onCancel: () => void;
}) {
  const isEdit = Boolean(initial.id);
  const [v, setV] = useState<MeetingFormValues>(initial);
  const set = <K extends keyof MeetingFormValues>(k: K, val: MeetingFormValues[K]) =>
    setV((prev) => ({ ...prev, [k]: val }));

  const conflict = useMemo(
    () =>
      v.day
        ? firstConflict(
            { day: v.day, startMinutes: v.startMinutes, durationMinutes: v.durationMinutes },
            allMeetings,
            v.id,
          )
        : null,
    [v.day, v.startMinutes, v.durationMinutes, v.id, allMeetings],
  );

  const canSave = Boolean(v.businessName.trim() && v.day);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(20,18,12,0.42)', backdropFilter: 'blur(2px)' }}
        onClick={onCancel}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'Edit meeting' : 'New meeting'}
        className="panel relative flex max-h-[88vh] w-full max-w-[560px] flex-col overflow-hidden"
      >
        <div className="flex items-start gap-3 border-b border-rule px-5 py-4">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="font-display text-xl font-semibold leading-none tracking-tightish">
              {isEdit ? 'Edit meeting' : 'New meeting'}
            </h2>
            {!isEdit && initial.leadId && (
              <span className="text-xs text-fg3">Prefilled from the lead card — pick when.</span>
            )}
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="ml-auto shrink-0 rounded p-1 text-fg3 hover:text-fg"
          >
            <X size={16} />
          </button>
        </div>

        <div className="no-scrollbar flex-1 overflow-y-auto px-5 py-4">
          <div className="flex flex-col gap-3.5">
            {/* Identity */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Business">
                <input
                  className="w-full rounded-[8px] border border-rule bg-transparent px-2.5 py-1.5 text-sm"
                  value={v.businessName}
                  onChange={(e) => set('businessName', e.target.value)}
                  placeholder="Rivera Plumbing"
                />
              </Field>
              <Field label="Contact">
                <input
                  className="w-full rounded-[8px] border border-rule bg-transparent px-2.5 py-1.5 text-sm"
                  value={v.contactName}
                  onChange={(e) => set('contactName', e.target.value)}
                  placeholder="Marcus Rivera"
                />
              </Field>
              <Field label="Trade">
                <input
                  className="w-full rounded-[8px] border border-rule bg-transparent px-2.5 py-1.5 text-sm"
                  value={v.trade}
                  onChange={(e) => set('trade', e.target.value)}
                  placeholder="Plumbing"
                />
              </Field>
              <Field label="Phone">
                <input
                  type="tel"
                  className="w-full rounded-[8px] border border-rule bg-transparent px-2.5 py-1.5 text-sm"
                  value={v.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  placeholder="(407) 555-0132"
                />
              </Field>
            </div>

            {/* When */}
            <div className="grid grid-cols-3 gap-3">
              <Field label="Day">
                <input
                  type="date"
                  className="w-full rounded-[8px] border border-rule bg-transparent px-2.5 py-1.5 text-sm"
                  value={v.day}
                  onChange={(e) => set('day', e.target.value)}
                />
              </Field>
              <Field label="Start">
                <select
                  className="w-full rounded-[8px] border border-rule bg-transparent px-2.5 py-1.5 text-sm"
                  value={v.startMinutes}
                  onChange={(e) => set('startMinutes', Number(e.target.value))}
                >
                  {TIME_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {formatTime(m)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Duration">
                <select
                  className="w-full rounded-[8px] border border-rule bg-transparent px-2.5 py-1.5 text-sm"
                  value={v.durationMinutes}
                  onChange={(e) => set('durationMinutes', Number(e.target.value))}
                >
                  {MEETING_DURATIONS.map((d) => (
                    <option key={d} value={d}>
                      {d} min
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {/* Kind */}
            <div>
              <div className="mb-1.5 text-2xs text-fg3">Kind</div>
              <div className="flex gap-2">
                {MEETING_KINDS.map((k) => {
                  const Icon = KIND_ICON[k];
                  const sel = v.kind === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => set('kind', k)}
                      className="flex flex-1 items-center justify-center gap-2 rounded-[9px] border px-3 py-2 text-sm transition-colors"
                      style={{
                        borderColor: sel ? KIND_COLOR[k] : 'var(--rule-strong)',
                        background: sel ? 'var(--accent-glow)' : 'transparent',
                        color: sel ? KIND_COLOR[k] : 'var(--fg-2)',
                        fontWeight: sel ? 600 : 400,
                      }}
                    >
                      <Icon size={14} weight={sel ? 'fill' : 'regular'} /> {KIND_LABEL[k]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notes */}
            <Field label="Notes / agenda">
              <textarea
                rows={3}
                className="w-full resize-none rounded-[8px] border border-rule bg-transparent p-2.5 text-sm leading-relaxed"
                value={v.notes}
                onChange={(e) => set('notes', e.target.value)}
                placeholder="What the meeting is about."
              />
            </Field>

            {conflict && (
              <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--warn)' }}>
                <Warning size={13} weight="fill" />
                Heads up — overlaps {conflict.businessName} at {formatTime(conflict.startMinutes)}.
                Saving is still allowed.
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-rule px-5 py-3">
          {!isEdit && initial.leadId && (
            <span className="meta">Writes “Meeting scheduled” to the lead</span>
          )}
          <div className="ml-auto flex gap-2">
            <button type="button" className="btn btn-sm" onClick={onCancel} disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              disabled={busy || !canSave}
              onClick={() => onSubmit(v)}
            >
              {isEdit ? 'Save changes' : 'Add to calendar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-2xs text-fg3">{label}</span>
      {children}
    </label>
  );
}
