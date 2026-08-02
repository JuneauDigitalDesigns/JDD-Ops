'use client';

import { useEffect, useState } from 'react';
import {
  DndContext, DragEndEvent, DragOverEvent, DragStartEvent, DragOverlay,
  PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus, DotsSixVertical, X, ArrowsOut, Rocket, RocketLaunch, LockSimple, ArrowCounterClockwise,
  MagnifyingGlassMinus, MagnifyingGlassPlus, ArrowUUpLeft, ArrowUUpRight, Palette, TextAa,
} from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'framer-motion';
import type { CategoryEntry } from './categories';
import type { Selections, SkinSelections, StudioReverts } from './page-order';
import type { VerticalId } from '@/lib/verticals';
import type { SiteContent } from '@/data/site';
import { EditProvider } from '@/lib/editable';
import { defaultSkin, supportsSkin, type SkinId } from '@/lib/skins';
import { paletteVars, typographyVars } from '@/lib/palette';
import StyleToolbar from './StyleToolbar';
import FullScreenPreview from './FullScreenPreview';
import BrandDrawer from './BrandDrawer';
import CatalogOverlay from './CatalogOverlay';
import LaunchDialog from './LaunchDialog';
import DeployDialog from './DeployDialog';

/**
 * The Studio: composition and editing on ONE surface. This replaces the old Build →
 * Finalize split, where you assembled the page blind in step 3 and only saw it in step 4.
 *
 * The canvas is the page. Sections render live and in order; text is edited inline via
 * <E> (EditProvider) at the size it will ship. Structure — adding, reordering, removing,
 * reskinning — happens on the same view.
 *
 * ONE DndContext spans the canvas AND the catalog overlay, which is what lets a card
 * dragged out of the overlay land on a canvas insertion point. Two drag species share it:
 *   • catalog card  → active.data.current.variantName is set → selects into a category
 *   • canvas section → a sortable id → reorders the page
 */
export default function StudioStep({
  categories, effective, selections, skins, order, vertical, slug,
  onSelect, onSelectSkin, onDeselect, onReorder, setField, onResetEdits, onResetStyles,
  onUndo, onRedo, canUndo, canRedo, focusSection, onFocusHandled,
  alreadyDeployed = false, brandName, reverts,
}: {
  categories: CategoryEntry[];
  effective: SiteContent;
  selections: Selections;
  skins: SkinSelections;
  order: string[];
  vertical: VerticalId;
  slug: string;
  /** `atIndex` places the new section at that position in the page order; omit for canonical. */
  onSelect: (categoryId: string, componentName: string, atIndex?: number) => void;
  onSelectSkin: (categoryId: string, skin: SkinId) => void;
  onDeselect: (categoryId: string) => void;
  onReorder: (activeId: string, overId: string) => void;
  setField: (path: string, value: unknown) => void;
  onResetEdits: () => void;
  onResetStyles: () => void;
  /** Studio-scoped undo/redo — covers composition (add/remove/reorder/skin) + inline edits. */
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** One-shot: scroll + highlight this section on entry (from the Intake review modal). */
  focusSection?: string | null;
  onFocusHandled?: () => void;
  /**
   * This client already has an exported repo, so the primary action is Deploy — update the
   * live site — rather than Launch, which creates it. Launch stays for a full re-export.
   */
  alreadyDeployed?: boolean;
  /** For the deploy dialog's heading and the generated commit message. */
  brandName?: string;
  /** Forwarded straight to the deploy dialog, which reverts individual rows with them. */
  reverts: StudioReverts;
}) {
  const [catalogOpen, setCatalogOpen] = useState(false);
  // Where a section picked from the catalog should land. null = let reconcileOrder put it
  // at its canonical slot (what the top-strip button wants); a number = the operator asked
  // for that position via a between-sections "+".
  const [insertAt, setInsertAt] = useState<number | null>(null);
  const [launchOpen, setLaunchOpen] = useState(false);
  const [deployOpen, setDeployOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [styleSel, setStyleSel] = useState<{ path: string; rect: DOMRect } | null>(null);
  const [activeDrag, setActiveDrag] = useState<{ label: string; fromCatalog: boolean } | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  // Canvas zoom. Zooming OUT is the point — it lets you see the whole page while dragging a
  // section top-to-bottom. Applied via CSS `zoom` (not transform: scale) so layout box,
  // scrollbars, and pointer hit-testing stay in one coordinate space and dnd-kit drag remains
  // accurate. Range 50–125%, 10% steps.
  const [zoom, setZoom] = useState(1);
  const ZOOM_MIN = 0.5;
  const ZOOM_MAX = 1.25;
  const zoomOut = () => setZoom((z) => Math.max(ZOOM_MIN, +(z - 0.1).toFixed(2)));
  const zoomIn = () => setZoom((z) => Math.min(ZOOM_MAX, +(z + 0.1).toFixed(2)));
  const resetZoom = () => setZoom(1);
  // Which section is briefly ring-highlighted after an "Edit in Studio" jump.
  const [highlightId, setHighlightId] = useState<string | null>(null);

  // Consume a one-shot focus request: scroll the matching section into view + flash a ring.
  // Best-effort — a section that isn't on the canvas simply doesn't scroll (no error).
  useEffect(() => {
    if (!focusSection) return;
    const id = focusSection;
    const raf = requestAnimationFrame(() => {
      const el = document.getElementById(`studio-section-${id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightId(id);
      }
      onFocusHandled?.();
    });
    return () => cancelAnimationFrame(raf);
  }, [focusSection, onFocusHandled]);

  // Clear the highlight ring shortly after it appears.
  useEffect(() => {
    if (!highlightId) return;
    const t = setTimeout(() => setHighlightId(null), 1300);
    return () => clearTimeout(t);
  }, [highlightId]);

  // The style toolbar is anchored to a rect, which goes stale the moment anything moves.
  useEffect(() => {
    if (!styleSel) return;
    const close = () => setStyleSel(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [styleSel]);

  function entryFor(categoryId: string) {
    const c = categories.find((x) => x.id === categoryId);
    const name = c ? selections[c.id] : undefined;
    const v = c && name ? c.variants.find((x) => x.name === name) : undefined;
    if (!c || !name || !v) return null;
    const skin = skins[c.id] ?? defaultSkin(name);
    return { categoryId: c.id, categoryLabel: c.label, name, label: v.label, skin, variant: v };
  }

  const bodyEntries = order
    .map(entryFor)
    .filter((x): x is NonNullable<ReturnType<typeof entryFor>> => x !== null);

  /**
   * The export payload: body sections in page order, plus SEO. `skin` is included ONLY for
   * components that actually declare the prop — otherwise the server bakes `skin="…"` onto a
   * component whose props type has no such field and the client repo fails to compile.
   * Mirrors LaunchDialog so the export route only ever sees one shape.
   */
  const seoEntry = entryFor('seo');
  const exportEntries = [...bodyEntries, ...(seoEntry ? [seoEntry] : [])].map((e) => ({
    categoryId: e.categoryId,
    name: e.name,
    label: e.label,
    skin: supportsSkin(e.name) ? e.skin : undefined,
  }));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function openCatalogAt(at: number | null) {
    setInsertAt(at);
    setCatalogOpen(true);
  }

  function closeCatalog() {
    setCatalogOpen(false);
    setInsertAt(null);
  }

  /** The one place a catalog pick becomes a page section, shared by click and drop. */
  function addSection(categoryId: string, variantName: string) {
    onSelect(categoryId, variantName, insertAt ?? undefined);
    closeCatalog();
  }

  function handleDragStart(e: DragStartEvent) {
    const d = e.active.data.current as { variantName?: string; label?: string } | undefined;
    const fromCatalog = Boolean(d?.variantName);
    setActiveDrag({
      label: d?.label ?? entryFor(String(e.active.id))?.label ?? 'Section',
      fromCatalog,
    });
  }

  function handleDragOver(e: DragOverEvent) {
    setOverId(e.over ? String(e.over.id) : null);
  }

  function handleDragEnd(e: DragEndEvent) {
    const d = e.active.data.current as { categoryId?: string; variantName?: string } | undefined;
    setActiveDrag(null);
    setOverId(null);

    if (d?.variantName && d.categoryId) {
      // A catalog card landed. If it was dropped onto a specific section, insert there;
      // otherwise honour whatever position opened the catalog.
      const overIdx = e.over ? order.indexOf(String(e.over.id)) : -1;
      onSelect(d.categoryId, d.variantName, overIdx !== -1 ? overIdx : insertAt ?? undefined);
      closeCatalog();
      return;
    }
    if (e.over && e.active.id !== e.over.id) {
      onReorder(String(e.active.id), String(e.over.id));
    }
  }

  const brandStyle = { ...paletteVars(effective.brand), ...typographyVars(effective.brand) };
  const draggingFromCatalog = Boolean(activeDrag?.fromCatalog);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => { setActiveDrag(null); setOverId(null); }}
    >
      <div className="relative flex h-full overflow-hidden bg-bgDeep">
        {/* ── Canvas column ──────────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Slim tool strip — everything that isn't the page itself. */}
          <div className="flex shrink-0 items-center gap-3 border-b border-rule bg-panel px-5 py-2.5">
            {/* Composition on the left, ship/preview on the right — the two prominent
                buttons (Add section, Launch) sit at opposite ends so neither competes.
                Add is deliberately NOT disabled when empty; it is the way out of empty. */}
            <button
              type="button"
              onClick={() => openCatalogAt(null)}
              className="btn btn-sm border-accent text-accent hover:border-accent hover:text-accent"
            >
              <Plus size={15} weight="bold" /> Add section
            </button>
            <span className="text-sm font-medium text-fg3">
              {bodyEntries.length} section{bodyEntries.length === 1 ? '' : 's'}
            </span>

            <div className="ml-auto flex items-center gap-2">
              {/* Zoom — icon-only, with a %-readout that doubles as reset-to-100%. */}
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={zoomOut}
                  disabled={zoom <= ZOOM_MIN}
                  title="Zoom out"
                  aria-label="Zoom out"
                  className="rounded-md p-1.5 text-fg3 hover:bg-surface hover:text-fg disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <MagnifyingGlassMinus size={15} />
                </button>
                <button
                  type="button"
                  onClick={resetZoom}
                  title="Reset zoom to 100%"
                  aria-label="Reset zoom to 100%"
                  className="min-w-[3.5ch] rounded-md px-1 py-1 text-center text-xs font-medium tabular-nums text-fg3 hover:bg-surface hover:text-fg"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  type="button"
                  onClick={zoomIn}
                  disabled={zoom >= ZOOM_MAX}
                  title="Zoom in"
                  aria-label="Zoom in"
                  className="rounded-md p-1.5 text-fg3 hover:bg-surface hover:text-fg disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <MagnifyingGlassPlus size={15} />
                </button>
              </div>

              {/* Undo/redo — Studio-scoped (composition + inline edits). Icon-only w/ tooltips. */}
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={onUndo}
                  disabled={!canUndo}
                  title="Undo"
                  aria-label="Undo"
                  className="rounded-md p-1.5 text-fg3 hover:bg-surface hover:text-fg disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ArrowUUpLeft size={15} />
                </button>
                <button
                  type="button"
                  onClick={onRedo}
                  disabled={!canRedo}
                  title="Redo"
                  aria-label="Redo"
                  className="rounded-md p-1.5 text-fg3 hover:bg-surface hover:text-fg disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ArrowUUpRight size={15} />
                </button>
              </div>

              {/* Reset styles / text — icon pairs (reset arrow + subject), tooltip on hover. */}
              <button
                type="button"
                onClick={onResetStyles}
                title="Reset styles"
                aria-label="Reset styles"
                className="flex items-center gap-0.5 rounded-md p-1.5 text-fg3 hover:bg-surface hover:text-fg"
              >
                <ArrowCounterClockwise size={13} /> <Palette size={15} />
              </button>
              <button
                type="button"
                onClick={onResetEdits}
                title="Reset text edits"
                aria-label="Reset text edits"
                className="flex items-center gap-0.5 rounded-md p-1.5 text-fg3 hover:bg-surface hover:text-fg"
              >
                <ArrowCounterClockwise size={13} /> <TextAa size={15} />
              </button>
              <button
                type="button"
                onClick={() => setFullscreen(true)}
                disabled={bodyEntries.length === 0}
                className="btn btn-sm"
              >
                <ArrowsOut size={15} weight="bold" /> Full screen
              </button>
              {/* Once a client is live, Deploy is the action you want and Launch is the
                  rare one — so they swap emphasis rather than sitting side by side as
                  equals, which would make "which of these ships it?" a question. */}
              <button
                type="button"
                onClick={() => setLaunchOpen(true)}
                disabled={bodyEntries.length === 0}
                className={alreadyDeployed ? 'btn btn-sm' : 'btn btn-sm btn-primary'}
              >
                <Rocket size={15} /> {alreadyDeployed ? 'Re-export' : 'Launch'}
              </button>
              {alreadyDeployed && (
                <button
                  type="button"
                  onClick={() => setDeployOpen(true)}
                  disabled={bodyEntries.length === 0}
                  className="btn btn-sm btn-primary"
                >
                  <RocketLaunch size={15} weight="fill" /> Deploy
                </button>
              )}
            </div>
          </div>

          {/* ── The page ─────────────────────────────────────────────────── */}
          {/* isolate: establish a stacking context so a preview section's sticky/fixed
              nav (z-50) can't paint over chrome that sits above this canvas (e.g. the
              catalog overlay at z-40). Contains any positioned catalog descendant. */}
          <div className="isolate min-h-0 flex-1 overflow-y-auto" style={brandStyle}>
            {/* .step-body carries the shared px + pb-24 gutter (see globals.css).
                `zoom` (not transform: scale) keeps dnd-kit's pointer/collision math accurate. */}
            <div className="step-body max-w-[1400px]" style={{ zoom }}>
              {bodyEntries.length === 0 ? (
                <button
                  type="button"
                  onClick={() => openCatalogAt(null)}
                  className="flex w-full flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-rule bg-panel/60 px-6 py-24 text-fg3 transition-colors hover:border-accent hover:text-accent"
                >
                  <Plus size={40} weight="light" />
                  <span className="font-display text-2xl font-semibold">Add your first section</span>
                </button>
              ) : (
                <EditProvider
                  setField={setField}
                  overrides={effective.overrides}
                  onSelect={(path, el) => setStyleSel({ path, rect: el.getBoundingClientRect() })}
                >
                  <SortableContext items={order} strategy={verticalListSortingStrategy}>
                    <div className="overflow-hidden rounded-xl border border-rule bg-bg shadow-panel">
                      {bodyEntries.map((e, i) => (
                        <CanvasSection
                          key={e.categoryId}
                          id={e.categoryId}
                          label={e.categoryLabel}
                          variantLabel={e.label}
                          pinned={e.categoryId === 'nav' || e.categoryId === 'footer'}
                          showIndicator={overId === e.categoryId && Boolean(activeDrag)}
                          skins={e.variant.skins}
                          activeSkin={e.skin}
                          canSkin={supportsSkin(e.name) && e.variant.skins.length > 1}
                          onSkinChange={(s) => onSelectSkin(e.categoryId, s)}
                          onRemove={() => onDeselect(e.categoryId)}
                          onAddAfter={() => openCatalogAt(i + 1)}
                          isLast={i === bodyEntries.length - 1}
                          highlighted={highlightId === e.categoryId}
                        >
                          {e.variant.render(e.skin)}
                        </CanvasSection>
                      ))}
                    </div>
                  </SortableContext>
                </EditProvider>
              )}
            </div>
          </div>
        </div>

        {/* ── Brand drawer: icon rail, collapsed by default ───────────────── */}
        <BrandDrawer content={effective} setField={setField} order={order} />

        {/* ── Catalog overlay ─────────────────────────────────────────────── */}
        <AnimatePresence>
          {catalogOpen && (
            <CatalogOverlay
              categories={categories}
              effective={effective}
              selections={selections}
              skins={skins}
              onSelectSkin={onSelectSkin}
              onDeselect={onDeselect}
              onPick={addSection}
              dragging={draggingFromCatalog}
              onClose={closeCatalog}
            />
          )}
        </AnimatePresence>

      </div>

      {/* Floating drag chip, shared by both drag species. */}
      <DragOverlay dropAnimation={null}>
        {activeDrag && (
          <div className="pointer-events-none flex cursor-grabbing items-center gap-2 rounded-lg border border-accent bg-panel px-3.5 py-2.5 text-sm font-medium text-fg shadow-floating">
            <DotsSixVertical size={17} className="text-fg3" />
            {activeDrag.label}
          </div>
        )}
      </DragOverlay>

      {styleSel && (
        <StyleToolbar
          path={styleSel.path}
          rect={styleSel.rect}
          overrides={effective.overrides}
          setField={setField}
          onClose={() => setStyleSel(null)}
        />
      )}

      {fullscreen && (
        <FullScreenPreview
          brand={effective.brand}
          title={effective.brand.short || effective.brand.name}
          sections={bodyEntries.map((e) => ({ key: e.categoryId, node: e.variant.render(e.skin) }))}
          onClose={() => setFullscreen(false)}
        />
      )}

      <AnimatePresence>
        {launchOpen && (
          <LaunchDialog
            categories={categories}
            selections={selections}
            skins={skins}
            order={order}
            vertical={vertical}
            effective={effective}
            lockedSlug={slug}
            onClose={() => setLaunchOpen(false)}
          />
        )}
      </AnimatePresence>

      {deployOpen && (
        <DeployDialog
          slug={slug}
          brandName={brandName ?? effective.brand?.name ?? slug}
          selections={selections}
          skins={skins}
          order={order}
          effective={effective}
          exportEntries={exportEntries}
          vertical={vertical}
          reverts={reverts}
          onClose={() => setDeployOpen(false)}
        />
      )}
    </DndContext>
  );
}

/**
 * One section on the canvas: the real component, plus chrome that only appears on hover so
 * the canvas reads as the page rather than as an editor. Nav and footer are pinned (they
 * can be removed and reskinned, but not reordered), matching enforcePins().
 */
function CanvasSection({
  id, label, variantLabel, pinned, showIndicator, children,
  skins, activeSkin, canSkin, onSkinChange, onRemove, onAddAfter, isLast, highlighted,
}: {
  id: string;
  label: string;
  variantLabel: string;
  pinned: boolean;
  showIndicator: boolean;
  children: React.ReactNode;
  skins: ReadonlyArray<{ id: SkinId; label: string }>;
  activeSkin: SkinId;
  canSkin: boolean;
  onSkinChange: (s: SkinId) => void;
  onRemove: () => void;
  onAddAfter: () => void;
  isLast: boolean;
  highlighted?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: pinned,
  });

  return (
    <div
      ref={setNodeRef}
      id={`studio-section-${id}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group relative border-b border-rule/40 transition-shadow last:border-0 ${isDragging ? 'opacity-40' : ''} ${highlighted ? 'ring-2 ring-inset ring-accent' : ''}`}
    >
      {/* Insertion indicator — an animated line, not a slot grid. */}
      {showIndicator && (
        <motion.div
          layoutId="drop-indicator"
          className="absolute -top-0.5 left-0 right-0 z-30 h-1 rounded-full bg-accent shadow-glow"
        />
      )}

      {/* Hover chrome. Sits above the section but never over its center, so inline text
          editing in the middle of a hero is never blocked by a toolbar. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-3 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-lg border border-rule bg-panel/95 px-2 py-1.5 shadow-floating backdrop-blur">
          {pinned ? (
            <span className="px-1 text-fg3" aria-label="Pinned position">
              <LockSimple size={15} />
            </span>
          ) : (
            <button
              type="button"
              {...attributes}
              {...listeners}
              aria-label={`Reorder ${label}`}
              className="cursor-grab rounded px-1 text-fg3 hover:text-fg active:cursor-grabbing"
            >
              <DotsSixVertical size={16} />
            </button>
          )}
          <span className="text-xs font-medium text-fg2">{label}</span>
          <span className="text-xs text-fg3">{variantLabel}</span>
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5 rounded-lg border border-rule bg-panel/95 px-2 py-1.5 shadow-floating backdrop-blur">
          {canSkin && skins.map((sk) => (
            <button
              key={sk.id}
              type="button"
              onClick={() => onSkinChange(sk.id)}
              className={[
                'rounded-full px-2.5 py-0.5 text-xs transition-colors',
                sk.id === activeSkin ? 'bg-fg text-bg' : 'text-fg3 hover:text-fg',
              ].join(' ')}
            >
              {sk.label}
            </button>
          ))}
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${label}`}
            className="rounded px-1 text-fg3 hover:text-[var(--danger)]"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {children}

      {/* Add-between affordance, revealed on hover of the gap. */}
      {!isLast && (
        <div className="pointer-events-none absolute inset-x-0 -bottom-3 z-20 flex justify-center opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={onAddAfter}
            aria-label={`Add a section after ${label}`}
            className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full border border-rule bg-panel text-fg3 shadow-floating hover:border-accent hover:text-accent"
          >
            <Plus size={15} weight="bold" />
          </button>
        </div>
      )}
    </div>
  );
}
