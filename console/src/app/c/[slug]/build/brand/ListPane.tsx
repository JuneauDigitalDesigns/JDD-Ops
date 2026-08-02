'use client';

import { useState } from 'react';
import {
  DndContext, DragEndEvent, PointerSensor, closestCenter, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DotsSixVertical, Trash, Plus, ArrowSquareOut, Warning } from '@phosphor-icons/react';
import { useReducedMotion } from 'framer-motion';
import type { SiteContent } from '@/data/site';
import type { SetField } from '@/components/fields';
import { getPath } from '@/lib/merge';
import { focusPath } from '@/lib/focusPath';

// A whole drawer pane for one content list. Unlike fields/ListSection (which wraps itself
// in a collapsed <details> — right when five lists shared one pane, wrong now that each
// list IS the pane), this renders open.
//
// Division of labour: the drawer owns STRUCTURE (add / remove / reorder / image), the live
// preview owns PROSE. Clicking a row jumps to that item's inline <E> editor in the preview,
// which has the full width a paragraph deserves. Editing an eight-item FAQ's answers inside
// a 380px column would be worse than the thing it replaced.

export type ListPaneProps = {
  content: SiteContent;
  setField: SetField;
  basePath: string;
  /** Item key holding the row's display label. */
  labelKey: string;
  /** Item key to focus in the preview when a row is clicked. Defaults to labelKey. */
  focusKey?: string;
  singular: string;
  makeBlank: () => Record<string, unknown>;
  /** Optional per-item extra UI (e.g. an image tile), rendered under the row label. */
  renderExtra?: (index: number) => React.ReactNode;
  /** Override the Add button: when set, it calls this instead of appending makeBlank(). */
  onAdd?: () => void;
  /** Rows whose index is in this set get an amber "needs attention" marker. */
  flagIndices?: Set<number>;
};

function Row({
  id, label, index, onRemove, onJump, extra, flagged,
}: {
  id: string; label: string; index: number;
  onRemove: () => void; onJump: () => void; extra?: React.ReactNode; flagged?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="rounded-md border border-uiRule bg-uiBg"
    >
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${label}`}
          className="shrink-0 cursor-grab text-uiFg3 hover:text-uiFg active:cursor-grabbing"
        >
          <DotsSixVertical size={14} />
        </button>

        {/* The row itself is the jump control — clicking edits this item's text in the preview. */}
        <button
          type="button"
          onClick={onJump}
          aria-label="Edit in preview"
          className="group flex min-w-0 flex-1 items-center gap-1.5 rounded px-1 py-0.5 text-left hover:bg-uiSurface"
        >
          <span className="min-w-0 flex-1 truncate text-sm text-uiFg2">
            {label || `Item ${index + 1}`}
          </span>
          {flagged && (
            <Warning
              size={14}
              weight="fill"
              className="shrink-0 text-amber-500"
              aria-label="Points at a section that isn't on the page"
            />
          )}
          <ArrowSquareOut size={12} className="shrink-0 text-uiFg3 opacity-0 group-hover:opacity-100" />
        </button>

        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label}`}
          className="shrink-0 text-uiFg3 hover:text-red-400"
        >
          <Trash size={14} />
        </button>
      </div>
      {extra && <div className="px-2 pb-2">{extra}</div>}
    </li>
  );
}

export default function ListPane({
  content, setField, basePath, labelKey, focusKey, singular, makeBlank, renderExtra, onAdd, flagIndices,
}: ListPaneProps) {
  const [miss, setMiss] = useState<string | null>(null);
  const reduce = useReducedMotion();

  const arr = (getPath(content, basePath) as Array<Record<string, unknown>> | undefined) ?? [];
  const write = (next: unknown) => setField(basePath, next);
  const ids = arr.map((_, i) => `${basePath}-${i}`);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    write(arrayMove(arr, from, to));
  }

  function jump(i: number) {
    const path = `${basePath}.${i}.${focusKey ?? labelKey}`;
    const ok = focusPath(path, { surface: 'preview', smooth: !reduce });
    // A miss is meaningful, not a no-op: the section may not be in the page order, or the
    // catalog component may not have wrapped this field for inline editing.
    setMiss(ok ? null : `“${singular}” isn’t editable in the preview — its section may not be on the page.`);
  }

  return (
    <div className="space-y-3 px-4 py-4">
      <div className="flex items-baseline justify-between">
        <p className="meta">
          {arr.length} {arr.length === 1 ? singular : `${singular}s`}
        </p>
      </div>

      {arr.length === 0 ? (
        <p className="rounded-md border border-dashed border-uiRule px-3 py-8 text-center text-sm text-uiFg3">
          No {singular.toLowerCase()}s yet.
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <ul className="space-y-1.5">
              {arr.map((item, i) => (
                <Row
                  key={ids[i]}
                  id={ids[i]}
                  index={i}
                  label={String(item[labelKey] ?? '')}
                  onRemove={() => write(arr.filter((_, k) => k !== i))}
                  onJump={() => jump(i)}
                  extra={renderExtra?.(i)}
                  flagged={flagIndices?.has(i)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {miss && (
        <p className="flex items-start gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-xs leading-snug text-amber-800">
          <Warning size={13} className="mt-px shrink-0" /> {miss}
        </p>
      )}

      <button
        type="button"
        onClick={onAdd ?? (() => write([...arr, makeBlank()]))}
        className="btn btn-sm border-dashed"
      >
        <Plus size={13} /> Add {singular.toLowerCase()}
      </button>
    </div>
  );
}
