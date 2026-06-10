'use client';

import { useEffect, useState } from 'react';
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
  FlagCheckered,
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
import { arrayMove } from '@dnd-kit/sortable';
import type { CategoryEntry } from './page';
import ComponentCard from './ComponentCard';
import FinalizePanel from './FinalizePanel';

const ICONS = { Compass, Sun, SealCheck, Users, ListChecks, Briefcase, Star, Question, Megaphone, Phone, Article, Code } as const;
const STORAGE_KEY = 'jdd-studio-selections';

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

type TabId = CategoryEntry['id'] | 'finalize';

/** Keep nav first and footer last, preserving the order of everything in between. */
function enforcePins(arr: string[]): string[] {
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

export default function StudioApp({ categories }: { categories: CategoryEntry[] }) {
  const [tab, setTab] = useState<TabId>('hero');
  const [selections, setSelections] = useState<Selections>({});
  const [order, setOrder] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [activeDrag, setActiveDrag] = useState<DragData | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && 'selections' in parsed) {
          const sel = (parsed.selections ?? {}) as Selections;
          setSelections(sel);
          setOrder(reconcileOrder(Array.isArray(parsed.order) ? parsed.order : [], sel));
        } else {
          // Legacy shape: the whole value was the selections map.
          const sel = parsed as Selections;
          setSelections(sel);
          setOrder(reconcileOrder([], sel));
        }
      }
    } catch {
      // ignore malformed storage
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ selections, order }));
    } catch {
      // storage full or unavailable
    }
  }, [selections, order, hydrated]);

  // Whenever selections change, reconcile the body order (insert new picks at their
  // canonical position, drop deselected ones, keep nav/footer pinned). Reorders made
  // on the Finalize tab are preserved because reconcileOrder keeps existing sequence.
  useEffect(() => {
    if (!hydrated) return;
    setOrder((prev) => reconcileOrder(prev, selections));
  }, [selections, hydrated]);

  function select(categoryId: string, componentName: string) {
    setSelections((prev) => ({ ...prev, [categoryId]: componentName }));
  }

  function deselect(categoryId: string) {
    setSelections((prev) => {
      const next = { ...prev };
      delete next[categoryId];
      return next;
    });
  }

  function reorder(activeId: string, overId: string) {
    setOrder((prev) => {
      const oldIndex = prev.indexOf(activeId);
      const newIndex = prev.indexOf(overId);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return prev;
      return enforcePins(arrayMove(prev, oldIndex, newIndex));
    });
  }

  function handleDragStart(e: DragStartEvent) {
    const d = e.active.data.current as DragData;
    setActiveDrag(d);
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveDrag(null);
    if (!e.over) return;
    const d = e.active.data.current as DragData;
    select(d.categoryId, d.variantName);
  }

  const activeCategory = categories.find((c) => c.id === tab) ?? null;

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex h-[100dvh] overflow-hidden">
        {/* Left: selection sidebar */}
        <SelectionSidebar
          categories={categories}
          selections={selections}
          onDeselect={deselect}
          onClearAll={() => setSelections({})}
        />

        {/* Right: tab nav + content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <TopBar
            categories={categories}
            active={tab}
            onChange={setTab}
            selections={selections}
          />
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-5xl px-6 py-12">
              {tab === 'finalize' ? (
                <FinalizePanel
                  categories={categories}
                  selections={selections}
                  order={order}
                  onReorder={reorder}
                />
              ) : activeCategory ? (
                <section className="space-y-16">
                  <header>
                    <p className="font-chromeMono text-xs uppercase tracking-widest text-zinc-500">
                      Category
                    </p>
                    <h1 className="mt-2 text-3xl font-medium text-zinc-900">
                      {activeCategory.label}
                    </h1>
                    <p className="mt-2 max-w-prose text-sm text-zinc-500">
                      Drag a card&apos;s handle into the Build panel on the left to select it.
                    </p>
                  </header>
                  <div className="space-y-16">
                    {activeCategory.variants.map((v) => (
                      <ComponentCard
                        key={v.name}
                        variant={v}
                        categoryId={activeCategory.id}
                        selected={selections[activeCategory.id] === v.name}
                      />
                    ))}
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
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500 bg-white px-3 py-2 shadow-xl text-sm font-medium text-zinc-900 pointer-events-none cursor-grabbing">
            <DotsSixVertical size={16} className="text-zinc-400" />
            <span>{activeDrag.label}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

// ─── Selection Sidebar ────────────────────────────────────────────────────────

function SelectionSidebar({
  categories,
  selections,
  onDeselect,
  onClearAll,
}: {
  categories: CategoryEntry[];
  selections: Selections;
  onDeselect: (categoryId: string) => void;
  onClearAll: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: 'selection-panel' });
  const selectedCount = Object.keys(selections).length;

  return (
    <aside className="flex w-[280px] shrink-0 flex-col border-r border-zinc-200 bg-white">
      {/* Header */}
      <div className="border-b border-zinc-200 px-4 py-4">
        <p className="font-chrome text-sm font-medium text-zinc-900">JDD Catalog</p>
        <p className="font-chromeMono text-xs text-zinc-400">build</p>
      </div>

      {/* Drop zone wraps all slots */}
      <div
        ref={setNodeRef}
        className={`flex-1 overflow-y-auto p-3 transition-colors duration-150 ${
          isOver ? 'bg-emerald-50' : 'bg-white'
        }`}
      >
        <p className="mb-3 font-chromeMono text-[10px] uppercase tracking-widest text-zinc-400">
          Selection
        </p>
        <div className="space-y-1.5">
          {categories.map((c) => {
            const selName = selections[c.id];
            const selVariant = selName
              ? c.variants.find((v) => v.name === selName)
              : null;
            return (
              <div
                key={c.id}
                className={[
                  'flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors',
                  selVariant
                    ? 'border border-emerald-200 bg-emerald-50'
                    : 'border border-dashed border-zinc-200',
                ].join(' ')}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-chromeMono text-[10px] uppercase tracking-widest text-zinc-400">
                    {c.label}
                  </p>
                  {selVariant ? (
                    <p className="truncate text-xs font-medium text-emerald-700">
                      {selVariant.label}
                    </p>
                  ) : (
                    <p className="text-xs text-zinc-400">Drag here</p>
                  )}
                </div>
                {selVariant && (
                  <button
                    type="button"
                    onClick={() => onDeselect(c.id)}
                    aria-label={`Remove ${c.label} selection`}
                    className="ml-2 shrink-0 rounded p-0.5 text-zinc-400 hover:bg-emerald-100 hover:text-zinc-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3">
        <span className="font-chromeMono text-xs text-zinc-400">
          {selectedCount} of {categories.length} selected
        </span>
        {selectedCount > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="font-chromeMono text-xs text-zinc-400 hover:text-zinc-700"
          >
            Clear all
          </button>
        )}
      </div>
    </aside>
  );
}

// ─── Top Bar ──────────────────────────────────────────────────────────────────

function TopBar({
  categories,
  active,
  onChange,
  selections,
}: {
  categories: CategoryEntry[];
  active: TabId;
  onChange: (tab: TabId) => void;
  selections: Selections;
}) {
  const finalizeActive = active === 'finalize';
  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95 backdrop-blur">
      <div className="flex items-center gap-1 px-4 py-3">
        <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
          {categories.map((c) => {
            const Icon = ICONS[c.iconName];
            const isActive = active === c.id;
            const hasSelection = Boolean(selections[c.id]);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onChange(c.id)}
                className={[
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors whitespace-nowrap',
                  isActive
                    ? 'bg-zinc-100 font-medium text-zinc-900'
                    : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900',
                ].join(' ')}
              >
                <Icon size={16} weight="regular" />
                <span>{c.label}</span>
                {hasSelection && (
                  <span
                    aria-label="selected"
                    className="ml-0.5 h-1.5 w-1.5 rounded-full bg-emerald-500"
                  />
                )}
              </button>
            );
          })}

          {/* Finalize is the terminal tab — inline with the others but accented. */}
          <button
            type="button"
            onClick={() => onChange('finalize')}
            className={[
              'ml-1 flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors whitespace-nowrap',
              finalizeActive
                ? 'bg-emerald-600 font-medium text-white'
                : 'font-medium text-emerald-700 hover:bg-emerald-50',
            ].join(' ')}
          >
            <FlagCheckered size={16} weight="regular" />
            <span>Finalize</span>
          </button>
        </nav>
      </div>
    </header>
  );
}
