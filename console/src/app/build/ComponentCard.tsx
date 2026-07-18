'use client';

import { useDraggable } from '@dnd-kit/core';
import { DotsSixVertical } from '@phosphor-icons/react';
import type { VariantEntry } from './categories';
import type { SkinId } from '@/lib/skins';
import type { Brand } from '@/data/site';
import PreviewFrame from './PreviewFrame';

export default function ComponentCard({
  variant,
  categoryId,
  brand,
  selected,
  skin,
  onSkinChange,
}: {
  variant: VariantEntry;
  categoryId: string;
  brand: Brand;
  selected: boolean;
  skin: SkinId;
  onSkinChange: (skin: SkinId) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${categoryId}::${variant.name}`,
    data: { categoryId, variantName: variant.name, label: variant.label },
  });

  const showSkinToggle = selected && variant.skins.length > 1;

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

      {showSkinToggle && (
        <div
          className="flex items-center gap-1 border-b border-uiCardRule bg-white px-6 py-2"
          // Not draggable — clicking a skin button shouldn't start the drag-to-select gesture.
          onPointerDown={(e) => e.stopPropagation()}
        >
          <span className="mr-1 font-chromeMono text-[10px] uppercase tracking-widest text-uiInkSoft">Skin</span>
          {variant.skins.map((sk) => (
            <button
              key={sk.id}
              type="button"
              onClick={() => onSkinChange(sk.id)}
              className={[
                'rounded-full px-3 py-1 font-chromeMono text-[11px] uppercase tracking-widest transition-colors',
                sk.id === skin ? 'bg-uiInk text-white' : 'text-uiInkSoft hover:bg-uiSurface2',
              ].join(' ')}
            >
              {sk.label}
            </button>
          ))}
        </div>
      )}

      {/* Rendered inside an iframe so viewport units + breakpoints resolve like the live site. */}
      <PreviewFrame brand={brand} mode="scaled" virtualWidth={1280} rootClass="studio-preview-card">
        {variant.render(skin)}
      </PreviewFrame>
    </article>
  );
}
