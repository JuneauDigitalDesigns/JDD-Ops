'use client';

import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import {
  Cards, Rocket, RocketLaunch, CaretLeft, CaretRight,
  ArrowUUpLeft, ArrowUUpRight, ArrowCounterClockwise, Palette, TextAa,
} from '@phosphor-icons/react';
import { AnimatePresence } from 'framer-motion';
import type { SiteContent } from '@/data/site';
import type { VerticalId } from '@/lib/verticals';
import type { StudioReverts } from './page-order';
import type { CategoryEntry } from './categories';
import type { PageInstance, SectionRef, SectionRhythm, SiteComposition } from '@/lib/pages';
import { homeLegacyView, navLinksFor, styleKeyFor, rhythmClass } from '@/lib/pages';
import { defaultSkin, supportsSkin, type SkinId } from '@/lib/skins';
import { EditProvider } from '@/lib/editable';
import { sectionVars } from '@/lib/palette';
import { VERTICAL_TEMPLATES } from './vertical-templates';
import { renderSection } from './compose-page';
import SectionControlPanel from './SectionControlPanel';
import PreviewFrame from './PreviewFrame';
import StickyCallBar from '@template/lib/StickyCallBar';
import LaunchDialog from './LaunchDialog';
import DeployDialog from './DeployDialog';

/**
 * PageStudio — the multi-page build surface. A template card over a live preview that snaps
 * horizontally between the site's pages. Arrows and trackpad scroll move one page at a time.
 * The page in view is the one inline editing applies to.
 *
 * INTERIM (until Phase E): Launch/Deploy bridge through the existing single-page export via
 * homeLegacyView — they ship the HOME page. Multi-page export replaces this.
 */
export default function PageStudio({
  stepNav,
  composition, effective, categories, vertical, slug,
  onApplyVerticalTemplate,
  onSetChrome, onSetSectionSkin, onSetSectionVariant,
  onResetEdits, onResetStyles, setField,
  onUndo, onRedo, canUndo, canRedo,
  alreadyDeployed = false, brandName, reverts,
}: {
  stepNav?: React.ReactNode;
  composition: SiteComposition;
  effective: SiteContent;
  categories: CategoryEntry[];
  vertical: VerticalId;
  slug: string;
  onApplyVerticalTemplate: (id: VerticalId) => void;
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
  const [launchOpen, setLaunchOpen] = useState(false);
  const [deployOpen, setDeployOpen] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  // Templates popover. Rendered in a portal to document.body because PageStudio's root is
  // overflow-hidden, which would clip a popover anchored inside the toolbar. Transient — no
  // persisted state. Position is measured from the button on open.
  const templatesBtnRef = useRef<HTMLButtonElement>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templatesPos, setTemplatesPos] = useState<{ top: number; left: number } | null>(null);
  const openTemplates = () => {
    const r = templatesBtnRef.current?.getBoundingClientRect();
    if (r) setTemplatesPos({ top: r.bottom + 6, left: r.left });
    setTemplatesOpen(true);
  };

  // Keep the active route valid as pages are added/removed.
  useEffect(() => {
    if (!composition.pages.some((p) => p.route === activeRoute)) setActiveRoute('');
  }, [composition.pages, activeRoute]);

  const activePage: PageInstance = composition.pages.find((p) => p.route === activeRoute) ?? composition.pages[0];
  const pageIndex = Math.max(0, composition.pages.findIndex((p) => p.route === activePage.route));
  // All available whole-site templates (one per built vertical). Surfacing all of them lets
  // any client apply any vertical's template for QA purposes without cycling through Intake.
  // Export writes content.nav from the composition's routes. Preview the same links here so
  // the studio nav matches the site that ships, rather than the intake's hash anchors.
  const previewContent = useMemo(
    () => ({ ...effective, nav: navLinksFor(composition) }),
    [effective, composition],
  );

  const scrollToPage = (index: number) => {
    const track = trackRef.current;
    const child = track?.children[index] as HTMLElement | undefined;
    child?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
  };

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
  const nodesByRoute = useMemo(() => {
    const build = (page: PageInstance) => {
    const items: { ref: SectionRef; chromeSlot: 'nav' | 'footer' | null }[] = [
      { ref: composition.chrome.nav, chromeSlot: 'nav' },
      ...page.sections.map((ref) => ({ ref, chromeSlot: null as 'nav' | 'footer' | null })),
      { ref: composition.chrome.footer, chromeSlot: 'footer' as const },
    ];
    return items.map(({ ref, chromeSlot }, i) => {
      const node = renderSection(ref, page, categories, previewContent);
      const key = `${page.route}-${ref.categoryId}-${i}`;
      const sKey = styleKeyFor(ref);
      const activeSkinId = ref.skin ?? defaultSkin(ref.name);
      const style = sectionVars(previewContent.brand, previewContent.sectionStyles?.[sKey]);

      const panel = (
        <SectionControlPanel
          content={previewContent}
          styleKey={sKey}
          variantName={ref.name}
          // The vertical template is one locked style: the per-section layout/variant switcher is
          // intentionally not offered (category omitted). Palette + inline text editing remain.
          category={undefined}
          activeSkin={activeSkinId}
          setField={setField}
          onSetSkin={(skin) =>
            chromeSlot ? onSetChrome(chromeSlot, ref.name, skin) : onSetSectionSkin(page.route, ref.id ?? ref.categoryId, skin)
          }
          onSetVariant={(name) =>
            chromeSlot ? onSetChrome(chromeSlot, name) : onSetSectionVariant(page.route, ref.id ?? ref.categoryId, name)
          }
          onClose={() => setOpenKey(null)}
        />
      );

      return {
        key,
        node: (
          <SectionShell
            style={style}
            rhythm={ref.rhythm}
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
    };
    return new Map(composition.pages.map((page) => [page.route, build(page)]));
  }, [composition.pages, composition.chrome, categories, previewContent, openKey, onSetChrome, onSetSectionSkin, onSetSectionVariant, setField]);

  return (
    <div className="flex h-full overflow-hidden bg-bgDeep">
      {/* ── Center: toolbar + template picker + live preview ────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Toolbar — step pills (Studio step) · page switcher · actions */}
        <div className="flex shrink-0 items-center gap-3 border-b border-rule bg-panel px-5 py-2.5">
          {stepNav && (
            <>
              {stepNav}
              <div className="mx-1 h-5 w-px shrink-0 bg-rule" aria-hidden />
            </>
          )}
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous page"
              disabled={pageIndex <= 0}
              onClick={() => scrollToPage(pageIndex - 1)}
              className="rounded-md p-1.5 text-fg3 hover:bg-surface hover:text-fg disabled:opacity-30"
            >
              <CaretLeft size={16} weight="bold" />
            </button>
            <span className="min-w-[7rem] text-center text-sm font-medium text-fg">{activePage.label}</span>
            <button
              type="button"
              aria-label="Next page"
              disabled={pageIndex >= composition.pages.length - 1}
              onClick={() => scrollToPage(pageIndex + 1)}
              className="rounded-md p-1.5 text-fg3 hover:bg-surface hover:text-fg disabled:opacity-30"
            >
              <CaretRight size={16} weight="bold" />
            </button>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              ref={templatesBtnRef}
              type="button"
              onClick={() => (templatesOpen ? setTemplatesOpen(false) : openTemplates())}
              className="btn btn-sm"
            >
              <Cards size={15} /> Templates
            </button>
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

        <div className="flex min-h-0 flex-1 flex-col">
          {/* One page at a time. The track snaps horizontally; each page scrolls vertically. */}
          <div
            ref={trackRef}
            onScroll={() => {
              const track = trackRef.current;
              if (!track) return;
              const width = track.clientWidth || 1;
              const index = Math.round(track.scrollLeft / width);
              const page = composition.pages[index];
              if (page) setActiveRoute(page.route);
            }}
            className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden"
          >
            {composition.pages.map((page) => (
              <div key={page.route || 'home'} className="h-full w-full shrink-0 snap-start overflow-y-auto p-2">
                <div className="overflow-hidden rounded-xl border border-rule bg-bg shadow-panel">
                  <EditProvider setField={setField} overrides={previewContent.overrides}>
                    <PreviewFrame brand={previewContent.brand} mode="flow" className="w-full">
                      {(nodesByRoute.get(page.route) ?? []).map((n) => <Fragment key={n.key}>{n.node}</Fragment>)}
                      <StickyCallBar
                        phone={previewContent.brand.phone}
                        phoneHref={previewContent.brand.phoneHref}
                        assurance={previewContent.extensions?.responseTime || previewContent.hero?.trust || null}
                        badge={previewContent.announcement || null}
                      />
                    </PreviewFrame>
                  </EditProvider>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Templates popover — portal to body so overflow-hidden ancestors can't clip it. */}
      {templatesOpen && templatesPos && createPortal(
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setTemplatesOpen(false)} />
          <div
            className="fixed z-[61] w-[min(680px,90vw)] rounded-xl border border-rule bg-panel p-4 shadow-panel"
            style={{ top: templatesPos.top, left: templatesPos.left }}
          >
            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-fg3">
              Templates
              <span className="normal-case tracking-normal text-fg3">· each applies to the whole site</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(VERTICAL_TEMPLATES) as [VerticalId, { label: string }][]).map(([id, tmpl]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => { onApplyVerticalTemplate(id); setTemplatesOpen(false); }}
                  className={[
                    'flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
                    id === vertical
                      ? 'border-accent/60 bg-surface hover:border-accent'
                      : 'border-rule bg-surface/50 hover:border-accent/50',
                  ].join(' ')}
                >
                  <span className={[
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                    id === vertical ? 'bg-accent text-[var(--accent-ink)]' : 'bg-surface text-fg3',
                  ].join(' ')}>
                    <Cards size={20} weight="bold" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-fg">{tmpl.label}</span>
                    <span className="block text-xs text-fg3">Layout · colors · type</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>,
        document.body,
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
            onDeploy={alreadyDeployed ? () => { setLaunchOpen(false); setDeployOpen(true); } : undefined}
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
  style, rhythm, isOpen, onOpen, onCloseRequest, panel, children,
}: {
  style: CSSProperties;
  rhythm?: SectionRhythm;
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
      <div className={rhythmClass(rhythm)} style={style}>{children}</div>
      {isOpen && panel}
    </div>
  );
}
