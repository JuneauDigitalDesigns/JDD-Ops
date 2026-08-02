'use client';
// The funnel as a Kanban board.
//
// Structurally this is the old ClientBoard with one rule removed. That board enforced a
// FLOOR — a client whose repo was already provisioned couldn't truthfully be dragged back
// to "needs build", because its status was derived from what was on disk. A lead has no
// disk state and no derived truth: its stage is your judgement, so every column accepts
// every card and nothing dims.
//
// The ordering maths is imported from lib/kanban rather than reimplemented. A drop writes
// the midpoint of its two new neighbours, so reordering touches exactly ONE record instead
// of reindexing a column — that scheme is fiddly enough that a second copy would drift.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, closestCorners, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { orderAt, renormalise } from '@/lib/kanban';
import { LEAD_COLOR, LEAD_LABEL } from '@/lib/lead-meta';
import { LEAD_STAGES, type LeadStage, type QueuedLead } from '@/lib/leadTypes';
import LeadCard, { LeadFace } from './LeadCard';

/** A column that can receive cards even when it holds none. */
function Column({
  stage, count, children,
}: {
  stage: LeadStage;
  count: number;
  children?: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

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
          style={{ background: LEAD_COLOR[stage], boxShadow: `0 0 8px 1px ${LEAD_COLOR[stage]}` }}
        />
        <span className="meta truncate">{LEAD_LABEL[stage]}</span>
        <span className="meta ml-auto shrink-0">{count}</span>
      </div>
      <div className="flex min-h-[120px] flex-col gap-2.5 p-2.5">{children}</div>
    </div>
  );
}

/** Lead ids per column, each sorted: dragged ones first by `order`, then newest first. */
function buildColumns(leads: QueuedLead[]): Record<LeadStage, string[]> {
  const out = {} as Record<LeadStage, string[]>;
  for (const s of LEAD_STAGES) out[s] = [];

  for (const lead of leads) {
    // A stage outside LEAD_STAGES would otherwise vanish from the board entirely.
    (out[lead.stage] ?? out.new).push(lead.id);
  }

  const byId = new Map(leads.map((l) => [l.id, l]));
  for (const s of LEAD_STAGES) {
    out[s].sort((x, y) => {
      const a = byId.get(x)!;
      const b = byId.get(y)!;
      const ao = a.order ?? Number.POSITIVE_INFINITY;
      const bo = b.order ?? Number.POSITIVE_INFINITY;
      if (ao !== bo) return ao - bo;
      return b.receivedAt - a.receivedAt; // never dragged → newest first
    });
  }
  return out;
}

export default function LeadBoard({
  leads, onOpen, onPlace,
}: {
  leads: QueuedLead[];
  onOpen: (id: string) => void;
  /** Commit a drop: stage and/or sort position, one lead. */
  onPlace: (id: string, next: { stage?: LeadStage; order?: number }) => void;
}) {
  const byId = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);
  const orderMap = useMemo(
    () => Object.fromEntries(leads.map((l) => [l.id, { order: l.order }])),
    [leads],
  );
  const committed = useMemo(() => buildColumns(leads), [leads]);

  // During a drag we hold our own copy so cards can cross columns under the cursor. Reset
  // whenever the real data changes, or a refetch leaves the board showing a stale layout.
  const [draft, setDraft] = useState<Record<LeadStage, string[]> | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  useEffect(() => {
    setDraft(null);
  }, [committed]);

  const cols = draft ?? committed;

  const sensors = useSensors(
    // 5px is what lets the whole card be draggable AND clickable.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const activeLead = activeId ? byId.get(activeId) ?? null : null;

  const columnOf = useCallback(
    (id: string, source: Record<LeadStage, string[]>): LeadStage | null =>
      LEAD_STAGES.find((s) => source[s].includes(id)) ?? null,
    [],
  );

  const onDragOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over) return;
    const id = String(active.id);
    const source = draft ?? committed;
    const from = columnOf(id, source);
    // `over` is either a column (droppable id) or another card (sortable id).
    const overId = String(over.id);
    const to = (LEAD_STAGES as string[]).includes(overId)
      ? (overId as LeadStage)
      : columnOf(overId, source);
    if (!from || !to || from === to) return;

    const next: Record<LeadStage, string[]> = { ...source };
    for (const s of LEAD_STAGES) next[s] = [...source[s]];
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
    const to = (LEAD_STAGES as string[]).includes(overId)
      ? (overId as LeadStage)
      : columnOf(overId, source);
    if (!to) {
      setDraft(null);
      return;
    }

    // Final list for the destination column, with the card at its drop position.
    const next = [...source[to]].filter((x) => x !== id);
    const overIndex = next.indexOf(overId);
    const insertAt =
      (LEAD_STAGES as string[]).includes(overId) || overIndex < 0 ? next.length : overIndex;
    next.splice(insertAt, 0, id);

    const stageChanged = columnOf(id, committed) !== to;
    const { order, renormalise: needsReindex } = orderAt(next, insertAt, orderMap);

    if (needsReindex) {
      // Fractional precision exhausted in this gap (realistically never). Reindex.
      for (const { slug: movedId, order: o } of renormalise(next)) {
        onPlace(movedId, { order: o, ...(movedId === id && stageChanged ? { stage: to } : {}) });
      }
    } else {
      onPlace(id, { order, ...(stageChanged ? { stage: to } : {}) });
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
      {/* Visible scrollbar by design — pairing overflow-x-auto with .no-scrollbar is what
          made the old board's columns read as "cut off" rather than "scrollable". */}
      <div className="flex items-start gap-3 overflow-x-auto pb-3">
        {LEAD_STAGES.map((stage) => {
          const ids = cols[stage];
          return (
            <Column key={stage} stage={stage} count={ids.length}>
              <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                {ids.map((id) => {
                  const lead = byId.get(id);
                  if (!lead) return null;
                  return <LeadCard key={id} lead={lead} onOpen={() => onOpen(id)} />;
                })}
              </SortableContext>
              {ids.length === 0 && <p className="px-1 py-4 text-center text-2xs text-fg3">—</p>}
            </Column>
          );
        })}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeLead && (
          <div className="w-[248px] cursor-grabbing">
            <LeadFace lead={activeLead} dragging />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
