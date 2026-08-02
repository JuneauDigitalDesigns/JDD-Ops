'use client';
// One lead, as a draggable Kanban card.
//
// The whole card is both drag handle and click target, exactly as KanbanCard was: the
// PointerSensor in LeadBoard uses `activationConstraint: { distance: 5 }`, so a press that
// travels under 5px never becomes a drag and falls through to onClick. No grip icon, no
// second affordance competing for the most common action.

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Phone, EnvelopeSimple } from '@phosphor-icons/react';
import { isStale } from '@/lib/lead-meta';
import type { QueuedLead } from '@/lib/leadTypes';
import { absoluteTime, relativeTime } from '@/lib/relativeTime';

const PLAN_LABEL: Record<string, string> = {
  starter: 'Starter',
  growth: 'Growth',
  enterprise: 'Enterprise',
};

/** The visual card. Rendered in a column and (undecorated) inside the DragOverlay. */
export function LeadFace({ lead, dragging }: { lead: QueuedLead; dragging?: boolean }) {
  const stale = isStale(lead);
  const fromCall = lead.source === 'call';

  return (
    <div
      className="flex flex-col gap-2 rounded-[12px] border p-3 transition-shadow"
      style={{
        // A stale card takes a warn edge rather than dimming to near-invisible: the whole
        // point is that it should catch your eye, not recede.
        borderColor: stale ? 'var(--warn)' : 'var(--rule)',
        background: 'var(--panel)',
        boxShadow: dragging
          ? '0 8px 20px rgba(20,18,12,0.10), 0 48px 100px -32px rgba(20,18,12,0.42)'
          : '0 1px 2px rgba(20,18,12,0.04), 0 4px 12px -4px rgba(20,18,12,0.10)',
      }}
    >
      <div className="flex items-start gap-2">
        {/* Source badge. A call means a real conversation already happened, which is the
            single most useful thing to know before opening anything. */}
        <span
          title={fromCall ? 'Called the demo agent' : 'Filled the interest form'}
          className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px]"
          style={{
            background: fromCall ? 'var(--accent-glow)' : 'var(--surface-2)',
            color: fromCall ? 'var(--accent)' : 'var(--fg-3)',
          }}
        >
          {fromCall ? <Phone size={11} weight="fill" /> : <EnvelopeSimple size={11} />}
        </span>

        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="truncate font-display text-[15px] font-semibold leading-tight tracking-tightish">
            {lead.businessName}
          </h3>
          <span className="truncate text-xs text-fg2">{lead.name}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {lead.planInterest && (
          <span className="meta" style={{ color: 'var(--accent)' }}>
            {PLAN_LABEL[lead.planInterest] ?? lead.planInterest}
          </span>
        )}
        <span
          className="meta ml-auto"
          style={stale ? { color: 'var(--warn)' } : undefined}
          title={absoluteTime(lead.updatedAt ?? lead.receivedAt)}
        >
          {relativeTime(lead.updatedAt ?? lead.receivedAt)}
        </span>
      </div>
    </div>
  );
}

export default function LeadCard({ lead, onOpen }: { lead: QueuedLead; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        // The original stays as a ghost while the DragOverlay carries the real card.
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
      aria-label={`${lead.businessName} — open lead`}
    >
      <LeadFace lead={lead} />
    </div>
  );
}
