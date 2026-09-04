'use client';

import { useMemo } from 'react';
import type { CopyBrief, CopyBriefBlockId } from '@jdd/schema';
import type { SiteContent } from '@/data/site';
import type { Section } from '@/lib/copy-schema';
import type { ResolvedBlock } from '@/lib/copy-brief/types';
import { compileBriefSegments } from '@/lib/copy-brief/compile-brief';
import AnnotatedPromptDocument from './AnnotatedPromptDocument';
import RunControls from './RunControls';

type Update = (mutate: (brief: CopyBrief) => CopyBrief) => void;

export default function PromptStage({
  vertical, verticalDef, base, imported, brief, tickedSections, blocks, onBriefChange,
  model, onModelChange, onGenerated, onClearGenerated, hasGenerated, onJumpToBlock,
}: {
  vertical: string;
  verticalDef: import('@jdd/schema').VerticalDef;
  base: SiteContent;
  imported: SiteContent | null;
  brief: CopyBrief;
  tickedSections: Section[];
  blocks: ResolvedBlock[];
  onBriefChange: Update;
  model: string;
  onModelChange: (m: string) => void;
  onGenerated: (p: Partial<SiteContent>) => void;
  onClearGenerated: () => void;
  hasGenerated: boolean;
  onJumpToBlock: (id: CopyBriefBlockId) => void;
}) {
  const segments = useMemo(
    () => compileBriefSegments({ vertical: verticalDef, effective: base, imported, brief, tickedSections }, blocks, tickedSections),
    [verticalDef, base, imported, brief, tickedSections, blocks],
  );

  return (
    <div className="flex h-full min-h-0">
      <div className="no-scrollbar min-w-0 flex-[2] overflow-y-auto">
        <div className="step-body max-w-3xl">
          <AnnotatedPromptDocument system={segments.system} user={segments.user} onJumpToBlock={onJumpToBlock} />
        </div>
      </div>
      <div className="w-[300px] shrink-0">
        <RunControls
          vertical={vertical}
          base={base}
          imported={imported}
          brief={brief}
          tickedSections={tickedSections}
          onBriefChange={onBriefChange}
          model={model}
          onModelChange={onModelChange}
          onGenerated={onGenerated}
          onClearGenerated={onClearGenerated}
          hasGenerated={hasGenerated}
        />
      </div>
    </div>
  );
}
