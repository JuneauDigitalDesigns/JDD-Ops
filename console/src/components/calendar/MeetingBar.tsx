'use client';
// One meeting, as a thin draggable bar inside a day cell.
//
// The whole bar is both drag handle and click target, exactly like LeadCard: the PointerSensor in
// MonthGrid uses `activationConstraint: { distance: 5 }`, so a press that travels under 5px never
// becomes a drag and falls through to onClick. Dragging a bar onto another day reschedules it.

import { useDraggable } from '@dnd-kit/core';
import { Phone, VideoCamera } from '@phosphor-icons/react';
import type { Meeting } from '@/lib/meetingTypes';
import { KIND_COLOR, KIND_ICON_NAME, STATUS_DIM, STATUS_STRIKE } from '@/lib/meeting-meta';
import { formatTime } from '@/lib/meetingTime';

const ICON = { Phone, VideoCamera } as const;

/** The visual bar. Rendered in a cell and (undecorated) inside the DragOverlay. */
export function MeetingFace({ meeting, dragging }: { meeting: Meeting; dragging?: boolean }) {
  const Icon = ICON[KIND_ICON_NAME[meeting.kind]];
  // A no-show pulls the stripe to danger; otherwise the kind owns the colour.
  const stripe = meeting.status === 'no-show' ? 'var(--danger)' : KIND_COLOR[meeting.kind];
  const iconColor = meeting.status === 'no-show' ? 'var(--danger)' : KIND_COLOR[meeting.kind];

  return (
    <div
      className="flex items-center gap-1.5 overflow-hidden rounded-[6px] border px-1.5 py-[3px] text-[11.5px] leading-tight"
      style={{
        borderColor: dragging ? 'var(--rule-strong)' : 'transparent',
        borderLeft: `3px solid ${stripe}`,
        background: dragging ? '#fff8ec' : 'var(--surface)',
        opacity: STATUS_DIM[meeting.status],
      }}
      title={`${formatTime(meeting.startMinutes)} · ${meeting.businessName}`}
    >
      <span className="shrink-0 font-semibold tabular-nums text-fg3">
        {formatTime(meeting.startMinutes)}
      </span>
      <span
        className="min-w-0 flex-1 truncate text-fg1"
        style={{ textDecoration: STATUS_STRIKE[meeting.status] ? 'line-through' : undefined }}
      >
        {meeting.businessName}
      </span>
      <Icon size={11} weight="fill" style={{ color: iconColor, flexShrink: 0 }} />
    </div>
  );
}

export default function MeetingBar({ meeting, onOpen }: { meeting: Meeting; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: meeting.id });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        // The day cell under this bar owns click-to-create; keep a bar click from reaching it.
        e.stopPropagation();
        onOpen();
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      style={{ opacity: isDragging ? 0.35 : 1 }}
      className="cursor-pointer touch-none outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      aria-label={`${formatTime(meeting.startMinutes)} ${meeting.businessName} — open meeting`}
    >
      <MeetingFace meeting={meeting} />
    </div>
  );
}
