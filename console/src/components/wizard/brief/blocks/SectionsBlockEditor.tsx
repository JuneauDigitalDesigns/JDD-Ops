'use client';

import { useState } from 'react';
import type { CopyBrief } from '@jdd/schema';
import { CaretRight, ArrowCounterClockwise } from '@phosphor-icons/react';
import type { SectionsBlock } from '@/lib/copy-brief/types';
import { setBlockEnabled, setBlockOverride, setTickedSections } from '@/lib/copy-brief/mutations';
import { BlockHeader, OverrideTextarea } from '../BlockPrimitives';

type Update = (mutate: (brief: CopyBrief) => CopyBrief) => void;

export default function SectionsBlockEditor({ block, onUpdate }: { block: SectionsBlock; onUpdate: Update }) {
  const [open, setOpen] = useState<string | null>(null);
  const tickedIds = block.entries.filter((e) => e.ticked).map((e) => e.section);
  const allTicked = block.entries.every((e) => e.ticked);

  return (
    <div>
      <BlockHeader
        label={block.label}
        channel={block.channel}
        enabled={block.enabled}
        onToggleEnabled={(v) => onUpdate((b) => setBlockEnabled(b, 'sections', v))}
      />
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-uiInkSoft">Ticked sections get generated. Expand one to see or edit its instruction.</p>
        <button
          type="button"
          onClick={() => onUpdate((b) => setTickedSections(b, allTicked ? [] : block.entries.map((e) => e.section)))}
          className="mono shrink-0 text-2xs text-uiInkSoft hover:text-uiInk"
        >
          {allTicked ? 'Select none' : 'Select all'}
        </button>
      </div>
      <div className="overflow-hidden rounded-lg border border-uiCardRule">
        {block.entries.map((entry, i) => {
          const expanded = open === entry.section;
          return (
            <div key={entry.section} className={i > 0 ? 'border-t border-uiCardRule' : ''}>
              <div className="flex items-center gap-2 px-4 py-2">
                <input
                  type="checkbox"
                  checked={entry.ticked}
                  onChange={() =>
                    onUpdate((b) =>
                      setTickedSections(b, entry.ticked ? tickedIds.filter((s) => s !== entry.section) : [...tickedIds, entry.section]),
                    )
                  }
                  className="shrink-0 cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : entry.section)}
                  aria-expanded={expanded}
                  className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left text-sm text-uiFg2 transition-colors hover:text-uiInk"
                >
                  <CaretRight
                    size={11}
                    weight="bold"
                    className="shrink-0 text-uiInkSoft transition-transform"
                    style={{ transform: expanded ? 'rotate(90deg)' : undefined }}
                  />
                  {entry.label}
                  {entry.edited && <span className="mono text-2xs uppercase tracking-wide text-uiAccent">edited</span>}
                </button>
              </div>
              {expanded && (
                <div className="border-t border-uiCardRule bg-uiSurface/40 px-4 py-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="font-chromeMono text-2xs uppercase tracking-wide text-uiInkSoft">Instruction sent to the copywriter</span>
                    {entry.edited && (
                      <button
                        type="button"
                        onClick={() => onUpdate((b) => setBlockOverride(b, 'sections', entry.section, undefined))}
                        className="inline-flex items-center gap-1 font-chromeMono text-2xs text-uiInkSoft hover:text-uiInk"
                      >
                        <ArrowCounterClockwise size={11} /> revert
                      </button>
                    )}
                  </div>
                  <OverrideTextarea
                    value={entry.text}
                    onChange={(v) =>
                      onUpdate((b) => setBlockOverride(b, 'sections', entry.section, v === entry.defaultText ? undefined : v))
                    }
                    rows={3}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
