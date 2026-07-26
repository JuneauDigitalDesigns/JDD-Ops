'use client';
// One client, as a draggable Kanban card.
//
// The whole card is both the drag handle and the click target. dnd-kit's PointerSensor is
// configured with `activationConstraint: { distance: 5 }` (see ClientBoard), so a press that
// travels under 5px never starts a drag and falls through to onClick — no grip icon needed, and
// no second affordance competing for the most common action.

import { useMemo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { buildRunbook, PLAN_LABEL } from '@/lib/runbook-content';
import { flatten, progressOf } from '@/lib/runbook-nav';
import { STATUS_COLOR } from '@/lib/status-meta';
import type { ClientContext, ClientState, ClientStatus, OpsConfig } from '@/lib/types';
import PhaseMeter from './PhaseMeter';

export function useCardData(ctx: ClientContext, clientState: ClientState | undefined, config: OpsConfig) {
  const phases = useMemo(() => buildRunbook(ctx, config), [ctx, config]);
  const done = useMemo(
    () => new Set(Object.entries(clientState?.steps ?? {}).filter(([, v]) => v).map(([k]) => k)),
    [clientState],
  );
  const { total, completed } = useMemo(() => progressOf(flatten(phases), done), [phases, done]);
  return { phases, done, total, completed };
}

/** The visual card. Rendered both in a column and (undecorated) inside the DragOverlay. */
export function CardFace({
  ctx, clientState, config, status, dragging,
}: {
  ctx: ClientContext;
  clientState: ClientState | undefined;
  config: OpsConfig;
  status: ClientStatus;
  dragging?: boolean;
}) {
  const { phases, done, total, completed } = useCardData(ctx, clientState, config);
  const color = STATUS_COLOR[status];

  return (
    <div
      className="flex flex-col gap-2.5 rounded-[12px] border p-3 transition-shadow"
      style={{
        borderColor: 'var(--rule)',
        background: 'var(--panel)',
        boxShadow: dragging
          ? '0 8px 20px rgba(20,18,12,0.10), 0 48px 100px -32px rgba(20,18,12,0.42)'
          : '0 1px 2px rgba(20,18,12,0.04), 0 4px 12px -4px rgba(20,18,12,0.10)',
      }}
    >
      <div className="flex flex-col gap-1">
        <h3 className="truncate font-display text-lg font-semibold leading-none tracking-tightish">
          {ctx.brandName}
        </h3>
        <span className="mono truncate text-2xs text-fg3">{ctx.slug}</span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="kicker" style={{ fontSize: 9.5 }}>{PLAN_LABEL[ctx.plan]}</span>
        {ctx.isEnterprise && ctx.sites.length > 1 && (
          <span className="kicker" style={{ fontSize: 9.5, color: 'var(--accent)' }}>
            {ctx.sites.length} sites
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <PhaseMeter phases={phases} done={done} color={color} height={4} />
        <span className="kicker text-right" style={{ fontSize: 9 }}>{completed}/{total}</span>
      </div>
    </div>
  );
}

export default function KanbanCard({
  ctx, clientState, config, status, onOpen,
}: {
  ctx: ClientContext;
  clientState: ClientState | undefined;
  config: OpsConfig;
  status: ClientStatus;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ctx.slug,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        // The original stays in place as a ghost while the DragOverlay carries the real card.
        opacity: isDragging ? 0.35 : 1,
      }}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); }
      }}
      className="cursor-pointer touch-none outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      aria-label={`${ctx.brandName} — open runbook`}
    >
      <CardFace ctx={ctx} clientState={clientState} config={config} status={status} />
    </div>
  );
}
