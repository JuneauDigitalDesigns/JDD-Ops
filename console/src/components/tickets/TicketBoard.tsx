'use client';
// The ticket queue as a Kanban board.
//
// Structurally a clone of LeadBoard: every column accepts every card (a ticket's status is the
// operator's judgement, so nothing is floored or dimmed), and the ordering maths is imported
// from lib/kanban rather than reimplemented — a drop writes the midpoint of its two neighbours,
// so reordering touches exactly ONE record.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, closestCorners, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CaretDown, CaretUp } from '@phosphor-icons/react';
import { TICKET_STATUSES, type Ticket, type TicketStatus } from '@jdd/schema';
import { orderAt, renormalise } from '@/lib/kanban';
import { TICKET_COLOR, TICKET_LABEL, isUnseen } from '@/lib/ticket-meta';
import TicketCard, { TicketFace } from './TicketCard';

const COLLAPSIBLE: ReadonlySet<TicketStatus> = new Set(['resolved', 'closed']);
const LS_KEY = 'jdd:tickets:collapsed';

function Column({
  status, count, unseen = 0, collapsed, onToggleCollapse, children,
}: {
  status: TicketStatus;
  count: number;
  unseen?: number;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  children?: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const canCollapse = COLLAPSIBLE.has(status);

  if (collapsed) {
    return (
      <div
        ref={setNodeRef}
        className="flex shrink-0 flex-col items-center rounded-[14px] border py-3 transition-colors"
        style={{
          width: '44px',
          borderColor: isOver ? 'var(--accent)' : 'var(--rule)',
          background: isOver ? 'var(--accent-glow)' : 'var(--surface)',
        }}
      >
        <span
          className="mb-2 h-[7px] w-[7px] shrink-0 rounded-full"
          style={{ background: TICKET_COLOR[status], boxShadow: `0 0 6px 1px ${TICKET_COLOR[status]}` }}
        />
        <span
          className="meta mb-1 shrink-0 text-fg2"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: '10px' }}
        >
          {TICKET_LABEL[status]}
        </span>
        <span className="meta text-fg3">{count}</span>
        {unseen > 0 && (
          <span
            className="meta mt-1 shrink-0 rounded-full px-1.5"
            title={`${unseen} new since your last visit`}
            style={{ background: 'var(--accent-glow)', color: 'var(--accent)' }}
          >
            {unseen}
          </span>
        )}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="mt-2 rounded p-0.5 text-fg3 hover:text-fg"
          aria-label={`Expand ${TICKET_LABEL[status]} column`}
        >
          <CaretDown size={12} />
        </button>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      className="flex min-w-[228px] flex-1 flex-col rounded-[14px] border transition-colors"
      style={{
        borderColor: isOver ? 'var(--accent)' : 'var(--rule)',
        background: isOver ? 'var(--accent-glow)' : 'var(--surface)',
      }}
    >
      <div className="flex items-center gap-2 border-b border-rule px-3 py-2.5">
        <span
          className="h-[7px] w-[7px] shrink-0 rounded-full"
          style={{ background: TICKET_COLOR[status], boxShadow: `0 0 8px 1px ${TICKET_COLOR[status]}` }}
        />
        <span className="meta truncate">{TICKET_LABEL[status]}</span>
        <span className="ml-auto flex shrink-0 items-center gap-1.5">
          {unseen > 0 && (
            <span
              className="meta rounded-full px-1.5"
              title={`${unseen} new since your last visit`}
              style={{ background: 'var(--accent-glow)', color: 'var(--accent)' }}
            >
              {unseen} new
            </span>
          )}
          <span className="meta">{count}</span>
        </span>
        {canCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="ml-1 rounded p-0.5 text-fg3 hover:text-fg"
            aria-label={`Collapse ${TICKET_LABEL[status]} column`}
          >
            <CaretUp size={12} />
          </button>
        )}
      </div>
      <div className="flex min-h-[120px] flex-col gap-2.5 p-2.5">{children}</div>
    </div>
  );
}

/** Ticket ids per column, each sorted: dragged ones first by `order`, then newest first. */
function buildColumns(tickets: Ticket[]): Record<TicketStatus, string[]> {
  const out = {} as Record<TicketStatus, string[]>;
  for (const s of TICKET_STATUSES) out[s] = [];

  for (const ticket of tickets) {
    (out[ticket.status] ?? out.open).push(ticket.id);
  }

  const byId = new Map(tickets.map((t) => [t.id, t]));
  for (const s of TICKET_STATUSES) {
    out[s].sort((x, y) => {
      const a = byId.get(x)!;
      const b = byId.get(y)!;
      const ao = a.order ?? Number.POSITIVE_INFINITY;
      const bo = b.order ?? Number.POSITIVE_INFINITY;
      if (ao !== bo) return ao - bo;
      return b.createdAt - a.createdAt;
    });
  }
  return out;
}

export default function TicketBoard({
  tickets, onOpen, onPlace, lastSeenAt = null,
}: {
  tickets: Ticket[];
  onOpen: (id: string) => void;
  onPlace: (id: string, next: { status?: TicketStatus; order?: number }) => void;
  lastSeenAt?: number | null;
}) {
  const byId = useMemo(() => new Map(tickets.map((t) => [t.id, t])), [tickets]);
  const orderMap = useMemo(
    () => Object.fromEntries(tickets.map((t) => [t.id, { order: t.order }])),
    [tickets],
  );
  const committed = useMemo(() => buildColumns(tickets), [tickets]);

  const [draft, setDraft] = useState<Record<TicketStatus, string[]> | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<TicketStatus>>(new Set());

  useEffect(() => {
    setDraft(null);
  }, [committed]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (stored) setCollapsed(new Set(JSON.parse(stored) as TicketStatus[]));
    } catch {}
  }, []);

  function toggleCollapse(status: TicketStatus) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      try { localStorage.setItem(LS_KEY, JSON.stringify([...next])); } catch {}
      return next;
    });
  }

  const cols = draft ?? committed;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const activeTicket = activeId ? byId.get(activeId) ?? null : null;

  const columnOf = useCallback(
    (id: string, source: Record<TicketStatus, string[]>): TicketStatus | null =>
      TICKET_STATUSES.find((s) => source[s].includes(id)) ?? null,
    [],
  );

  const onDragOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over) return;
    const id = String(active.id);
    const source = draft ?? committed;
    const from = columnOf(id, source);
    const overId = String(over.id);
    const to = (TICKET_STATUSES as readonly string[]).includes(overId)
      ? (overId as TicketStatus)
      : columnOf(overId, source);
    if (!from || !to || from === to) return;
    if (collapsed.has(to)) return;

    const next: Record<TicketStatus, string[]> = { ...source };
    for (const s of TICKET_STATUSES) next[s] = [...source[s]];
    next[from] = next[from].filter((x) => x !== id);
    const overIndex = next[to].indexOf(overId);
    next[to].splice(overIndex >= 0 ? overIndex : next[to].length, 0, id);
    setDraft(next);
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    const id = String(active.id);
    setActiveId(null);

    if (!over) {
      setDraft(null);
      return;
    }

    const source = draft ?? committed;
    const overId = String(over.id);
    const to = (TICKET_STATUSES as readonly string[]).includes(overId)
      ? (overId as TicketStatus)
      : columnOf(overId, source);
    if (!to) {
      setDraft(null);
      return;
    }

    const next = [...source[to]].filter((x) => x !== id);
    const overIndex = next.indexOf(overId);
    const insertAt =
      (TICKET_STATUSES as readonly string[]).includes(overId) || overIndex < 0 ? next.length : overIndex;
    next.splice(insertAt, 0, id);

    const statusChanged = columnOf(id, committed) !== to;
    const { order, renormalise: needsReindex } = orderAt(next, insertAt, orderMap);

    if (needsReindex) {
      for (const { slug: movedId, order: o } of renormalise(next)) {
        onPlace(movedId, { order: o, ...(movedId === id && statusChanged ? { status: to } : {}) });
      }
    } else {
      onPlace(id, { order, ...(statusChanged ? { status: to } : {}) });
    }
    setDraft(null);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActiveId(null);
        setDraft(null);
      }}
    >
      <div className="flex items-start gap-3 overflow-x-auto pb-3">
        {TICKET_STATUSES.map((status) => {
          const ids = cols[status];
          const isCollapsed = collapsed.has(status);
          const unseenCount = ids.reduce((n, id) => {
            const ticket = byId.get(id);
            return ticket && isUnseen(ticket, lastSeenAt) ? n + 1 : n;
          }, 0);
          return (
            <Column
              key={status}
              status={status}
              count={ids.length}
              unseen={unseenCount}
              collapsed={isCollapsed}
              onToggleCollapse={COLLAPSIBLE.has(status) ? () => toggleCollapse(status) : undefined}
            >
              {!isCollapsed && (
                <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                  {ids.map((id) => {
                    const ticket = byId.get(id);
                    if (!ticket) return null;
                    return (
                      <TicketCard
                        key={id}
                        ticket={ticket}
                        unseen={isUnseen(ticket, lastSeenAt)}
                        onOpen={() => onOpen(id)}
                      />
                    );
                  })}
                  {ids.length === 0 && <p className="px-1 py-4 text-center text-2xs text-fg3">—</p>}
                </SortableContext>
              )}
            </Column>
          );
        })}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeTicket && (
          <div className="w-[248px] cursor-grabbing">
            <TicketFace ticket={activeTicket} dragging />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
