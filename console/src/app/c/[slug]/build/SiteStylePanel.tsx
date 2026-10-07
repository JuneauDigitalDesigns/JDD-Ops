'use client';

import { Fragment, useEffect } from 'react';
import { X, Check } from '@phosphor-icons/react';
import type { SiteContent } from '@/data/site';
import type { SkinId } from '@/lib/skins';
import type { CategoryEntry } from './categories';
import type { SiteComposition } from '@/lib/pages';
import PreviewFrame from './PreviewFrame';

const CHROME_CATEGORIES = ['nav', 'footer', 'seo'] as const;
type ChromeCategoryId = (typeof CHROME_CATEGORIES)[number];

/**
 * Site style — the three choices made ONCE for the whole site: nav, footer, and (for Home's
 * rich metadata) SEO variant. Distinct from the per-page template picker: these are chrome, not
 * page content, so there is one popover for the whole site rather than one per page.
 */
export default function SiteStylePanel({
  categories, chrome, effective, onSetChrome, onClose,
}: {
  categories: CategoryEntry[];
  chrome: SiteComposition['chrome'];
  effective: SiteContent;
  onSetChrome: (categoryId: ChromeCategoryId, name: string, skin?: SkinId) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[110] flex items-start justify-center overflow-y-auto bg-[var(--fg)]/40 p-6 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl overflow-hidden rounded-2xl border border-rule bg-panel shadow-overlay"
      >
        <header className="flex items-center justify-between border-b border-rule px-6 py-4">
          <h2 className="font-display text-xl font-semibold text-fg">Site style</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-fg3 hover:bg-surface hover:text-fg">
            <X size={18} />
          </button>
        </header>

        <div className="max-h-[75vh] space-y-8 overflow-y-auto px-6 py-5">
          {CHROME_CATEGORIES.map((catId) => {
            const category = categories.find((c) => c.id === catId);
            if (!category) return null;
            const active = chrome[catId];
            return (
              <div key={catId}>
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-fg3">{category.label}</div>
                <div className="flex flex-wrap gap-4">
                  {category.variants.map((variant) => {
                    const selected = variant.name === active.name;
                    const skin = selected ? (active.skin ?? variant.skins[0]?.id) : variant.skins[0]?.id;
                    return (
                      <div
                        key={variant.name}
                        className={`w-[220px] overflow-hidden rounded-xl border transition-colors ${
                          selected ? 'border-accent ring-1 ring-accent' : 'border-rule'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => onSetChrome(catId, variant.name)}
                          className="block w-full pointer-events-auto"
                        >
                          <div className="pointer-events-none h-[110px] overflow-hidden bg-bg">
                            <PreviewFrame brand={effective.brand} mode="scaled" virtualWidth={1280}>
                              <Fragment>{variant.render(skin ?? 'default')}</Fragment>
                            </PreviewFrame>
                          </div>
                        </button>
                        <div className="flex items-center justify-between gap-2 border-t border-rule bg-panel px-3 py-2">
                          <span className="text-sm font-medium text-fg">{variant.label}</span>
                          {selected && <Check size={14} weight="bold" className="text-accent" />}
                        </div>
                        {selected && variant.skins.length > 1 && (
                          <div className="flex flex-wrap gap-1 border-t border-rule px-3 py-2">
                            {variant.skins.map((sk) => (
                              <button
                                key={sk.id}
                                type="button"
                                onClick={() => onSetChrome(catId, variant.name, sk.id)}
                                className={`rounded-full px-2.5 py-0.5 text-xs transition-colors ${
                                  (active.skin ?? variant.skins[0]?.id) === sk.id
                                    ? 'bg-fg text-bg'
                                    : 'bg-surface text-fg3 hover:text-fg'
                                }`}
                              >
                                {sk.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
