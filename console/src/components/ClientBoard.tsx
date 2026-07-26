'use client';
// The roster as a Kanban pipeline.
//
// This replaces the old stacked-sections board: same grouping by status, but as real side-by-side
// columns you can drag between, which is what makes "where is everything, and what moves next" a
// single glance rather than a scroll.
//
// The one rule that isn't obvious: `detectedStatus` is derived from what's on disk and acts as a
// FLOOR. A client whose repo is already provisioned cannot truthfully be dragged back to "needs
// build", so those columns dim during the drag and refuse the drop. This only blocks *creating* a
// behind-disk state by dragging — the state can still arise when a provisioning run advances
// detection past a manual status, and that case is still surfaced by the attention strip and the
// sync affordance inside StatusControl.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, closestCorners, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CaretLeft, CaretRight, Warning } from '@phosphor-icons/react';
import {
  COLUMNS, buildColumns, canDrop, columnFor, effectiveStatus, orderAt, renormalise,
} from '@/lib/kanban';
import { STATUS_COLOR, STATUS_LABEL, STATUS_SHORT } from '@/lib/status-meta';
import { STATUS_ORDER, type ClientContext, type ClientStatus, type OpsConfig, type RunbookState } from '@/lib/types';
import KanbanCard, { CardFace } from './KanbanCard';

const LIVE_KEY = 'onboard:kanban:live';

/** A column that can receive cards even when it holds none. */
function Column({
  status, count, disabled, collapsed, onToggleCollapse, children,
}: {
  status: ClientStatus;
  count: number;
  /** True while dragging a card this column may not accept. */
  disabled: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  children?: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled });

  if (collapsed) {
    return (
      <div
        ref={setNodeRef}
        className="flex w-[54px] shrink-0 flex-col items-center gap-3 rounded-[14px] border py-4 transition-colors"
        style={{
          borderColor: isOver ? 'var(--accent)' : 'var(--rule)',
          background: isOver ? 'var(--accent-glow)' : 'var(--surface)',
          opacity: disabled ? 0.35 : 1,
        }}
      >
        <button type="button" onClick={onToggleCollapse} title="Expand Live" className="text-fg3 hover:text-fg">
          <CaretLeft size={14} />
        </button>
        <span className="font-display text-lg font-semibold leading-none">{count}</span>
        <span
          className="kicker whitespace-nowrap"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: 9.5 }}
        >
          {STATUS_SHORT[status]}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      className="flex min-w-[240px] flex-1 flex-col rounded-[14px] border transition-colors"
      style={{
        borderColor: isOver && !disabled ? 'var(--accent)' : 'var(--rule)',
        background: isOver && !disabled ? 'var(--accent-glow)' : 'var(--surface)',
        opacity: disabled ? 0.35 : 1,
      }}
    >
      <div className="flex items-center gap-2 border-b border-rule px-3 py-2.5">
        <span
          className="h-[7px] w-[7px] shrink-0 rounded-full"
          style={{ background: STATUS_COLOR[status], boxShadow: `0 0 8px 1px ${STATUS_COLOR[status]}` }}
        />
        <span className="kicker truncate">{STATUS_SHORT[status]}</span>
        <span className="kicker ml-auto shrink-0" style={{ fontSize: 9.5 }}>{count}</span>
        {onToggleCollapse && (
          <button type="button" onClick={onToggleCollapse} title="Collapse Live" className="shrink-0 text-fg3 hover:text-fg">
            <CaretRight size={13} />
          </button>
        )}
      </div>
      <div className="flex min-h-[120px] flex-col gap-2.5 p-2.5">{children}</div>
    </div>
  );
}

export default function ClientBoard({
  clients, state, config, onSelect, onPlace,
}: {
  clients: ClientContext[];
  state: RunbookState;
  config: OpsConfig;
  onSelect: (slug: string) => void;
  /** Commit a drop: status and/or sort position, one client. */
  onPlace: (slug: string, next: { status?: ClientStatus; order?: number }) => void;
}) {
  const bySlug = useMemo(() => new Map(clients.map((c) => [c.slug, c])), [clients]);
  const committed = useMemo(() => buildColumns(clients, state), [clients, state]);

  // During a drag we hold our own copy so cards can cross columns under the cursor. Reset it
  // whenever the real data changes, or a refetch would leave the board showing a stale layout.
  const [draft, setDraft] = useState<Record<ClientStatus, string[]> | null>(null);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  useEffect(() => { setDraft(null); }, [committed]);

  const cols = draft ?? committed;

  const [liveCollapsed, setLiveCollapsed] = useState(true);
  useEffect(() => {
    try { setLiveCollapsed(localStorage.getItem(LIVE_KEY) !== 'open'); } catch { /* ignore */ }
  }, []);
  const toggleLive = useCallback(() => {
    setLiveCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem(LIVE_KEY, next ? 'closed' : 'open'); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const sensors = useSensors(
    // 5px is what lets the whole card be draggable AND clickable: a press that doesn't travel
    // never becomes a drag, so the click handler fires normally.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const activeCtx = activeSlug ? bySlug.get(activeSlug) ?? null : null;

  /** Which column a slug currently sits in, per the working copy. */
  const columnOf = useCallback(
    (slug: string, source: Record<ClientStatus, string[]>): ClientStatus | null =>
      COLUMNS.find((c) => source[c].includes(slug)) ?? null,
    [],
  );

  const onDragStart = (e: DragStartEvent) => setActiveSlug(String(e.active.id));

  const onDragOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over) return;
    const slug = String(active.id);
    const ctx = bySlug.get(slug);
    if (!ctx) return;

    const source = draft ?? committed;
    const from = columnOf(slug, source);
    // `over` is either a column (droppable id) or another card (sortable id).
    const overId = String(over.id);
    const to = (COLUMNS as string[]).includes(overId) ? (overId as ClientStatus) : columnOf(overId, source);
    if (!from || !to || from === to) return;
    if (!canDrop(ctx, to)) return;

    const next: Record<ClientStatus, string[]> = { ...source };
    for (const c of COLUMNS) next[c] = [...source[c]];
    next[from] = next[from].filter((s) => s !== slug);
    const overIndex = next[to].indexOf(overId);
    next[to].splice(overIndex >= 0 ? overIndex : next[to].length, 0, slug);
    setDraft(next);
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    const slug = String(active.id);
    const ctx = bySlug.get(slug);
    setActiveSlug(null);

    if (!over || !ctx) { setDraft(null); return; }

    const source = draft ?? committed;
    const overId = String(over.id);
    const to = (COLUMNS as string[]).includes(overId) ? (overId as ClientStatus) : columnOf(overId, source);

    // Refused: behind the disk-detected floor. Drop the working copy and the card snaps back.
    if (!to || !canDrop(ctx, to)) { setDraft(null); return; }

    // Final list for the destination column, with the card placed at its drop position.
    const next = [...source[to]].filter((s) => s !== slug);
    const overIndex = next.indexOf(overId);
    const insertAt = (COLUMNS as string[]).includes(overId) || overIndex < 0 ? next.length : overIndex;
    next.splice(insertAt, 0, slug);

    const fromCommitted = columnOf(slug, committed);
    const statusChanged = fromCommitted !== to;
    const { order, renormalise: needsReindex } = orderAt(next, insertAt, state);

    if (needsReindex) {
      // Fractional precision exhausted in this gap (realistically never). Reindex the column.
      for (const { slug: s, order: o } of renormalise(next)) {
        onPlace(s, { order: o, ...(s === slug && statusChanged ? { status: to } : {}) });
      }
    } else {
      onPlace(slug, { order, ...(statusChanged ? { status: to } : {}) });
    }
    setDraft(null);
  };

  // ── Attention strip (unchanged behaviour, kept above the board) ──────────────
  const attention = useMemo(
    () =>
      clients
        .map((ctx) => {
          const eff = effectiveStatus(ctx, state);
          const behind = STATUS_ORDER.indexOf(eff) < STATUS_ORDER.indexOf(ctx.detectedStatus);
          return { ctx, behind, flagged: behind || eff === 'ready' };
        })
        .filter((r) => r.flagged),
    [clients, state],
  );

  return (
    <div className="w-full px-6 py-10 md:px-8">
      <header className="mb-6 flex flex-col gap-2">
        <span className="flex items-center gap-2.5">
          <span className="h-px w-8 shrink-0" style={{ background: 'var(--accent)' }} />
          <span className="kicker">Onboarding runbook</span>
        </span>
        <h1 className="font-display text-4xl font-semibold leading-none tracking-tightest">Pipeline</h1>
      </header>

      {clients.length === 0 && <p className="py-16 text-center text-xs text-fg3">No clients under clients/ yet.</p>}

      {attention.length > 0 && (
        <div className="mb-6 rounded-[10px] border px-4 py-3" style={{ borderColor: 'var(--warn)', background: 'var(--warn-glow)' }}>
          <div className="mb-1 flex items-center gap-1.5">
            <Warning size={14} weight="fill" style={{ color: 'var(--warn)' }} />
            <span className="kicker" style={{ color: 'var(--warn)' }}>Needs attention · {attention.length}</span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {attention.map((r) => (
              <button key={r.ctx.slug} type="button" onClick={() => onSelect(r.ctx.slug)} className="text-xs text-fg2 hover:text-fg">
                {r.ctx.brandName}{' '}
                <span className="text-fg3">— {r.behind ? 'status behind disk' : 'ready to provision'}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => { setActiveSlug(null); setDraft(null); }}
      >
        {/* Visible scrollbar by design — pairing overflow-x-auto with .no-scrollbar is what made
            the step diagrams read as "cut off" rather than "scrollable". */}
        <div className="flex items-start gap-3 overflow-x-auto pb-3">
          {COLUMNS.map((status) => {
            const slugs = cols[status];
            const collapsed = status === 'live' && liveCollapsed;
            const disabled = !!activeCtx && !canDrop(activeCtx, status);
            return (
              <Column
                key={status}
                status={status}
                count={slugs.length}
                disabled={disabled}
                collapsed={collapsed}
                onToggleCollapse={status === 'live' ? toggleLive : undefined}
              >
                {!collapsed && (
                  <SortableContext items={slugs} strategy={verticalListSortingStrategy}>
                    {slugs.map((slug) => {
                      const ctx = bySlug.get(slug);
                      if (!ctx) return null;
                      return (
                        <KanbanCard
                          key={slug}
                          ctx={ctx}
                          clientState={state[slug]}
                          config={config}
                          status={status}
                          onOpen={() => onSelect(slug)}
                        />
                      );
                    })}
                  </SortableContext>
                )}
                {!collapsed && slugs.length === 0 && (
                  <p className="px-1 py-4 text-center text-2xs text-fg3">—</p>
                )}
              </Column>
            );
          })}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeCtx && (
            <div className="w-[260px] cursor-grabbing">
              <CardFace
                ctx={activeCtx}
                clientState={state[activeCtx.slug]}
                config={config}
                status={columnFor(effectiveStatus(activeCtx, state))}
                dragging
              />
              {/* Says WHY the dimmed columns are refusing, while the card is still in hand. */}
              {STATUS_ORDER.indexOf(activeCtx.detectedStatus) > 0 && (
                <p className="mt-1.5 text-center text-2xs" style={{ color: 'var(--warn)' }}>
                  disk says {STATUS_LABEL[activeCtx.detectedStatus].toLowerCase()}
                </p>
              )}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
