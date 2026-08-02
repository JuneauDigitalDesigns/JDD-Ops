'use client';

import { useState } from 'react';
import { CaretRight, CheckCircle, Circle, PencilSimple } from '@phosphor-icons/react';
import type { SiteContent } from '@/data/site';
import { ALL_SECTIONS, type Section } from '@/lib/copy-schema';
import { labelFor } from '@/lib/section-labels';
import SectionCopyBody from './SectionCopyBody';

/**
 * Every section's copy, readable in place, with a tick to re-roll it.
 *
 * This replaced a two-column checklist that opened a full-screen modal per section. The
 * modal made reading one section fine and comparing two impossible — you had to close, read,
 * reopen, and hold the first in your head. Inline, the whole page's copy skims top to bottom.
 *
 * Three affordances on a row, kept deliberately distinct: the chevron/label expands, the
 * checkbox picks for regeneration, and Edit in Studio (inside the expanded body, not on the
 * row) jumps to the live page. A mis-aimed click should never silently re-roll copy.
 */
export default function GeneratedSections({
  content,
  generated,
  selected,
  onSelectedChange,
  onEditInStudio,
  busy,
}: {
  content: SiteContent;
  generated: Partial<SiteContent> | null;
  /** Sections ticked for the next run. */
  selected: Section[];
  onSelectedChange: (v: Section[]) => void;
  onEditInStudio: (s: Section) => void;
  busy: boolean;
}) {
  const [open, setOpen] = useState<Section | null>(null);

  // brand is an always-on tagline rather than a listed section.
  const sections = ALL_SECTIONS.filter((s) => s !== 'brand');
  const isGen = (s: Section) => Boolean(generated && s in generated);
  const genCount = sections.filter(isGen).length;

  const picked = new Set(selected);
  const toggle = (s: Section) =>
    onSelectedChange(picked.has(s) ? selected.filter((x) => x !== s) : [...selected, s]);
  const allPicked = sections.every((s) => picked.has(s));

  return (
    <div className="overflow-hidden rounded-xl border border-rule bg-panel shadow-raised">
      <div className="flex items-center gap-3 border-b border-rule px-5 py-3">
        <span className="kicker">Brand copy</span>
        <span className="mono text-2xs tabular-nums text-fg3">
          {genCount} / {sections.length} written
        </span>
        <button
          type="button"
          onClick={() => onSelectedChange(allPicked ? [] : [...sections])}
          disabled={busy}
          className="mono ml-auto text-2xs text-fg3 transition-colors hover:text-fg"
        >
          {allPicked ? 'Select none' : 'Select all'}
        </button>
      </div>

      {sections.map((s) => {
        const done = isGen(s);
        const expanded = open === s;
        return (
          <div key={s} className="border-b border-rule last:border-b-0">
            <div className="flex items-center gap-2 px-5 py-2">
              <input
                type="checkbox"
                checked={picked.has(s)}
                onChange={() => toggle(s)}
                disabled={busy}
                aria-label={`Regenerate ${labelFor(s)}`}
                className="shrink-0 cursor-pointer"
              />
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : s)}
                aria-expanded={expanded}
                className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left transition-colors hover:text-fg"
              >
                <CaretRight
                  size={12}
                  weight="bold"
                  className="shrink-0 text-fg3 transition-transform"
                  style={{ transform: expanded ? 'rotate(90deg)' : undefined }}
                />
                <span className={done ? 'text-sm text-fg' : 'text-sm text-fg3'}>{labelFor(s)}</span>
                <span className="ml-auto shrink-0">
                  {done ? (
                    <CheckCircle size={14} weight="fill" className="text-accent" />
                  ) : (
                    <Circle size={14} className="text-fg3" />
                  )}
                </span>
              </button>
            </div>

            {expanded && (
              <div className="border-t border-rule bg-surface/40 px-5 py-4">
                <SectionCopyBody section={s} content={content} />
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => onEditInStudio(s)}
                    className="btn btn-sm"
                  >
                    <PencilSimple size={14} /> Edit in Studio
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
