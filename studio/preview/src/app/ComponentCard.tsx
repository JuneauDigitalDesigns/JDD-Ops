'use client';

import { useDraggable } from '@dnd-kit/core';
import { DotsSixVertical } from '@phosphor-icons/react';
import type { VariantEntry } from './page';

export default function ComponentCard({
  variant,
  categoryId,
  selected,
}: {
  variant: VariantEntry;
  categoryId: string;
  selected: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${categoryId}::${variant.name}`,
    data: { categoryId, variantName: variant.name, label: variant.label },
  });

  return (
    <article
      ref={setNodeRef}
      className={[
        'overflow-hidden rounded-lg border bg-white transition-shadow',
        selected
          ? 'border-emerald-500 ring-1 ring-emerald-500/30'
          : isDragging
          ? 'border-dashed border-zinc-300'
          : 'border-zinc-200',
        isDragging ? 'opacity-20' : '',
      ].join(' ')}
    >
      <header
        {...listeners}
        {...attributes}
        className="flex items-center justify-between gap-4 border-b border-zinc-200 bg-zinc-50/60 px-6 py-3 cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-baseline gap-3">
          <h2 className="text-sm font-medium text-zinc-900">{variant.label}</h2>
          <span className="font-chromeMono text-xs text-zinc-400">{variant.id}</span>
          {selected && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-chromeMono text-[10px] font-medium text-emerald-700">
              selected
            </span>
          )}
        </div>
        <DotsSixVertical size={18} className="text-zinc-400 shrink-0" />
      </header>
      <div className="bg-bg">{variant.node}</div>
    </article>
  );
}
