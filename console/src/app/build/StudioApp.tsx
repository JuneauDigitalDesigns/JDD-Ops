'use client';

import { useState } from 'react';
import {
  Compass,
  Sun,
  SealCheck,
  Users,
  ListChecks,
  Briefcase,
  Star,
  Question,
  Megaphone,
  Phone,
  Article,
  Code,
  DotsSixVertical,
  X,
} from '@phosphor-icons/react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useDroppable,
} from '@dnd-kit/core';
import type { CategoryEntry } from './categories';
import type { SiteContent } from '@/data/site';
import ComponentCard from './ComponentCard';
import { paletteVars, typographyVars } from '@/lib/palette';
import { defaultSkin, type SkinId } from '@/lib/skins';

const ICONS = { Compass, Sun, SealCheck, Users, ListChecks, Briefcase, Star, Question, Megaphone, Phone, Article, Code } as const;

// The standard page sequence for body sections. `seo` is non-visual (wired as
// generateMetadata) and is deliberately excluded from the body order.
export const CANONICAL_ORDER = [
  'nav', 'hero', 'trust', 'about', 'services', 'work',
  'testimonials', 'faq', 'finalCta', 'contact', 'footer',
] as const;

// Nav is pinned to the top of the page, Footer to the bottom; everything else
// reorders freely between them.
const PIN_FIRST = 'nav';
const PIN_LAST = 'footer';

export type Selections = Record<string, string>; // categoryId -> componentName
export type SkinSelections = Record<string, SkinId>; // categoryId -> chosen skin for its selected component

/** Keep nav first and footer last, preserving the order of everything in between. */
export function enforcePins(arr: string[]): string[] {
  const middle = arr.filter((id) => id !== PIN_FIRST && id !== PIN_LAST);
  return [
    ...(arr.includes(PIN_FIRST) ? [PIN_FIRST] : []),
    ...middle,
    ...(arr.includes(PIN_LAST) ? [PIN_LAST] : []),
  ];
}

/**
 * Produce a clean body order from the current selections, preserving any existing
 * user-chosen sequence: keep still-selected entries in place, insert newly-selected
 * categories at their canonical slot position, then pin nav/footer.
 */
export function reconcileOrder(prevOrder: string[], selections: Selections): string[] {
  const selectedBody: string[] = CANONICAL_ORDER.filter((id) => selections[id]);
  const next = prevOrder.filter((id) => selectedBody.includes(id));
  for (const id of selectedBody) {
    if (next.includes(id)) continue;
    const canonIdx = CANONICAL_ORDER.indexOf(id as typeof CANONICAL_ORDER[number]);
    let insertAt = next.length;
    for (let i = 0; i < next.length; i++) {
      if (CANONICAL_ORDER.indexOf(next[i] as typeof CANONICAL_ORDER[number]) > canonIdx) {
        insertAt = i;
        break;
      }
    }
    next.splice(insertAt, 0, id);
  }
  return enforcePins(next);
}

type DragData = { categoryId: string; variantName: string; label: string };

/**
 * Step 3 of the Build wizard: the component browser + selection sidebar.
 *
 * Now fully CONTROLLED — selections/skins live in the wizard shell (BuildWizard) so they
 * persist into Step 4 (Finalize). The old internal `finalize` tab, BrandDrawer, and
 * localStorage were lifted out; category browsing (`tab`) stays local since it's Step-3-only.
 */
export default function StudioApp({
  categories,
  effective,
  selections,
  skins,
  onSelect,
  onSelectSkin,
  onDeselect,
  onClearAll,
}: {
  categories: CategoryEntry[];
  effective: SiteContent;
  selections: Selections;
  skins: SkinSelections;
  onSelect: (categoryId: string, componentName: string) => void;
  onSelectSkin: (categoryId: string, skin: SkinId) => void;
  onDeselect: (categoryId: string) => void;
  onClearAll: () => void;
}) {
  const [tab, setTab] = useState<CategoryEntry['id']>('hero');
  const [activeDrag, setActiveDrag] = useState<DragData | null>(null);

  function handleDragStart(e: DragStartEvent) {
    setActiveDrag(e.active.data.current as DragData);
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveDrag(null);
    if (!e.over) return;
    const d = e.active.data.current as DragData;
    onSelect(d.categoryId, d.variantName);
  }

  const activeCategory = categories.find((c) => c.id === tab) ?? null;
  const previewStyle = { ...paletteVars(effective.brand), ...typographyVars(effective.brand) };

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex h-full overflow-hidden">
        {/* Left: unified nav + selection sidebar */}
        <SelectionSidebar
          categories={categories}
          selections={selections}
          activeTab={tab}
          onSelectTab={setTab}
          onDeselect={onDeselect}
          onClearAll={onClearAll}
        />

        {/* Right: full-width component browser. */}
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 overflow-y-auto" style={previewStyle}>
            <div className="mx-auto max-w-7xl px-6 py-12">
              {activeCategory ? (
                <section className="space-y-16">
                  <header>
                    <p className="font-chromeMono text-xs uppercase tracking-widest text-uiInkSoft">
                      Category
                    </p>
                    <h1 className="mt-2 font-display text-3xl font-medium text-uiInk">
                      {activeCategory.label}
                    </h1>
                    <p className="mt-2 max-w-prose text-sm text-uiInkSoft">
                      Drag a card&apos;s handle into a slot in the left sidebar to select it.
                    </p>
                  </header>
                  <div className="space-y-16">
                    {activeCategory.variants.map((v) => {
                      const isSelected = selections[activeCategory.id] === v.name;
                      const skin = isSelected ? (skins[activeCategory.id] ?? defaultSkin(v.name)) : defaultSkin(v.name);
                      return (
                        <ComponentCard
                          key={v.name}
                          variant={v}
                          categoryId={activeCategory.id}
                          brand={effective.brand}
                          selected={isSelected}
                          skin={skin}
                          onSkinChange={(s) => onSelectSkin(activeCategory.id, s)}
                        />
                      );
                    })}
                  </div>
                </section>
              ) : null}
            </div>
          </main>
        </div>
      </div>

      {/* Floating drag preview */}
      <DragOverlay dropAnimation={null}>
        {activeDrag && (
          <div className="flex items-center gap-2 rounded-lg border border-uiInk bg-white px-3 py-2 shadow-xl text-sm font-medium text-uiInk pointer-events-none cursor-grabbing">
            <DotsSixVertical size={16} className="text-uiInkSoft" />
            <span>{activeDrag.label}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

// ─── Sidebar (nav + selection + industry + finalize) ───────────────────────────

function SelectionSidebar({
  categories,
  selections,
  activeTab,
  onSelectTab,
  onDeselect,
  onClearAll,
}: {
  categories: CategoryEntry[];
  selections: Selections;
  activeTab: CategoryEntry['id'];
  onSelectTab: (t: CategoryEntry['id']) => void;
  onDeselect: (categoryId: string) => void;
  onClearAll: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: 'selection-panel' });
  const selectedCount = Object.keys(selections).length;

  return (
    <aside className="flex w-[220px] shrink-0 flex-col border-r border-uiRule bg-uiBg text-uiFg">
      {/* Header: brand (theme + onboard nav now live in the global ConsoleNav) */}
      <div className="flex items-center justify-between border-b border-uiRule px-4 py-3">
        <div>
          <p className="font-display text-sm font-medium text-uiFg">JDD Studio</p>
          <p className="font-chromeMono text-[10px] uppercase tracking-widest text-uiAccent">build</p>
        </div>
      </div>

      {/* Selection label */}
      <div className="flex items-center border-b border-uiRule px-4 py-2.5">
        <span className="font-chromeMono text-[10px] uppercase tracking-widest text-uiFg3">Selection</span>
      </div>

      {/* Category rows: click = view on the right; drop target = select */}
      <div
        ref={setNodeRef}
        className={`flex-1 overflow-y-auto p-3 transition-colors duration-150 ${
          isOver ? 'bg-uiSurface2' : 'bg-transparent'
        }`}
      >
        <div className="space-y-1.5">
          {categories.map((c) => {
            const Icon = ICONS[c.iconName];
            const selName = selections[c.id];
            const selVariant = selName ? c.variants.find((v) => v.name === selName) : null;
            const active = activeTab === c.id;
            return (
              <div
                key={c.id}
                onClick={() => onSelectTab(c.id)}
                className={[
                  'group flex items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors cursor-pointer',
                  active
                    ? 'border-uiAccent/60 bg-uiSurface2'
                    : selVariant
                    ? 'border-uiAccent/30 bg-uiAccent/10'
                    : 'border-dashed border-uiRule hover:bg-uiSurface',
                ].join(' ')}
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <Icon size={15} weight="regular" className={active ? 'text-uiFg' : 'text-uiFg3'} />
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 font-chromeMono text-[10px] uppercase tracking-widest text-uiFg3">
                      {c.label}
                      {selVariant && <span className="h-1.5 w-1.5 rounded-full bg-uiAccent" aria-label="selected" />}
                    </p>
                    <p className={`truncate text-xs ${selVariant ? 'font-medium text-uiAccent' : 'text-uiFg3'}`}>
                      {selVariant ? selVariant.label : 'Drag here'}
                    </p>
                  </div>
                </div>
                {selVariant && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeselect(c.id);
                    }}
                    aria-label={`Remove ${c.label} selection`}
                    className="ml-2 shrink-0 rounded p-0.5 text-uiFg3 opacity-0 group-hover:opacity-100 hover:bg-white/10 hover:text-uiFg"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selection tally + footer */}
      <div className="border-t border-uiRule p-3">
        <div className="flex items-center justify-between px-1">
          <span className="font-chromeMono text-xs text-uiFg3">
            {selectedCount} of {categories.length}
          </span>
          {selectedCount > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              className="font-chromeMono text-xs text-uiFg3 hover:text-uiFg"
            >
              Clear all
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
