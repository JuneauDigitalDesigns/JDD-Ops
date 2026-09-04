'use client';

import type { CopyBrief } from '@jdd/schema';
import { Lock, Minus, Plus } from '@phosphor-icons/react';
import type { StructureBlock } from '@/lib/copy-brief/types';
import { setBlockEnabled, setStructureOverride } from '@/lib/copy-brief/mutations';
import { BlockHeader } from '../BlockPrimitives';

type Update = (mutate: (brief: CopyBrief) => CopyBrief) => void;

/**
 * Steppers write to brief.structureOverrides only — they don't resize the underlying
 * SiteContent arrays themselves (Studio's preview count is unaffected until you generate).
 * Wiring structureOverrides into the actual generation counts happens where the copywriter
 * prompt is compiled (the Prompt stage, once /api/build/generate-copy is rewired to read the
 * brief) — this block just records the operator's intent for that to consume.
 */

const MIN_COUNT = 0;
const MAX_COUNT = 12;

export default function StructureBlockEditor({ block, onUpdate }: { block: StructureBlock; onUpdate: Update }) {
  return (
    <div>
      <BlockHeader
        label={block.label}
        channel={block.channel}
        enabled={block.enabled}
        onToggleEnabled={(v) => onUpdate((b) => setBlockEnabled(b, 'structure', v))}
      />
      <p className="mb-4 text-sm text-uiInkSoft">
        How many of each the copywriter is told to write. Locked counts came from the client&rsquo;s
        own intake and aren&rsquo;t generated — only real ones the client already gave.
      </p>
      <div className="overflow-hidden rounded-lg border border-uiCardRule">
        {block.entries.map((entry, i) => (
          <div
            key={entry.key}
            className={`flex items-center justify-between gap-3 px-4 py-2.5 ${i > 0 ? 'border-t border-uiCardRule' : ''}`}
          >
            <span className="text-sm text-uiFg2">{entry.label}</span>
            {entry.locked ? (
              <span className="mono inline-flex items-center gap-1.5 text-2xs uppercase tracking-wide text-uiInkSoft">
                <Lock size={11} /> {entry.count} from client
              </span>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label={`Decrease ${entry.label}`}
                  disabled={entry.count <= MIN_COUNT}
                  onClick={() => onUpdate((b) => setStructureOverride(b, entry.key, Math.max(MIN_COUNT, entry.count - 1)))}
                  className="flex h-6 w-6 items-center justify-center rounded-md border border-uiCardRule text-uiFg2 transition-colors hover:bg-uiSurface disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Minus size={11} />
                </button>
                <span className="mono w-5 text-center text-sm tabular-nums text-uiInk">{entry.count}</span>
                <button
                  type="button"
                  aria-label={`Increase ${entry.label}`}
                  disabled={entry.count >= MAX_COUNT}
                  onClick={() => onUpdate((b) => setStructureOverride(b, entry.key, Math.min(MAX_COUNT, entry.count + 1)))}
                  className="flex h-6 w-6 items-center justify-center rounded-md border border-uiCardRule text-uiFg2 transition-colors hover:bg-uiSurface disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Plus size={11} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
