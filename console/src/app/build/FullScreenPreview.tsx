'use client';

// View-only, true-to-site preview. Renders the selected component stack inside a full-width
// iframe (mode="fluid") so it behaves exactly like the shipped page — resize the window or use
// Chrome dev tools device mode to test responsiveness. Launched from FinalizePanel; the top
// banner returns to it. Studio-only; never exported.
import { Fragment, useEffect, type ReactNode } from 'react';
import { ArrowLeft } from '@phosphor-icons/react';
import type { Brand } from '@/data/site';
import PreviewFrame from './PreviewFrame';

export type PreviewSection = { key: string; node: ReactNode };

export default function FullScreenPreview({
  brand,
  title,
  sections,
  onClose,
}: {
  brand: Brand;
  title: string;
  sections: PreviewSection[];
  onClose: () => void;
}) {
  // Escape closes; lock body scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-white">
      {/* Return banner */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-500 hover:text-zinc-900"
          >
            <ArrowLeft size={14} weight="bold" />
            Back to Finalize
          </button>
          <span className="font-chromeMono text-xs uppercase tracking-widest text-zinc-400">
            Full-screen preview{title ? ` — ${title}` : ''}
          </span>
        </div>
        <span className="hidden font-chromeMono text-[11px] text-zinc-400 md:block">
          Resize the window or use dev tools (F12) to test mobile
        </span>
      </div>

      {/* Full-width iframe = real site viewport */}
      <div className="min-h-0 flex-1">
        <PreviewFrame brand={brand} mode="fluid">
          {sections.map((s) => (
            <Fragment key={s.key}>{s.node}</Fragment>
          ))}
        </PreviewFrame>
      </div>
    </div>
  );
}
