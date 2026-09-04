'use client';

import type { CopyBriefBlockId } from '@jdd/schema';
import type { PromptSegment } from '@/lib/copy-brief/compile-brief';

/**
 * The compiled prompt, read-only, with each paragraph labeled by the block that produced it.
 * Clicking a label jumps back to Stage 1 with that block selected — the point of showing the
 * prompt at all is to make a block's effect legible, and a label you can't act on is just
 * decoration.
 */
export default function AnnotatedPromptDocument({
  system, user, onJumpToBlock,
}: {
  system: PromptSegment[];
  user: PromptSegment[];
  onJumpToBlock: (id: CopyBriefBlockId) => void;
}) {
  return (
    <div className="space-y-8">
      <div>
        <p className="kicker mb-3">System — role &amp; rules</p>
        <div className="overflow-hidden rounded-lg border border-uiCardRule">
          {system.map((seg, i) => (
            <SegmentRow key={i} seg={seg} onJump={onJumpToBlock} last={i === system.length - 1} />
          ))}
        </div>
      </div>
      <div>
        <p className="kicker mb-3">User — the business message</p>
        <p className="mb-3 text-2xs text-uiInkSoft">
          Section-instruction lines are split across chunks of two when generating — this shows
          the union of every section currently ticked.
        </p>
        <div className="overflow-hidden rounded-lg border border-uiCardRule">
          {user.map((seg, i) => (
            <SegmentRow key={i} seg={seg} onJump={onJumpToBlock} last={i === user.length - 1} />
          ))}
        </div>
      </div>
    </div>
  );
}

function SegmentRow({
  seg, onJump, last,
}: {
  seg: PromptSegment;
  onJump: (id: CopyBriefBlockId) => void;
  last: boolean;
}) {
  return (
    <div className={`flex gap-4 px-4 py-3 ${last ? '' : 'border-b border-uiCardRule'}`}>
      <div className="w-36 shrink-0">
        {seg.blockId ? (
          <button
            type="button"
            onClick={() => onJump(seg.blockId!)}
            className="mono text-left text-2xs uppercase tracking-wide text-uiAccent underline decoration-dotted underline-offset-2 hover:text-uiInk"
          >
            {seg.label}
          </button>
        ) : (
          <span className="mono text-2xs uppercase tracking-wide text-uiInkSoft">{seg.label}</span>
        )}
      </div>
      <pre className="min-w-0 flex-1 whitespace-pre-wrap break-words font-chromeMono text-xs leading-relaxed text-uiFg">{seg.text}</pre>
    </div>
  );
}
