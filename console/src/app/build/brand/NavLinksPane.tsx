'use client';

import { useMemo, useRef, useState } from 'react';
import { LinkSimple, Check } from '@phosphor-icons/react';
import type { SiteContent } from '@/data/site';
import type { SetField } from '@/components/fields';
import { getPath } from '@/lib/merge';
import AnchoredPopover from '@/components/AnchoredPopover';
import { linkableTargets, isDanglingLink, type NavTarget } from '../nav-targets';
import ListPane from './ListPane';

type NavItem = { label: string; href: string };

// Nav-link editing that can only produce links to REAL sections. The generic ListPane add
// button (which appends { label: 'New', href: '#' } — a dead anchor with no way to set the
// href) is overridden here with a picker of the sections currently on the page. Links whose
// target section is no longer on the page are flagged, not deleted.
export default function NavLinksPane({
  content, setField, order,
}: {
  content: SiteContent;
  setField: SetField;
  /** The page's current body order — determines which sections can be linked. */
  order: string[];
}) {
  const [pickerRect, setPickerRect] = useState<DOMRect | null>(null);
  const addBtnRef = useRef<HTMLDivElement>(null);

  const nav = (getPath(content, 'nav') as NavItem[] | undefined) ?? [];
  const targets = useMemo(() => linkableTargets(order), [order]);

  // A target is "already linked" if some nav item points at its anchor.
  const linkedAnchors = useMemo(() => new Set(nav.map((n) => n.href)), [nav]);

  // Rows pointing at a section that isn't on the page get the amber flag.
  const flagIndices = useMemo(() => {
    const s = new Set<number>();
    nav.forEach((n, i) => { if (isDanglingLink(n.href, order)) s.add(i); });
    return s;
  }, [nav, order]);

  function addLink(t: NavTarget) {
    setField('nav', [...nav, { label: t.label, href: t.anchor }]);
    setPickerRect(null);
  }

  return (
    <div ref={addBtnRef}>
      <ListPane
        content={content}
        setField={setField}
        basePath="nav"
        labelKey="label"
        singular="Link"
        makeBlank={() => ({ label: 'New', href: '#' })}
        flagIndices={flagIndices}
        onAdd={() => {
          const el = addBtnRef.current?.querySelector('button.border-dashed');
          if (el) setPickerRect(el.getBoundingClientRect());
        }}
      />

      {pickerRect && (
        <AnchoredPopover rect={pickerRect} onClose={() => setPickerRect(null)} width={240}>
          <p className="kicker px-2 py-1.5">Link to a section</p>
          {targets.length === 0 ? (
            <p className="px-2 py-3 text-sm text-fg3">
              No linkable sections on the page yet. Add sections first.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {targets.map((t) => {
                const already = linkedAnchors.has(t.anchor);
                return (
                  <li key={t.categoryId}>
                    <button
                      type="button"
                      onClick={() => addLink(t)}
                      // Already-linked sections are disabled, not re-addable: a second link
                      // to the same anchor is meaningless, and the catalog nav keys items by
                      // href, so a duplicate would collide.
                      disabled={already}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-fg hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                    >
                      <LinkSimple size={15} className="shrink-0 text-fg3" />
                      <span className="min-w-0 flex-1 truncate">{t.label}</span>
                      <span className="shrink-0 font-chromeMono text-2xs text-fg3">{t.anchor}</span>
                      {already && <Check size={14} weight="bold" className="shrink-0 text-accent" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </AnchoredPopover>
      )}
    </div>
  );
}
