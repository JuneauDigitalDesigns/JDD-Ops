# Plan — Multi-page Studio UI restructure (Phase D-UI)

**Author:** Opus (planning). **Executor:** Sonnet.
**Date:** 2026-09-28
**Repo:** `ops/jdd-ops/console`
**Scope:** UI restructure of the multi-page build surface + one `PreviewFrame` bug fix + dead-code cleanup.
**Explicitly OUT of scope:** the multi-page **export** path (Phase E — retiring `homeLegacyView`, real per-page export). Separate plan, drafted after a short follow-up discussion. Do **not** touch `pages.ts`, `page-templates.tsx`, `compose-page.tsx`, `LaunchDialog`, `DeployDialog`, the `homeLegacyView`/`legacy`/`exportEntries` wiring, or the legacy `selections/skins/order` layer in `BuildWizard`.

> **How to apply these edits:** anchor on the **quoted source text**, not the line numbers (line numbers are "as of this reading" and may drift). Every snippet below is copied verbatim from the current files.

---

## 0. Context — how it works today (verified against source)

- Build tool = 2-step wizard `BuildWizard.tsx` (Intake → Studio). The Studio step renders **`PageStudio.tsx`** only. `StudioStep.tsx` is **not referenced** by `BuildWizard`.
- `BuildWizard` passes `PageStudio` the `SiteComposition` + setters: `onSelectTemplate`, `onAddPage`, `onRemovePage`, `onRenameLabel`, `onToggleNav`, `onSetChrome`, `onSetSectionSkin`, `setField`, `onResetEdits`, `onResetStyles`, `onUndo`/`onRedo`/`canUndo`/`canRedo`, `alreadyDeployed`, `brandName`, `reverts`. **Keep this prop contract unchanged** — no step below edits `BuildWizard`.
- `PageStudio` today = left `<aside>` pages rail + center (toolbar → template strip → live preview) + overlays (`AllPagesPreview`, `SiteStylePanel`, `LaunchDialog`, `DeployDialog`).
- `PreviewFrame.tsx` renders preview inside a real `<iframe>`. Modes: `scaled` (fixed virtual width, CSS-scaled to fit — used by template thumbnails + `SiteStylePanel`) and `fluid` (`height: 100%`).
- Registry facts (from `page-templates.tsx`): `pageMetaFor(pt)` → `{ route, label }`; `OPTIONAL_PAGE_TYPES = ['reviews','gallery','areas']`; `pageFromType(pt)` builds a `PageInstance`. `composePage(page, chrome, categories, effective)` (from `compose-page.tsx`) → `{ key, node }[]`.

### The bug (verified)
The live preview at `PageStudio.tsx` uses:
```tsx
<PreviewFrame brand={effective.brand} mode="fluid" className="min-h-[70vh] w-full">
```
`fluid`'s outer div sets **inline** `height: 100%` (`PreviewFrame.tsx`, `outerStyle`), which beats the `min-h-[70vh]` class and has no resolved parent height to resolve against (it's inside `<div className="p-5">` → `min-h-0 flex-1 overflow-y-auto`), so the iframe collapses to a sliver. Fix = a new **`flow`** mode: full width, scale 1, height = measured content height, so the existing `overflow-y-auto` column scrolls the whole page.

---

## 1. Target UX (locked with user)

**Preview screen (default):** no left rail; toolbar top-left button **"Add or change page"** (replaces the page-name label, shows active page as secondary text) opens a **full-screen Pages menu**; template strip is **collapsible**; preview **fills width**, renders **natural full height**, **scrolls as one** column; no zoom. Inline editing + per-section skin pills kept.

**Pages menu (full-screen overlay, catalog pattern + transition, covers toolbar):** one **thumbnail card per page**; click → open that page. Per-card **rename / remove (non-home) / nav toggle**. **Add page** tile → adds + lands on the new page's preview. **Site style** lives here. **No reordering.** Entry = toolbar button only.

**Removed:** the **"Preview all pages"** button + `AllPagesPreview.tsx`.

Minor tension: user chose "scroll as one" **and** "collapsible strip." Implemented literally — one scrollbar; collapse is a space-reclaim toggle on the strip. Do **not** make the strip `position: sticky`. If it feels wrong in review, flag it; don't silently change the model.

---

## 2. File-by-file edits (exact anchors)

### 2.1 `src/app/c/[slug]/build/PreviewFrame.tsx` — add `flow` mode

**Edit 1 — Mode type.** Replace:
```tsx
type Mode = 'scaled' | 'fluid';
```
with:
```tsx
type Mode = 'scaled' | 'fluid' | 'flow';
```

**Edit 2 — mount immediately for flow too.** Replace:
```tsx
  const [visible, setVisible] = useState(mode === 'fluid'); // fluid mounts immediately
```
with:
```tsx
  const [visible, setVisible] = useState(mode !== 'scaled'); // fluid + flow mount immediately; scaled lazy-mounts
```

**Edit 3 — measure content height for flow as well as scaled.** Replace:
```tsx
  // Measure rendered content height for scaled mode (re-run on resize + late image/font loads).
  useEffect(() => {
    if (mode !== 'scaled' || !mountEl) return;
```
with:
```tsx
  // Measure rendered content height for scaled + flow modes (re-run on resize + late image/font loads).
  useEffect(() => {
    if (mode === 'fluid' || !mountEl) return;
```

**Edit 4 — iframe style.** Replace:
```tsx
  const iframeStyle: CSSProperties =
    mode === 'scaled'
      ? {
          width: virtualWidth,
          height: h,
          border: 0,
          display: 'block',
          transformOrigin: 'top left',
          transform: `scale(${scale})`,
        }
      : { width: '100%', height: '100%', border: 0, display: 'block' };
```
with:
```tsx
  const iframeStyle: CSSProperties =
    mode === 'scaled'
      ? {
          width: virtualWidth,
          height: h,
          border: 0,
          display: 'block',
          transformOrigin: 'top left',
          transform: `scale(${scale})`,
        }
      : mode === 'flow'
      ? { width: '100%', height: h, border: 0, display: 'block' }
      : { width: '100%', height: '100%', border: 0, display: 'block' };
```

**Edit 5 — outer style.** Replace:
```tsx
  const outerStyle: CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    width: '100%',
    ...(mode === 'scaled' ? { height: h * scale } : { height: '100%' }),
  };
```
with:
```tsx
  const outerStyle: CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    width: '100%',
    ...(mode === 'scaled' ? { height: h * scale } : mode === 'flow' ? { height: h } : { height: '100%' }),
  };
```

`scale` stays `1` for `flow` (its guard is `mode === 'scaled' && containerW`). Leave `scaled` and `fluid` behavior untouched.

### 2.2 `src/app/c/[slug]/build/PageStudio.tsx`

**Edit A — imports.** Replace the phosphor import:
```tsx
import {
  Plus, X, Eye, EyeSlash, PencilSimple, Check, House, Cards, Rocket, RocketLaunch,
  ArrowUUpLeft, ArrowUUpRight, ArrowCounterClockwise, Palette, TextAa, Swatches,
} from '@phosphor-icons/react';
```
with (drops rail/overlay-only icons, adds carets + reuses `Cards` for the button):
```tsx
import {
  Check, Cards, CaretDown, CaretRight, Rocket, RocketLaunch,
  ArrowUUpLeft, ArrowUUpRight, ArrowCounterClockwise, Palette, TextAa,
} from '@phosphor-icons/react';
```

Replace the page-templates import:
```tsx
import { templatesFor, applyTemplate, pageMetaFor, pageFromType, OPTIONAL_PAGE_TYPES } from './page-templates';
```
with:
```tsx
import { templatesFor, applyTemplate, pageMetaFor } from './page-templates';
```

Replace the AllPagesPreview import line:
```tsx
import AllPagesPreview from './AllPagesPreview';
```
with:
```tsx
import PagesMenu from './PagesMenu';
```

Also drop `pageFromType` and `OPTIONAL_PAGE_TYPES` from the type import from `@/lib/pages` **only if** they were imported there (they are not — leave that import as-is). Remove now-unused `homeLegacyView`? **No** — it stays (used by `legacy`).

**Edit B — state.** Replace:
```tsx
  const [activeRoute, setActiveRoute] = useState('');
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [previewAll, setPreviewAll] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);
  const [launchOpen, setLaunchOpen] = useState(false);
  const [deployOpen, setDeployOpen] = useState(false);
```
with (`editingLabel`/`addOpen` move to PagesMenu; `previewAll` removed; add `pagesOpen`/`stripCollapsed`):
```tsx
  const [activeRoute, setActiveRoute] = useState('');
  const [pagesOpen, setPagesOpen] = useState(false);
  const [stripCollapsed, setStripCollapsed] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);
  const [launchOpen, setLaunchOpen] = useState(false);
  const [deployOpen, setDeployOpen] = useState(false);
```

**Edit C — remove the now-unused derived vars.** Delete:
```tsx
  const availableOptional = OPTIONAL_PAGE_TYPES.filter((pt) => !composition.pages.some((p) => p.pageType === pt));
  const canAddPage = availableOptional.length > 0 && composition.pages.length < 7;
```
(They move into `PagesMenu`.) Keep `const templates = templatesFor(activePage.pageType);`.

**Edit D — delete the entire left rail.** Remove the whole block that starts:
```tsx
      {/* ── Pages rail ──────────────────────────────────────────────────── */}
      <aside className="flex w-[220px] shrink-0 flex-col border-r border-rule bg-panel">
```
…through its closing `</aside>` (the block ending with the Add-page popover, just before `{/* ── Center: toolbar + template picker + live preview ────────────── */}`).

**Edit E — toolbar top-left button.** Replace:
```tsx
          <span className="font-heading text-sm font-semibold text-fg">{activePage.label}</span>
          <span className="text-xs text-fg3">{templates.length > 1 ? `${templates.length} templates` : '1 template'}</span>
```
with:
```tsx
          <button type="button" onClick={() => setPagesOpen(true)} className="btn btn-sm">
            <Cards size={15} weight="bold" /> Add or change page
            <span className="font-normal text-fg3">· {activePage.label}</span>
          </button>
```

**Edit F — remove Site style + Preview all pages from the toolbar.** Delete these two lines:
```tsx
            <button type="button" onClick={() => setStyleOpen(true)} className="btn btn-sm"><Swatches size={15} weight="bold" /> Site style</button>
            <button type="button" onClick={() => setPreviewAll(true)} className="btn btn-sm"><Cards size={15} weight="bold" /> Preview all pages</button>
```
(Keep undo/redo, reset styles, reset text, Launch/Re-export, Deploy exactly as they are.)

**Edit G — collapsible strip + flow preview.** Replace the scroll region block:
```tsx
        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Template picker */}
          <div className="border-b border-rule bg-panel/40 px-5 py-4">
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-fg3">Template</div>
            <div className="flex flex-wrap gap-4">
              {templates.map((tmpl) => {
                const selected = tmpl.id === activePage.templateId;
                const nodes = composePage(applyTemplate(activePage, tmpl), composition.chrome, categories, effective);
                return (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => onSelectTemplate(activePage.route, tmpl.id)}
                    className={`w-[280px] overflow-hidden rounded-xl border text-left transition-all hover:-translate-y-0.5 ${
                      selected ? 'border-accent ring-1 ring-accent' : 'border-rule hover:border-fg3'
                    }`}
                  >
                    <div className="pointer-events-none h-[200px] overflow-hidden bg-bg">
                      <PreviewFrame brand={effective.brand} mode="scaled" virtualWidth={1280}>
                        {nodes.map((n) => <Fragment key={n.key}>{n.node}</Fragment>)}
                      </PreviewFrame>
                    </div>
                    <div className="flex items-center justify-between gap-2 border-t border-rule bg-panel px-3 py-2">
                      <span className="text-sm font-medium text-fg">{tmpl.label}</span>
                      {selected && <Check size={15} weight="bold" className="text-accent" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live, inline-editable preview of the active page */}
          <div className="p-5">
            <div className="overflow-hidden rounded-xl border border-rule bg-bg shadow-panel">
              <EditProvider setField={setField} overrides={effective.overrides}>
                <PreviewFrame brand={effective.brand} mode="fluid" className="min-h-[70vh] w-full">
                  {editableNodes.map((n) => <Fragment key={n.key}>{n.node}</Fragment>)}
                </PreviewFrame>
              </EditProvider>
            </div>
          </div>
        </div>
```
with:
```tsx
        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Template picker — collapsible, so the preview can take the full column */}
          <div className="border-b border-rule bg-panel/40 px-5 py-4">
            <button
              type="button"
              onClick={() => setStripCollapsed((c) => !c)}
              className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-fg3 hover:text-fg"
            >
              {stripCollapsed ? <CaretRight size={12} weight="bold" /> : <CaretDown size={12} weight="bold" />}
              Template
              <span className="normal-case tracking-normal text-fg3">
                · {templates.length > 1 ? `${templates.length} options` : '1 option'}
              </span>
            </button>
            {!stripCollapsed && (
              <div className="flex flex-wrap gap-4">
                {templates.map((tmpl) => {
                  const selected = tmpl.id === activePage.templateId;
                  const nodes = composePage(applyTemplate(activePage, tmpl), composition.chrome, categories, effective);
                  return (
                    <button
                      key={tmpl.id}
                      type="button"
                      onClick={() => onSelectTemplate(activePage.route, tmpl.id)}
                      className={`w-[280px] overflow-hidden rounded-xl border text-left transition-all hover:-translate-y-0.5 ${
                        selected ? 'border-accent ring-1 ring-accent' : 'border-rule hover:border-fg3'
                      }`}
                    >
                      <div className="pointer-events-none h-[200px] overflow-hidden bg-bg">
                        <PreviewFrame brand={effective.brand} mode="scaled" virtualWidth={1280}>
                          {nodes.map((n) => <Fragment key={n.key}>{n.node}</Fragment>)}
                        </PreviewFrame>
                      </div>
                      <div className="flex items-center justify-between gap-2 border-t border-rule bg-panel px-3 py-2">
                        <span className="text-sm font-medium text-fg">{tmpl.label}</span>
                        {selected && <Check size={15} weight="bold" className="text-accent" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Live, inline-editable preview — flow mode: full width, natural height,
              scrolls within this one column ("scroll as one"). */}
          <div className="p-5">
            <div className="overflow-hidden rounded-xl border border-rule bg-bg shadow-panel">
              <EditProvider setField={setField} overrides={effective.overrides}>
                <PreviewFrame brand={effective.brand} mode="flow" className="w-full">
                  {editableNodes.map((n) => <Fragment key={n.key}>{n.node}</Fragment>)}
                </PreviewFrame>
              </EditProvider>
            </div>
          </div>
        </div>
```

**Edit H — swap the AllPagesPreview overlay for PagesMenu.** Replace:
```tsx
      {/* ── Tabbed all-pages preview ────────────────────────────────────── */}
      {previewAll && (
        <AllPagesPreview
          composition={composition}
          categories={categories}
          effective={effective}
          onClose={() => setPreviewAll(false)}
        />
      )}
```
with:
```tsx
      {/* ── Full-screen Pages menu (open / add / rename / remove / nav / site style) ── */}
      <AnimatePresence>
        {pagesOpen && (
          <PagesMenu
            composition={composition}
            categories={categories}
            effective={effective}
            activeRoute={activePage.route}
            onOpenPage={(route) => { setActiveRoute(route); setPagesOpen(false); }}
            onAddPage={(pt) => { onAddPage(pt); setActiveRoute(pageMetaFor(pt).route); setPagesOpen(false); }}
            onRemovePage={onRemovePage}
            onRenameLabel={onRenameLabel}
            onToggleNav={onToggleNav}
            onOpenSiteStyle={() => setStyleOpen(true)}
            onClose={() => setPagesOpen(false)}
          />
        )}
      </AnimatePresence>
```
Leave the `{styleOpen && <SiteStylePanel … />}` block and the Launch/Deploy blocks exactly as they are — `SiteStylePanel` is now opened from inside `PagesMenu` via `onOpenSiteStyle`, and its `z-[110]` sits above the menu's `z-40`.

> **On the add-then-open sequencing:** `onAddPage(pt)` (BuildWizard's `addPage`) appends the page via `setSiteComposition`; `setActiveRoute(pageMetaFor(pt).route)` targets it. Both batch in one tick, so after commit the composition contains the new page and the validation effect (`if (!composition.pages.some(p => p.route === activeRoute)) setActiveRoute('')`) keeps it. `addPage` no-ops on duplicate page types, and `PagesMenu` only offers types not already present — no dup risk.

### 2.3 New file: `src/app/c/[slug]/build/PagesMenu.tsx`

Create this file verbatim:
```tsx
'use client';

import { Fragment, useEffect, useState } from 'react';
import { Plus, X, Eye, EyeSlash, PencilSimple, House, Swatches } from '@phosphor-icons/react';
import { motion, useReducedMotion } from 'framer-motion';
import type { SiteContent } from '@/data/site';
import type { CategoryEntry } from './categories';
import type { PageTypeId, SiteComposition } from '@/lib/pages';
import { composePage } from './compose-page';
import { pageMetaFor, OPTIONAL_PAGE_TYPES } from './page-templates';
import PreviewFrame from './PreviewFrame';
import { EASE } from '@/lib/motion';

/**
 * Full-screen Pages menu. Mirrors CatalogOverlay's shell (fade transition, header + close). Each
 * page is a live thumbnail card with inline management (open / rename / remove / nav visibility);
 * plus an Add-page tile and a Site style entry. Page-level management used to live in PageStudio's
 * left rail — this replaces it, and the tabbed AllPagesPreview it also supersedes.
 */
export default function PagesMenu({
  composition, categories, effective, activeRoute,
  onOpenPage, onAddPage, onRemovePage, onRenameLabel, onToggleNav, onOpenSiteStyle, onClose,
}: {
  composition: SiteComposition;
  categories: CategoryEntry[];
  effective: SiteContent;
  activeRoute: string;
  onOpenPage: (route: string) => void;
  onAddPage: (pageType: PageTypeId) => void;
  onRemovePage: (route: string) => void;
  onRenameLabel: (route: string, label: string) => void;
  onToggleNav: (route: string) => void;
  onOpenSiteStyle: () => void;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const availableOptional = OPTIONAL_PAGE_TYPES.filter((pt) => !composition.pages.some((p) => p.pageType === pt));
  const canAddPage = availableOptional.length > 0 && composition.pages.length < 7;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0 : 0.2, ease: EASE }}
      className="absolute inset-0 z-40 flex flex-col bg-panel"
    >
      <header className="flex shrink-0 items-center gap-4 border-b border-rule px-6 py-4">
        <h2 className="font-display text-2xl font-semibold text-fg">Pages</h2>
        <span className="text-sm text-fg3">{composition.pages.length}</span>
        <button type="button" onClick={onOpenSiteStyle} className="btn btn-sm">
          <Swatches size={15} weight="bold" /> Site style
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close pages menu"
          className="ml-auto rounded-md p-2 text-fg3 hover:bg-surface hover:text-fg"
        >
          <X size={20} />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="step-body grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {composition.pages.map((page) => {
            const home = page.route === '';
            const isActive = page.route === activeRoute;
            const nodes = composePage(page, composition.chrome, categories, effective);
            return (
              <div
                key={page.route || 'home'}
                className={`group overflow-hidden rounded-xl border transition-all ${
                  isActive ? 'border-accent ring-1 ring-accent' : 'border-rule hover:border-fg3'
                }`}
              >
                <button type="button" onClick={() => onOpenPage(page.route)} className="block w-full text-left">
                  <div className="pointer-events-none h-[220px] overflow-hidden bg-bg">
                    <PreviewFrame brand={effective.brand} mode="scaled" virtualWidth={1280}>
                      {nodes.map((n) => <Fragment key={n.key}>{n.node}</Fragment>)}
                    </PreviewFrame>
                  </div>
                </button>
                <div className="flex items-center gap-2 border-t border-rule bg-panel px-3 py-2">
                  {home ? <House size={14} className="shrink-0 text-fg3" /> : <span className="w-3.5" />}
                  {editingLabel === page.route ? (
                    <input
                      autoFocus
                      defaultValue={page.label}
                      onBlur={(e) => { onRenameLabel(page.route, e.target.value.trim() || page.label); setEditingLabel(null); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditingLabel(null); }}
                      className="w-full rounded border border-rule bg-bg px-1.5 py-0.5 text-sm text-fg outline-none focus:border-accent"
                    />
                  ) : (
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{page.label}</span>
                  )}
                  <span className="shrink-0 text-2xs text-fg3">/{page.route || ''}</span>
                  <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    <button
                      type="button"
                      onClick={() => onToggleNav(page.route)}
                      title={page.navVisible ? 'In nav — click to hide' : 'Hidden from nav — click to show'}
                      className="rounded p-1 text-fg3 hover:text-fg"
                    >
                      {page.navVisible ? <Eye size={13} /> : <EyeSlash size={13} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingLabel(page.route)}
                      title="Rename nav label"
                      className="rounded p-1 text-fg3 hover:text-fg"
                    >
                      <PencilSimple size={13} />
                    </button>
                    {!home && (
                      <button
                        type="button"
                        onClick={() => onRemovePage(page.route)}
                        title="Remove page"
                        className="rounded p-1 text-fg3 hover:text-[var(--danger)]"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Add-page tile */}
          {canAddPage && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setAddOpen((o) => !o)}
                className="flex h-full min-h-[260px] w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-rule text-fg3 transition-colors hover:border-accent hover:text-accent"
              >
                <Plus size={32} weight="light" />
                <span className="font-display text-lg font-semibold">Add page</span>
              </button>
              {addOpen && (
                <div className="absolute inset-x-6 top-1/2 z-10 overflow-hidden rounded-lg border border-rule bg-panel shadow-floating">
                  {availableOptional.map((pt) => (
                    <button
                      key={pt}
                      type="button"
                      onClick={() => { onAddPage(pt); setAddOpen(false); }}
                      className="block w-full px-3 py-2 text-left text-sm text-fg2 hover:bg-surface hover:text-fg"
                    >
                      {pageMetaFor(pt).label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
```

> Class names above (`btn btn-sm`, `text-2xs`, `step-body`, `bg-panel`, `border-rule`, `text-fg/fg2/fg3`, `shadow-floating`, `var(--danger)`) all already exist and are used by the current PageStudio rail / CatalogOverlay — copied from there, not invented. `EASE` is exported from `@/lib/motion` (CatalogOverlay uses it the same way).

### 2.4 Delete `src/app/c/[slug]/build/AllPagesPreview.tsx`

Remove the file (its import + usage in `PageStudio` are removed in Edit A/H). Grep to confirm nothing else imports it.

---

## 3. Dead-code cleanup — superseded single-page canvas

`BuildWizard` renders `PageStudio` only; `StudioStep.tsx` is unreferenced, and its private chain is dead with it. **Delete these four files** (grep each first to confirm no importer outside this set):
- `src/app/c/[slug]/build/StudioStep.tsx`
- `src/app/c/[slug]/build/FullScreenPreview.tsx`  *(only imported by StudioStep)*
- `src/app/c/[slug]/build/CatalogOverlay.tsx`  *(only imported by StudioStep)*
- `src/app/c/[slug]/build/ComponentCard.tsx`  *(only imported by CatalogOverlay)*

**Do NOT delete** `StyleToolbar.tsx` or `BrandDrawer.tsx`. They become unreferenced once StudioStep is gone, but they are latent features (inline style popover; brand-editing drawer) not yet present in `PageStudio` and are Phase-E re-integration candidates. Leave them.

**Keep** `page-order.ts` (BuildWizard imports `reconcileOrder`, `enforcePins`, and the `Selections`/`SkinSelections`/`StudioReverts` types).

---

## 4. Acceptance criteria

1. Studio opens on the **Preview screen**, no left rail; preview renders **full width + full height**, one scrollbar, **no sliver**, no inner iframe scrollbar.
2. Template strip collapses/expands via its caret toggle.
3. Toolbar top-left = **"Add or change page · {page}"**; opens a **full-screen Pages menu** with the catalog fade, covering the toolbar.
4. Pages menu shows a **thumbnail card per page**; clicking one returns to the Preview screen on that page.
5. Rename, remove (non-home), nav-visibility toggle all work from the cards.
6. **Add page** adds the page and lands on the **new page's preview**.
7. **Site style** is reachable from the Pages menu (not the toolbar) and still swaps nav/footer/seo.
8. **"Preview all pages"** button + `AllPagesPreview.tsx` are gone.
9. Inline text editing + per-section skin pills still work in the preview.
10. Launch/Re-export/Deploy behave exactly as before.
11. `StudioStep/FullScreenPreview/CatalogOverlay/ComponentCard` deleted; `StyleToolbar`, `BrandDrawer`, `page-order.ts` retained.

---

## 5. Verification (respect repo caveats)

- **Type-check touched files only** — full `tsc`/`build` is noisy; filter to `PreviewFrame.tsx`, `PageStudio.tsx`, `PagesMenu.tsx`. Do **not** run `next build` over a live dev server. Do **not** use `next dev --turbo` (breaks intake client-schema loading) — use the normal dev server.
- After deletes, grep the repo for imports of each removed module → expect **zero**.
- **Don't trust screenshots of the preview pane** (console preview runs `visibilityState=hidden`, freezing transitions/framer-motion). Verify layout by reasoning about the height chain + DOM/computed styles: confirm the `flow` outer div gets a pixel `height` equal to measured `contentH`, and that the center column scrolls both strip and preview.
- **Never round-trip source through PowerShell `Get-Content`/`Set-Content`** (UTF-8 mojibake) — editor tools only.
- If CSS looks stale after edits, delete `.next` (a restart alone won't clear Turbopack's CSS cache).

---

## 6. Suggested execution order

1. `PreviewFrame.tsx` `flow` mode (isolated).
2. `PageStudio.tsx` Edit G preview → `flow` first; confirm the sliver is fixed before structural edits.
3. Create `PagesMenu.tsx`.
4. `PageStudio.tsx` Edits A–F, H (imports, state, remove rail, toolbar button, remove overlay buttons, wire PagesMenu).
5. Delete `AllPagesPreview.tsx`.
6. Delete the four dead files (§3) + grep confirmation.
7. Filtered type-check + acceptance walk-through.

---

## 7. Phase E (NEXT — separate, do not start here)

After this ships and is reviewed: short discussion, then a separate plan for real multi-page export (retire `homeLegacyView`, per-page `page.tsx` generation, subpage SEO/header copy) and whether to re-integrate `StyleToolbar`/`BrandDrawer` into `PageStudio`.
