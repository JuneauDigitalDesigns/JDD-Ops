'use client';

import { Fragment, useEffect, useState } from 'react';
import { Plus, X, Eye, EyeSlash, PencilSimple, House, Swatches } from '@phosphor-icons/react';
import { motion, useReducedMotion } from 'framer-motion';
import type { SiteContent } from '@/data/site';
import type { CategoryEntry } from './categories';
import type { PageTypeId, SiteComposition } from '@/lib/pages';
import { MAX_PAGES } from '@/lib/pages';
import { composePage } from './compose-page';
import { pageMetaFor, OPTIONAL_PAGE_TYPES, CORE_ADD_PAGE_TYPES } from './page-templates';
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

  const hasPage = (pt: PageTypeId) => composition.pages.some((p) => p.pageType === pt);
  const atCap = composition.pages.length >= MAX_PAGES;
  const availableOptional = OPTIONAL_PAGE_TYPES.filter((pt) => !hasPage(pt));
  const canAddOptional = availableOptional.length > 0 && !atCap;

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

          {/* Add-a-page tile: the default pages (Services/About/Contact) are fixed slots — greyed
              once present — so a one-page client can build out and a removed default can return.
              The optional 5th pages (reviews/gallery/areas) stay behind a small "More" toggle. */}
          <div className="flex min-h-[260px] flex-col rounded-xl border-2 border-dashed border-rule p-4">
            <span className="mb-3 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-fg3">
              <Plus size={14} weight="bold" /> Add a page
            </span>

            <div className="flex flex-col gap-2">
              {CORE_ADD_PAGE_TYPES.map((pt) => {
                const present = hasPage(pt);
                const disabled = present || atCap;
                return (
                  <button
                    key={pt}
                    type="button"
                    disabled={disabled}
                    onClick={() => onAddPage(pt)}
                    title={present ? 'Already on this site' : atCap ? `Sites are capped at ${MAX_PAGES} pages` : `Add ${pageMetaFor(pt).label}`}
                    className={[
                      'flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                      disabled
                        ? 'cursor-not-allowed border-rule/50 text-fg3/50'
                        : 'border-rule text-fg2 hover:border-accent hover:text-accent',
                    ].join(' ')}
                  >
                    {pageMetaFor(pt).label}
                    {present ? <span className="text-2xs text-fg3/60">Added</span> : <Plus size={14} />}
                  </button>
                );
              })}
            </div>

            {canAddOptional && (
              <div className="relative mt-2">
                <button
                  type="button"
                  onClick={() => setAddOpen((o) => !o)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-fg3 hover:bg-surface hover:text-fg"
                >
                  More pages
                  <Plus size={14} />
                </button>
                {addOpen && (
                  <div className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-lg border border-rule bg-panel shadow-floating">
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
      </div>
    </motion.div>
  );
}
