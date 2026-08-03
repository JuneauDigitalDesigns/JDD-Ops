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
import { CaretDown, CaretUp } from '@phosphor-icons/react';
import { orderAt, renormalise } from '@/lib/kanban';
import { LEAD_COLOR, LEAD_LABEL } from '@/lib/lead-meta';
import { LEAD_STAGES, type LeadStage, type QueuedLead } from '@/lib/leadTypes';
import LeadCard, { LeadFace } from './LeadCard';

const COLLAPSIBLE: ReadonlySet<LeadStage> = new Set(['won', 'lost']);
const LS_KEY = 'jdd:leads:collapsed';

function Column({
  stage, count, collapsed, onToggleCollapse, children,
}: {
  stage: LeadStage;
  count: number;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  children?: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const canCollapse = COLLAPSIBLE.has(stage);

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
          style={{ background: LEAD_COLOR[stage], boxShadow: `0 0 6px 1px ${LEAD_COLOR[stage]}` }}
        />
        <span
          className="meta mb-1 shrink-0 text-fg2"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: '10px' }}
        >
          {LEAD_LABEL[stage]}
        </span>
        <span className="meta text-fg3">{count}</span>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="mt-2 rounded p-0.5 text-fg3 hover:text-fg"
          aria-label={`Expand ${LEAD_LABEL[stage]} column`}
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
          style={{ background: LEAD_COLOR[stage], boxShadow: `0 0 8px 1px ${LEAD_COLOR[stage]}` }}
        />
        <span className="meta truncate">{LEAD_LABEL[stage]}</span>
        <span className="meta ml-auto shrink-0">{count}</span>
        {canCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="ml-1 rounded p-0.5 text-fg3 hover:text-fg"
            aria-label={`Collapse ${LEAD_LABEL[stage]} column`}
          >
            <CaretUp size={12} />
          </button>
        )}
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
      return b.receivedAt - a.receivedAt;
    });
  }
  return out;
}

export default function LeadBoard({
  leads, onOpen, onPlace,
}: {
  leads: QueuedLead[];
  onOpen: (id: string) => void;
  onPlace: (id: string, next: { stage?: LeadStage; order?: number }) => void;
}) {
  const byId = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);
  const orderMap = useMemo(
    () => Object.fromEntries(leads.map((l) => [l.id, { order: l.order }])),
    [leads],
  );
  const committed = useMemo(() => buildColumns(leads), [leads]);

  const [draft, setDraft] = useState<Record<LeadStage, string[]> | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<LeadStage>>(new Set());

  useEffect(() => {
    setDraft(null);
  }, [committed]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (stored) setCollapsed(new Set(JSON.parse(stored) as LeadStage[]));
    } catch {}
  }, []);

  function toggleCollapse(stage: LeadStage) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(stage)) next.delete(stage);
      else next.add(stage);
      try { localStorage.setItem(LS_KEY, JSON.stringify([...next])); } catch {}
      return next;
    });
  }

  const cols = draft ?? committed;

  const sensors = useSensors(
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
    const overId = String(over.id);
    const to = (LEAD_STAGES as string[]).includes(overId)
      ? (overId as LeadStage)
      : columnOf(overId, source);
    if (!from || !to || from === to) return;
    // Don't update draft when hovering over a collapsed column — the card would
    // visually disappear. Commit happens on drop in onDragEnd.
    if (collapsed.has(to)) return;

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

    const next = [...source[to]].filter((x) => x !== id);
    const overIndex = next.indexOf(overId);
    const insertAt =
      (LEAD_STAGES as string[]).includes(overId) || overIndex < 0 ? next.length : overIndex;
    next.splice(insertAt, 0, id);

    const stageChanged = columnOf(id, committed) !== to;
    const { order, renormalise: needsReindex } = orderAt(next, insertAt, orderMap);

    if (needsReindex) {
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
      <div className="flex items-start gap-3 overflow-x-auto pb-3">
        {LEAD_STAGES.map((stage) => {
          const ids = cols[stage];
          const isCollapsed = collapsed.has(stage);
          return (
            <Column
              key={stage}
              stage={stage}
              count={ids.length}
              collapsed={isCollapsed}
              onToggleCollapse={COLLAPSIBLE.has(stage) ? () => toggleCollapse(stage) : undefined}
            >
              {!isCollapsed && (
                <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                  {ids.map((id) => {
                    const lead = byId.get(id);
                    if (!lead) return null;
                    return <LeadCard key={id} lead={lead} onOpen={() => onOpen(id)} />;
                  })}
                  {ids.length === 0 && <p className="px-1 py-4 text-center text-2xs text-fg3">—</p>}
                </SortableContext>
              )}
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
