'use client';
// One ticket, as a draggable Kanban card.
//
// Same interaction model as LeadCard: the whole card is both drag handle and click target.
// LeadBoard's PointerSensor uses `activationConstraint: { distance: 5 }`, so a press that
// travels under 5px never becomes a drag and falls through to onClick.

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChatCircle } from '@phosphor-icons/react';
import type { Ticket } from '@jdd/schema';
import { TICKET_COLOR, TICKET_LABEL } from '@/lib/ticket-meta';
import { absoluteTime, relativeTime } from '@/lib/relativeTime';

const CATEGORY_LABEL: Record<string, string> = {
  billing: 'Billing',
  technical: 'Technical',
  content: 'Content',
  voice_agent: 'Voice agent',
  other: 'Other',
};

/** The visual card. Rendered in a column and (undecorated) inside the DragOverlay. */
export function TicketFace({
  ticket,
  dragging,
  unseen,
}: {
  ticket: Ticket;
  dragging?: boolean;
  /** Opened since the last visit. Marked with a dot. */
  unseen?: boolean;
}) {
  const replies = ticket.messages?.length ?? 0;

  return (
    <div
      className="flex flex-col gap-2 rounded-[12px] border p-3 transition-shadow"
      style={{
        borderColor: 'var(--rule)',
        background: 'var(--panel)',
        boxShadow: dragging
          ? '0 8px 20px rgba(20,18,12,0.10), 0 48px 100px -32px rgba(20,18,12,0.42)'
          : '0 1px 2px rgba(20,18,12,0.04), 0 4px 12px -4px rgba(20,18,12,0.10)',
      }}
    >
      <div className="flex items-start gap-2">
        <span
          title={TICKET_LABEL[ticket.status]}
          className="mt-[5px] h-[7px] w-[7px] shrink-0 rounded-full"
          style={{
            background: TICKET_COLOR[ticket.status],
            boxShadow: `0 0 6px 1px ${TICKET_COLOR[ticket.status]}`,
          }}
        />
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="flex items-center gap-1.5 truncate font-display text-[15px] font-semibold leading-tight tracking-tightish">
            {unseen && (
              <span
                title="Opened since your last visit"
                className="h-[6px] w-[6px] shrink-0 rounded-full"
                style={{ background: 'var(--accent)', boxShadow: '0 0 6px 1px var(--accent)' }}
              />
            )}
            <span className="truncate">{ticket.subject}</span>
          </h3>
          <span className="truncate text-xs text-fg2">{ticket.siteSlug}</span>
        </div>
        <span className="meta ml-auto shrink-0" style={{ color: 'var(--fg-3)' }}>
          {CATEGORY_LABEL[ticket.category] ?? ticket.category}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {replies > 1 && (
          <span className="meta flex items-center gap-1 text-fg3">
            <ChatCircle size={11} /> {replies}
          </span>
        )}
        <span
          className="meta ml-auto"
          title={absoluteTime(ticket.updatedAt ?? ticket.createdAt)}
        >
          {relativeTime(ticket.updatedAt ?? ticket.createdAt)}
        </span>
      </div>
    </div>
  );
}

export default function TicketCard({
  ticket,
  onOpen,
  unseen,
}: {
  ticket: Ticket;
  onOpen: () => void;
  unseen?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ticket.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1,
      }}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      className="cursor-pointer touch-none outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      aria-label={`${ticket.subject} — open ticket`}
    >
      <TicketFace ticket={ticket} unseen={unseen} />
    </div>
  );
}
