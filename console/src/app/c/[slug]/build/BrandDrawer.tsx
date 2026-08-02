'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import {
  CaretDoubleRight, CaretDoubleLeft, IdentificationCard, Palette, TextAa, Images,
  MagnifyingGlass, Wrench, Question, Star, Buildings, ListDashes,
} from '@phosphor-icons/react';
import type { SiteContent } from '@/data/site';
import { Field, Area, type SetField } from '@/components/fields';
import BrandPane from './brand/BrandPane';
import PalettePane from './brand/PalettePane';
import TypographyPane from './brand/TypographyPane';
import ImagesPane from './brand/ImagesPane';
import ImageTile from './brand/ImageTile';
import ListPane from './brand/ListPane';
import NavLinksPane from './brand/NavLinksPane';
import FieldPalette from './brand/FieldPalette';
import { emptyCountsByTab, type FieldEntry } from '@/lib/fieldIndex';
import { focusPath } from '@/lib/focusPath';

// Docked, resizable control panel for everything that isn't naturally inline-editable.
// Every control writes through setField(path, value) into the same edits layer the inline
// <E> editors use. Because it's an in-flow flex sibling of <main>, resizing reflows the
// preview rather than covering it — which is why <main> carries min-w-0.
//
// The panel is a vertical tablist: one concern on screen at a time. The rail stays visible
// when collapsed so any pane is one click away, and becomes icon+label once the panel is
// wide enough to afford it — ten icons alone read poorly (a wrench and a building are both
// plausible for "Services" or "Work"), and labels also remove the need to scroll the rail.
// Panes unmount on switch, keeping a single dnd-kit DndContext alive at a time.

const RAIL_W = 48;        // icon-only
const RAIL_W_WIDE = 136;  // icon + label
const LABEL_AT = 440;     // panel width at which labels earn their space
const MIN_W = 320;
const DEFAULT_W = 380;
const maxW = () => Math.min(720, Math.round(window.innerWidth * 0.6));

// Chrome preferences, deliberately NOT per-client (unlike jdd-wizard:<slug>, which is content).
const K_TAB = 'jdd-brand-drawer:tab';
const K_WIDTH = 'jdd-brand-drawer:width';
const K_OPEN = 'jdd-brand-drawer:open';

const TABS = [
  { id: 'brand', label: 'Brand', Icon: IdentificationCard, group: 'look' },
  { id: 'palette', label: 'Palette', Icon: Palette, group: 'look' },
  { id: 'type', label: 'Type', Icon: TextAa, group: 'look' },
  { id: 'images', label: 'Images', Icon: Images, group: 'look' },
  { id: 'services', label: 'Services', Icon: Wrench, group: 'content' },
  { id: 'faq', label: 'FAQ', Icon: Question, group: 'content' },
  { id: 'reviews', label: 'Reviews', Icon: Star, group: 'content' },
  { id: 'work', label: 'Work', Icon: Buildings, group: 'content' },
  { id: 'nav', label: 'Nav', Icon: ListDashes, group: 'content' },
  { id: 'seo', label: 'SEO', Icon: MagnifyingGlass, group: 'meta' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function BrandDrawer({
  content, setField, order,
}: {
  content: SiteContent; setField: SetField;
  /** Page body order — the nav pane uses it to offer only on-page link targets. */
  order: string[];
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabId>('brand');
  const [width, setWidth] = useState(DEFAULT_W);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ x: number; w: number } | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const reduce = useReducedMotion();

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);

  // Labels only once the panel is wide enough that they don't crowd the pane.
  const showLabels = open && width >= LABEL_AT;

  // Empty-field counts per tab. Computed from real values via FIELD_INDEX — deliberately
  // not from _meta.missing_fields, whose entries are intake-form paths that often don't
  // correspond to anything editable here.
  const emptyCounts = useMemo(() => emptyCountsByTab(content), [content]);

  // Cmd/Ctrl+K opens the field finder. Bound on the drawer subtree rather than the window
  // so it can't hijack the shortcut while the operator is working elsewhere in the wizard.
  //
  // stopPropagation is load-bearing, not defensive: <CommandPalette> binds ⌘K on `window`.
  // preventDefault only cancels the browser's default action — the event still bubbles to
  // the window listener, so ⌘K inside this drawer used to open BOTH palettes stacked on
  // each other. Stopping propagation is what makes the subtree binding actually scoped.
  function onDrawerKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation();
      if (!open) { setOpen(true); persist(K_OPEN, '1'); }
      setPaletteOpen(true);
    }
  }

  /**
   * Jump from a palette result to its field. The target input doesn't exist until the
   * owning pane has rendered, so record the intent and let an effect do the focusing —
   * deliberately not requestAnimationFrame, which never fires in a backgrounded tab and
   * would make the jump silently do nothing.
   */
  function gotoField(entry: FieldEntry) {
    selectTab(entry.tab as TabId);
    setPendingFocus(entry.path);
  }

  useEffect(() => {
    if (!pendingFocus) return;
    focusPath(pendingFocus, { surface: 'drawer', smooth: !reduce });
    setPendingFocus(null);
  }, [pendingFocus, tab, reduce]);

  // Restore prefs after mount — reading localStorage in a useState initializer would
  // desync the server-rendered markup and trip a hydration mismatch.
  useEffect(() => {
    try {
      const t = localStorage.getItem(K_TAB);
      if (t && TABS.some((x) => x.id === t)) setTab(t as TabId);
      const w = Number(localStorage.getItem(K_WIDTH));
      if (Number.isFinite(w) && w >= MIN_W) setWidth(Math.min(w, maxW()));
      if (localStorage.getItem(K_OPEN) === '1') setOpen(true);
    } catch {
      /* ignore unavailable storage */
    }
  }, []);

  const persist = useCallback((k: string, v: string) => {
    try { localStorage.setItem(k, v); } catch { /* ignore */ }
  }, []);

  function selectTab(id: TabId) {
    setTab(id);
    persist(K_TAB, id);
    if (!open) {
      setOpen(true);
      persist(K_OPEN, '1');
    }
  }

  function toggleOpen() {
    setOpen((v) => {
      persist(K_OPEN, v ? '0' : '1');
      return !v;
    });
  }

  // ── Resize ────────────────────────────────────────────────────────────────
  function onPointerDown(e: React.PointerEvent) {
    if (!open) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, w: width };
    setDragging(true);
    document.body.style.userSelect = 'none';
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    // Dragging left widens the panel.
    const next = dragRef.current.w + (dragRef.current.x - e.clientX);
    setWidth(Math.min(maxW(), Math.max(MIN_W, next)));
  }

  function endDrag(e: React.PointerEvent) {
    if (!dragRef.current) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    dragRef.current = null;
    setDragging(false);
    document.body.style.userSelect = '';
    persist(K_WIDTH, String(width));
  }

  // Keep the panel inside the clamp if the window shrinks under it.
  useEffect(() => {
    function onResize() { setWidth((w) => Math.min(w, maxW())); }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Roving focus for the tablist.
  function onRailKeyDown(e: React.KeyboardEvent, i: number) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const next = (i + (e.key === 'ArrowDown' ? 1 : -1) + TABS.length) % TABS.length;
    tabRefs.current[next]?.focus();
    selectTab(TABS[next].id);
  }

  return (
    // The WRAPPER owns the width and the transition, not the <aside>.
    // Sizing the aside instead creates a circular dependency — the aside's animating width
    // feeds this wrapper's flex-basis:auto, which changes the space available to the aside —
    // and the width transition stalls partway (observed: stuck at the 48px rail width while
    // the inline style already said 380px). shrink-0 keeps <main>'s flex-1 from squeezing it.
    <div
      onKeyDown={onDrawerKeyDown}
      style={{ width: open ? width : RAIL_W }}
      className={[
        'relative flex h-full shrink-0',
        dragging || reduce ? '' : 'transition-[width] duration-300 ease-out',
      ].join(' ')}
    >
      {/* Resize handle — on the outer wrapper, since <aside> is overflow-hidden and would clip it. */}
      {open && (
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onDoubleClick={() => { setWidth(DEFAULT_W); persist(K_WIDTH, String(DEFAULT_W)); }}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize brand panel"
          className="group absolute left-0 top-0 z-20 h-full w-1.5 -translate-x-1/2 cursor-col-resize"
        >
          <div
            className={[
              'mx-auto h-full w-px transition-colors',
              dragging ? 'bg-uiAccent' : 'bg-transparent group-hover:bg-uiAccent',
            ].join(' ')}
          />
        </div>
      )}

      <aside className="h-full w-full overflow-hidden border-l border-uiRule bg-uiBg text-uiFg">
        <div className="flex h-full">
          {/* ── Rail: icon-only when narrow/collapsed, icon+label when there's room ── */}
          <div
            style={{ width: showLabels ? RAIL_W_WIDE : RAIL_W }}
            className={[
              'flex shrink-0 flex-col gap-1 overflow-y-auto border-r border-uiRule py-2',
              showLabels ? 'items-stretch px-1.5' : 'items-center',
            ].join(' ')}
          >
            <button
              type="button"
              onClick={toggleOpen}
              aria-label={open ? 'Collapse brand panel' : 'Expand brand panel'}
              aria-expanded={open}
              className={[
                'mb-1 flex shrink-0 items-center gap-2 rounded-md p-2 text-uiFg3 hover:bg-uiSurface hover:text-uiFg',
                showLabels ? 'justify-start' : 'justify-center',
              ].join(' ')}
            >
              {open ? <CaretDoubleRight size={16} /> : <CaretDoubleLeft size={16} />}
              {showLabels && <span className="text-xs">Collapse</span>}
            </button>

            <div role="tablist" aria-orientation="vertical" aria-label="Brand settings" className="flex flex-col gap-1">
              {TABS.map(({ id, label, Icon, group }, i) => {
                const active = open && tab === id;
                const startsGroup = i > 0 && TABS[i - 1].group !== group;
                return (
                  <div key={id} className={startsGroup ? 'mt-1 border-t border-uiRule pt-1' : undefined}>
                    <button
                      ref={(el) => { tabRefs.current[i] = el; }}
                      type="button"
                      role="tab"
                      id={`brand-tab-${id}`}
                      aria-selected={active}
                      aria-controls={`brand-panel-${id}`}
                      tabIndex={tab === id ? 0 : -1}
                      onClick={() => selectTab(id)}
                      onKeyDown={(e) => onRailKeyDown(e, i)}
                      title={showLabels ? undefined : label}
                      className={[
                        'relative flex w-full shrink-0 items-center gap-2 rounded-md p-2 transition-colors',
                        showLabels ? 'justify-start' : 'justify-center',
                        active
                          ? 'bg-uiSurface2 text-uiAccent'
                          : 'text-uiFg3 hover:bg-uiSurface hover:text-uiFg',
                      ].join(' ')}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-uiAccent" />
                      )}
                      <Icon size={17} className="shrink-0" />
                      {showLabels && <span className="truncate text-xs">{label}</span>}
                      {emptyCounts[id] ? (
                        <span
                          aria-label={`${emptyCounts[id]} empty field${emptyCounts[id] > 1 ? 's' : ''}`}
                          className={[
                            'rounded-full bg-amber-100 font-chromeMono text-2xs leading-none text-amber-700',
                            showLabels
                              ? 'ml-auto px-1.5 py-0.5'
                              : 'absolute right-0.5 top-0.5 px-1 py-0.5',
                          ].join(' ')}
                        >
                          {emptyCounts[id]}
                        </span>
                      ) : null}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Active pane ───────────────────────────────────────────────── */}
          {open && (
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex shrink-0 items-center gap-2 border-b border-uiRule px-4 py-3">
                <p className="font-display text-sm font-medium text-uiFg">
                  {TABS.find((t) => t.id === tab)?.label}
                </p>
                {emptyCounts[tab] ? (
                  <p className="truncate font-chromeMono text-kicker text-amber-700">
                    {emptyCounts[tab]} empty
                  </p>
                ) : null}
                {/* Visible affordance — a keyboard-only shortcut nobody knows about is no feature. */}
                <button
                  type="button"
                  onClick={() => setPaletteOpen(true)}
                  aria-label="Find a field"
                  className="ml-auto flex shrink-0 items-center gap-1 rounded border border-uiRule px-1.5 py-0.5 font-chromeMono text-2xs uppercase tracking-widest text-uiFg3 hover:border-uiAccent hover:text-uiAccent"
                >
                  <MagnifyingGlass size={10} /> ⌘K
                </button>
              </div>

              <div
                role="tabpanel"
                id={`brand-panel-${tab}`}
                aria-labelledby={`brand-tab-${tab}`}
                tabIndex={0}
                className="min-h-0 flex-1 overflow-y-auto"
              >
                {tab === 'brand' && <BrandPane content={content} setField={setField} />}

                {tab === 'palette' && <PalettePane content={content} setField={setField} />}
                {tab === 'type' && <TypographyPane content={content} setField={setField} />}
                {tab === 'images' && <ImagesPane content={content} setField={setField} />}

                {tab === 'services' && (
                  <ListPane
                    content={content} setField={setField} basePath="services.items"
                    labelKey="t" singular="Service"
                    makeBlank={() => ({ n: '', t: 'New service', d: '', tag: '' })}
                    renderExtra={(i) => (
                      <ImageTile
                        content={content} setField={setField}
                        path={`services.items.${i}.image.url`} label="Photo"
                      />
                    )}
                  />
                )}
                {tab === 'faq' && (
                  <ListPane
                    content={content} setField={setField} basePath="faq.items"
                    labelKey="q" focusKey="a" singular="Question"
                    makeBlank={() => ({ q: 'New question', a: '' })}
                  />
                )}
                {tab === 'reviews' && (
                  <ListPane
                    content={content} setField={setField} basePath="testimonials.items"
                    labelKey="a" focusKey="q" singular="Review"
                    makeBlank={() => ({ q: '', a: 'New reviewer', r: '', company: '', stars: 5 })}
                  />
                )}
                {tab === 'work' && (
                  <ListPane
                    content={content} setField={setField} basePath="work.projects"
                    labelKey="t" singular="Project"
                    makeBlank={() => ({ t: 'New project', loc: '', yr: null, scope: '', size: '', caption: '' })}
                    renderExtra={(i) => (
                      <ImageTile
                        content={content} setField={setField}
                        path={`work.projects.${i}.image.url`} label="Photo"
                      />
                    )}
                  />
                )}
                {tab === 'nav' && (
                  <NavLinksPane content={content} setField={setField} order={order} />
                )}

                {/* googleAnalyticsId / facebookPixelId deliberately absent: the gtag and fbq
                    snippets that consumed them live in SeoDefault's default export, which
                    wirePage never imports (it re-exports generateMetadata only, and `seo`
                    isn't a BODY_SLOT) — so they have never fired on a client site. Offering
                    the fields implied analytics was installed when it wasn't. The schema
                    fields themselves come out in the v1.5.0 bump. */}
                {tab === 'seo' && (
                  <div className="space-y-3 px-4 py-4">
                    <Field content={content} setField={setField} path="seo.title" label="Title" />
                    <Area content={content} setField={setField} path="seo.description" label="Description" />
                    <Field content={content} setField={setField} path="seo.canonical" label="Canonical URL" type="url" />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </aside>

      <FieldPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onPick={gotoField} />
    </div>
  );
}
