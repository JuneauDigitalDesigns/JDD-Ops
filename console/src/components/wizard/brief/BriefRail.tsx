'use client';

import NavRail from '@/components/shell/NavRail';
import RailRow from '@/components/shell/RailRow';
import type { CopyBriefBlockId } from '@jdd/schema';
import type { ResolvedBlock } from '@/lib/copy-brief/types';
import { blockStatus } from '@/lib/copy-brief/resolve';

const STATUS_COLOR: Record<ReturnType<typeof blockStatus>, string> = {
  off: 'var(--ui-rule-strong)',
  default: 'var(--ui-fg-3)',
  edited: 'var(--ui-accent)',
};

function StatusDot({ status }: { status: ReturnType<typeof blockStatus> }) {
  return (
    <span
      className="mt-[3px] block h-[6px] w-[6px] shrink-0 rounded-full"
      style={{ background: STATUS_COLOR[status] }}
      aria-hidden
    />
  );
}

export default function BriefRail({
  blocks, activeId, onSelect,
}: {
  blocks: ResolvedBlock[];
  activeId: CopyBriefBlockId;
  onSelect: (id: CopyBriefBlockId) => void;
}) {
  return (
    <NavRail label="Brief blocks">
      {blocks.map((block) => {
        const status = blockStatus(block);
        return (
          <RailRow
            key={block.id}
            label={block.label}
            // Excluded wins over whatever the block's own summary would otherwise say — a
            // muted dot next to "default" or "7 items" reads as broken, not as "not used".
            sublabel={status === 'off' ? 'excluded' : block.summary}
            leading={<StatusDot status={status} />}
            active={block.id === activeId}
            onClick={() => onSelect(block.id)}
            muted={status === 'off'}
          />
        );
      })}
    </NavRail>
  );
}
