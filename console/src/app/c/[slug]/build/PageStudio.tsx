'use client';

import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  Check, Cards, CaretDown, CaretRight, Rocket, RocketLaunch,
  ArrowUUpLeft, ArrowUUpRight, ArrowCounterClockwise, Palette, TextAa,
} from '@phosphor-icons/react';
import { AnimatePresence } from 'framer-motion';
import type { SiteContent } from '@/data/site';
import type { VerticalId } from '@/lib/verticals';
import type { StudioReverts } from './page-order';
import type { CategoryEntry } from './categories';
import type { PageInstance, PageTypeId, SectionRef, SiteComposition } from '@/lib/pages';
import { homeLegacyView, styleKeyFor } from '@/lib/pages';
import { defaultSkin, supportsSkin, type SkinId } from '@/lib/skins';
import { EditProvider } from '@/lib/editable';
import { sectionVars } from '@/lib/palette';
import { templatesFor, applyTemplate, pageMetaFor } from './page-templates';
import { composePage, renderSection } from './compose-page';
import SectionControlPanel from './SectionControlPanel';
import PreviewFrame from './PreviewFrame';
import PagesMenu from './PagesMenu';
import SiteStylePanel from './SiteStylePanel';
import LaunchDialog from './LaunchDialog';
import DeployDialog from './DeployDialog';

/**
 * PageStudio — the multi-page build surface. Two screens: this one (default) is a collapsible
 * template-card strip over a live, inline-editable, full-height preview of the active page; the
 * toolbar's "Add or change page" button opens the other screen, PagesMenu, a full-screen overlay
 * for page-level management (open / add / remove / rename / nav-visibility) and Site style.
 *
 * INTERIM (until Phase E): Launch/Deploy bridge through the existing single-page export via
 * homeLegacyView — they ship the HOME page. Multi-page export replaces this.
 */
export default function PageStudio({
  composition, effective, categories, vertical, slug,
  onSelectTemplate, onAddPage, onRemovePage, onRenameLabel, onToggleNav,
  onSetChrome, onSetSectionSkin, onSetSectionVariant,
  onResetEdits, onResetStyles, setField,
  onUndo, onRedo, canUndo, canRedo,
  alreadyDeployed = false, brandName, reverts,
}: {
  composition: SiteComposition;
  effective: SiteContent;
  categories: CategoryEntry[];
  vertical: VerticalId;
  slug: string;
  onSelectTemplate: (route: string, templateId: string) => void;
  onAddPage: (pageType: PageTypeId) => void;
  onRemovePage: (route: string) => void;
  onRenameLabel: (route: string, label: string) => void;
  onToggleNav: (route: string) => void;
  onSetChrome: (categoryId: 'nav' | 'footer' | 'seo', name: string, skin?: SkinId) => void;
  onSetSectionSkin: (route: string, sectionId: string, skin: SkinId) => void;
  onSetSectionVariant: (route: string, sectionId: string, name: string) => void;
  onResetEdits: () => void;
  onResetStyles: () => void;
  setField: (path: string, value: unknown) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  alreadyDeployed?: boolean;
  brandName?: string;
  reverts: StudioReverts;
}) {
  const [activeRoute, setActiveRoute] = useState('');
  // Which section's hover control panel is open (by its style key). Only one at a time.
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [pagesOpen, setPagesOpen] = useState(false);
  const [stripCollapsed, setStripCollapsed] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);
  const [launchOpen, setLaunchOpen] = useState(false);
  const [deployOpen, setDeployOpen] = useState(false);

  // Keep the active route valid as pages are added/removed.
  useEffect(() => {
    if (!composition.pages.some((p) => p.route === activeRoute)) setActiveRoute('');
  }, [composition.pages, activeRoute]);

  const activePage: PageInstance = composition.pages.find((p) => p.route === activeRoute) ?? composition.pages[0];
  const templates = templatesFor(activePage.pageType);

  // Interim single-page export payload (home + chrome). Removed in Phase E.
  const legacy = useMemo(() => homeLegacyView(composition), [composition]);
  const exportEntries = useMemo(() => {
    const out: { categoryId: string; name: string; label?: string; skin?: string }[] = [];
    for (const id of [...legacy.order, 'seo']) {
      const name = legacy.selections[id];
      if (!name) continue;
      const variant = categories.find((c) => c.id === id)?.variants.find((v) => v.name === name);
      const skin = legacy.skins[id] ?? defaultSkin(name);
      out.push({ categoryId: id, name, label: variant?.label, skin: supportsSkin(name) ? skin : undefined });
    }
    return out;
  }, [legacy, categories]);

  /**
   * The active page's nodes, each wrapped in a SectionShell that (a) scopes this section's own
   * palette/typography via sectionVars and (b) opens the per-section control panel on hover-dwell.
   * Separate from composePage (used for the template thumbnails and all-pages preview, where this
   * chrome would be noise). Every section gets it — body sections keyed by stable id, chrome
   * (nav/footer) by slot name.
   */
  const editableNodes = useMemo(() => {
    const items: { ref: SectionRef; chromeSlot: 'nav' | 'footer' | null }[] = [
      { ref: composition.chrome.nav, chromeSlot: 'nav' },
      ...activePage.sections.map((ref) => ({ ref, chromeSlot: null as 'nav' | 'footer' | null })),
      { ref: composition.chrome.footer, chromeSlot: 'footer' as const },
    ];
    return items.map(({ ref, chromeSlot }, i) => {
      const node = renderSection(ref, activePage, categories, effective);
      const key = `${ref.categoryId}-${i}`;
      const sKey = styleKeyFor(ref);
      const category = categories.find((c) => c.id === ref.categoryId);
      const activeSkinId = ref.skin ?? defaultSkin(ref.name);
      const style = sectionVars(effective.brand, effective.sectionStyles?.[sKey]);

      const panel = (
        <SectionControlPanel
          content={effective}
          styleKey={sKey}
          variantName={ref.name}
          category={category ? { label: category.label, variants: category.variants } : undefined}
          activeSkin={activeSkinId}
          setField={setField}
          onSetSkin={(skin) =>
            chromeSlot ? onSetChrome(chromeSlot, ref.name, skin) : onSetSectionSkin(activePage.route, ref.id ?? ref.categoryId, skin)
          }
          onSetVariant={(name) =>
            chromeSlot ? onSetChrome(chromeSlot, name) : onSetSectionVariant(activePage.route, ref.id ?? ref.categoryId, name)
          }
          onClose={() => setOpenKey(null)}
        />
      );

      return {
        key,
        node: (
          <SectionShell
            style={style}
            isOpen={openKey === sKey}
            onOpen={() => setOpenKey(sKey)}
            onCloseRequest={() => setOpenKey((k) => (k === sKey ? null : k))}
            panel={panel}
          >
            {node}
          </SectionShell>
        ),
      };
    });
  }, [activePage, composition.chrome, categories, effective, openKey, onSetChrome, onSetSectionSkin, onSetSectionVariant, setField]);

  return (
    <div className="flex h-full overflow-hidden bg-bgDeep">
      {/* ── Center: toolbar + template picker + live preview ────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Toolbar */}
        <div className="flex shrink-0 items-center gap-3 border-b border-rule bg-panel px-5 py-2.5">
          <button type="button" onClick={() => setPagesOpen(true)} className="btn btn-sm">
            <Cards size={15} weight="bold" /> Add or change page
            <span className="font-normal text-fg3">· {activePage.label}</span>
          </button>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center">
              <button type="button" onClick={onUndo} disabled={!canUndo} title="Undo" className="rounded-md p-1.5 text-fg3 hover:bg-surface hover:text-fg disabled:opacity-30"><ArrowUUpLeft size={15} /></button>
              <button type="button" onClick={onRedo} disabled={!canRedo} title="Redo" className="rounded-md p-1.5 text-fg3 hover:bg-surface hover:text-fg disabled:opacity-30"><ArrowUUpRight size={15} /></button>
            </div>
            <button type="button" onClick={onResetStyles} title="Reset styles" className="flex items-center gap-0.5 rounded-md p-1.5 text-fg3 hover:bg-surface hover:text-fg"><ArrowCounterClockwise size={13} /><Palette size={15} /></button>
            <button type="button" onClick={onResetEdits} title="Reset text edits" className="flex items-center gap-0.5 rounded-md p-1.5 text-fg3 hover:bg-surface hover:text-fg"><ArrowCounterClockwise size={13} /><TextAa size={15} /></button>
            <button
              type="button"
              onClick={() => setLaunchOpen(true)}
              className={alreadyDeployed ? 'btn btn-sm' : 'btn btn-sm btn-primary'}
            >
              <Rocket size={15} /> {alreadyDeployed ? 'Re-export' : 'Launch'}
            </button>
            {alreadyDeployed && (
              <button type="button" onClick={() => setDeployOpen(true)} className="btn btn-sm btn-primary"><RocketLaunch size={15} weight="fill" /> Deploy</button>
            )}
          </div>
        </div>

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
      </div>

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

      {/* ── Site style: swap nav / footer / SEO for the whole site ──────── */}
      {styleOpen && (
        <SiteStylePanel
          categories={categories}
          chrome={composition.chrome}
          effective={effective}
          onSetChrome={onSetChrome}
          onClose={() => setStyleOpen(false)}
        />
      )}

      {/* ── Launch / Deploy (interim: home page via legacy bridge) ──────── */}
      <AnimatePresence>
        {launchOpen && (
          <LaunchDialog
            categories={categories}
            selections={legacy.selections}
            skins={legacy.skins}
            order={legacy.order}
            composition={composition}
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
          selections={legacy.selections}
          skins={legacy.skins}
          order={legacy.order}
          composition={composition}
          effective={effective}
          exportEntries={exportEntries}
          vertical={vertical}
          reverts={reverts}
          onClose={() => setDeployOpen(false)}
        />
      )}
    </div>
  );
}

/**
 * Wraps one rendered section: scopes its own palette/typography via `style` (sectionVars) applied
 * to an inner div (so per-section colours + `zoom` scale the section content but NOT the control
 * panel), and drives the hover-dwell timing that opens/closes that section's SectionControlPanel.
 *
 * Timing: ~3s pointer dwell opens the panel; leaving starts a ~1.5s grace close, cancelled if the
 * pointer re-enters the section or the panel (the panel is a descendant, so `pointerleave` on the
 * wrapper doesn't fire while the pointer is over it — it only fires when the whole subtree is left).
 */
const OPEN_DELAY_MS = 3000;
const CLOSE_GRACE_MS = 1500;

function SectionShell({
  style, isOpen, onOpen, onCloseRequest, panel, children,
}: {
  style: CSSProperties;
  isOpen: boolean;
  onOpen: () => void;
  onCloseRequest: () => void;
  panel: React.ReactNode;
  children: React.ReactNode;
}) {
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelOpen = () => { if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null; } };
  const cancelClose = () => { if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; } };
  useEffect(() => () => { cancelOpen(); cancelClose(); }, []);

  const handleEnter = () => {
    cancelClose();
    if (!isOpen && !openTimer.current) {
      openTimer.current = setTimeout(() => { openTimer.current = null; onOpen(); }, OPEN_DELAY_MS);
    }
  };
  const handleLeave = () => {
    cancelOpen();
    if (isOpen && !closeTimer.current) {
      closeTimer.current = setTimeout(() => { closeTimer.current = null; onCloseRequest(); }, CLOSE_GRACE_MS);
    }
  };

  return (
    <div className="relative" onPointerEnter={handleEnter} onPointerLeave={handleLeave}>
      <div style={style}>{children}</div>
      {isOpen && panel}
    </div>
  );
}
