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
          ? 'border-uiInk ring-1 ring-uiInk/20'
          : isDragging
          ? 'border-dashed border-uiCardRule'
          : 'border-uiCardRule',
        isDragging ? 'opacity-20' : '',
      ].join(' ')}
    >
      <header
        {...listeners}
        {...attributes}
        className="flex items-center justify-between gap-4 border-b border-uiCardRule bg-stone-50/70 px-6 py-3 cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-baseline gap-3">
          <h2 className="font-display text-sm font-medium text-uiInk">{variant.label}</h2>
          <span className="font-chromeMono text-xs text-uiInkSoft">{variant.id}</span>
          {selected && (
            <span className="rounded-full bg-uiAccent px-2 py-0.5 font-chromeMono text-[10px] font-medium text-uiInk">
              selected
            </span>
          )}
        </div>
        <DotsSixVertical size={18} className="text-uiInkSoft shrink-0" />
      </header>
      <div className="bg-bg">{variant.node}</div>
    </article>
  );
}
