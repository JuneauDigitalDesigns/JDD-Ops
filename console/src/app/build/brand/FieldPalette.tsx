'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MagnifyingGlass } from '@phosphor-icons/react';
import { searchFields, type FieldEntry, type FieldTab } from '@/lib/fieldIndex';

// Cmd/Ctrl+K field finder. Ten panes and ~60 fields make "where do I change the phone
// number" a hunt; this makes it a keystroke. Results come from FIELD_INDEX, the same
// registry the completeness badges count, so search and badges can't disagree.

const TAB_LABEL: Record<FieldTab, string> = {
  brand: 'Brand', palette: 'Palette', type: 'Type', images: 'Images',
  services: 'Services', faq: 'FAQ', reviews: 'Reviews', work: 'Work',
  nav: 'Nav', seo: 'SEO',
};

export default function FieldPalette({
  open, onClose, onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (entry: FieldEntry) => void;
}) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => searchFields(q), [q]);

  useEffect(() => {
    if (open) {
      setQ('');
      setSel(0);
      // The effect runs after the input has rendered, so focus directly — rAF would be
      // throttled to never in a backgrounded tab.
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => { setSel(0); }, [q]);

  if (!open) return null;

  function choose(entry: FieldEntry | undefined) {
    if (!entry) return;
    onPick(entry);
    onClose();
  }

  return (
    // Scoped to the drawer, not the whole app — this is a drawer affordance.
    <div className="absolute inset-0 z-30 flex items-start justify-center bg-black/30 pt-10">
      {/* Backdrop click closes; the panel stops propagation so clicks inside don't. */}
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-label="Find a field"
        className="relative mx-3 w-full max-w-sm overflow-hidden rounded-lg border border-uiRuleStrong bg-uiBg shadow-xl"
      >
        <div className="flex items-center gap-2 border-b border-uiRule px-3 py-2">
          <MagnifyingGlass size={14} className="shrink-0 text-uiFg3" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { e.preventDefault(); onClose(); }
              if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
              if (e.key === 'Enter') { e.preventDefault(); choose(results[sel]); }
            }}
            placeholder="Find a field…"
            aria-label="Find a field"
            className="w-full bg-transparent text-sm text-uiFg outline-none placeholder:text-uiFg3"
          />
        </div>

        {q && results.length === 0 && (
          <p className="px-3 py-4 text-center text-xs text-uiFg3">No field matches “{q}”.</p>
        )}

        {results.length > 0 && (
          <ul className="max-h-64 overflow-y-auto py-1">
            {results.map((e, i) => (
              <li key={e.path}>
                <button
                  type="button"
                  onMouseEnter={() => setSel(i)}
                  onClick={() => choose(e)}
                  className={[
                    'flex w-full items-baseline gap-2 px-3 py-1.5 text-left',
                    i === sel ? 'bg-uiSurface2' : 'hover:bg-uiSurface',
                  ].join(' ')}
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-uiFg">{e.label}</span>
                  <span className="shrink-0 font-chromeMono text-2xs uppercase tracking-widest text-uiFg3">
                    {TAB_LABEL[e.tab]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

      </div>
    </div>
  );
}
