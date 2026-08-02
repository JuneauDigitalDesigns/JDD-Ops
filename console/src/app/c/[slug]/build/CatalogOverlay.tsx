'use client';

import { useState } from 'react';
import {
  Compass, Sun, SealCheck, Users, ListChecks, Briefcase, Star, Question,
  Megaphone, Phone, Article, Code, X, Check,
} from '@phosphor-icons/react';
import { motion, useReducedMotion } from 'framer-motion';
import type { CategoryEntry } from './categories';
import type { SiteContent } from '@/data/site';
import type { Selections, SkinSelections } from './page-order';
import { defaultSkin, type SkinId } from '@/lib/skins';
import { paletteVars, typographyVars } from '@/lib/palette';
import ComponentCard from './ComponentCard';
import { EASE } from '@/lib/motion';

const ICONS = {
  Compass, Sun, SealCheck, Users, ListChecks, Briefcase, Star, Question,
  Megaphone, Phone, Article, Code,
} as const;

/**
 * Full-screen component picker. Two stages: category tiles → live previews of that
 * category's variants, each rendered in the CLIENT's real brand so what you pick is what
 * you get.
 *
 * The drag-through trick: this overlay renders INSIDE the Studio's DndContext, so a drag
 * that starts on a card here is the same gesture the canvas beneath receives. While
 * `dragging` is true the overlay drops to near-transparent and turns off pointer events,
 * which both reveals the canvas's insertion indicator and lets dnd-kit's collision
 * detection see the canvas droppables underneath.
 */
export default function CatalogOverlay({
  categories, effective, selections, skins, onSelectSkin, onDeselect, onPick, dragging, onClose,
}: {
  categories: CategoryEntry[];
  effective: SiteContent;
  selections: Selections;
  skins: SkinSelections;
  onSelectSkin: (categoryId: string, skin: SkinId) => void;
  onDeselect: (categoryId: string) => void;
  /** Click-to-add. Dragging a card onto the canvas is the other path to the same place. */
  onPick: (categoryId: string, variantName: string) => void;
  /** True while a card from this overlay is being dragged toward the canvas. */
  dragging: boolean;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const [openCat, setOpenCat] = useState<CategoryEntry['id'] | null>(null);
  const activeCategory = categories.find((c) => c.id === openCat) ?? null;
  const previewStyle = { ...paletteVars(effective.brand), ...typographyVars(effective.brand) };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: dragging ? 0.08 : 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0 : 0.2, ease: EASE }}
      // Pointer events off mid-drag so the canvas underneath receives the drop.
      style={{ pointerEvents: dragging ? 'none' : 'auto' }}
      className="absolute inset-0 z-40 flex flex-col bg-panel"
    >
      <header className="flex shrink-0 items-center gap-4 border-b border-rule px-6 py-4">
        {activeCategory ? (
          <button
            type="button"
            onClick={() => setOpenCat(null)}
            className="btn btn-sm"
          >
            All categories
          </button>
        ) : null}
        <h2 className="font-display text-2xl font-semibold text-fg">
          {activeCategory ? activeCategory.label : 'Add a section'}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close catalog"
          className="ml-auto rounded-md p-2 text-fg3 hover:bg-surface hover:text-fg"
        >
          <X size={20} />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!activeCategory ? (
          /* ── Stage 1: category tiles ─────────────────────────────────────── */
          <div className="step-body grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((c) => {
              const Icon = ICONS[c.iconName];
              const chosen = selections[c.id];
              const chosenVariant = chosen ? c.variants.find((v) => v.name === chosen) : null;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setOpenCat(c.id)}
                  className={[
                    'group flex flex-col items-start gap-4 rounded-xl border p-6 text-left shadow-raised transition-all',
                    'hover:-translate-y-0.5 hover:border-accent hover:shadow-panel',
                    chosenVariant ? 'border-accent/40 bg-accent/[0.06]' : 'border-rule bg-bg',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'flex h-12 w-12 items-center justify-center rounded-xl border transition-colors',
                      chosenVariant ? 'border-accent/40 text-accent' : 'border-ruleStrong text-fg3 group-hover:text-accent',
                    ].join(' ')}
                  >
                    <Icon size={24} weight="duotone" />
                  </span>
                  <span className="font-display text-xl font-semibold text-fg">{c.label}</span>
                  <span className="flex items-center gap-1.5 text-sm text-fg3">
                    {chosenVariant
                      ? <><Check size={15} weight="bold" className="text-accent" /> {chosenVariant.label}</>
                      : `${c.variants.length} option${c.variants.length === 1 ? '' : 's'}`}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          /* ── Stage 2: live variant previews, dragged onto the canvas ─────── */
          <div className="step-body max-w-7xl space-y-10" style={previewStyle}>
            {selections[activeCategory.id] && (
              <button
                type="button"
                onClick={() => onDeselect(activeCategory.id)}
                className="btn btn-sm btn-danger"
              >
                Remove from page
              </button>
            )}
            {activeCategory.variants.map((v) => {
              const isSelected = selections[activeCategory.id] === v.name;
              const skin = isSelected
                ? (skins[activeCategory.id] ?? defaultSkin(v.name))
                : defaultSkin(v.name);
              return (
                <ComponentCard
                  key={v.name}
                  variant={v}
                  categoryId={activeCategory.id}
                  brand={effective.brand}
                  selected={isSelected}
                  skin={skin}
                  onSkinChange={(s) => onSelectSkin(activeCategory.id, s)}
                  onPick={() => onPick(activeCategory.id, v.name)}
                />
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
