'use client';

import { useMemo } from 'react';
import type { CopyBrief } from '@jdd/schema';
import type { SiteContent } from '@/data/site';
import type { Section } from '@/lib/copy-schema';
import type { ResolvedBlock } from '@/lib/copy-brief/types';
import { compileBriefSegments } from '@/lib/copy-brief/compile-brief';
import PromptPlainView from './PromptPlainView';
import RunControls from './RunControls';
import { copyPages, type CopyPage } from '@/lib/copy-brief/run-sections';

type Update = (mutate: (brief: CopyBrief) => CopyBrief) => void;

export default function PromptStage({
  vertical, verticalDef, base, imported, preset, edits, brief, tickedSections, blocks, onBriefChange,
  model, onModelChange, onGenerated, onClearGenerated, hasGenerated, pages,
}: {
  vertical: string;
  verticalDef: import('@jdd/schema').VerticalDef;
  base: SiteContent;
  imported: SiteContent | null;
  /** The vertical preset, only so the brief can recognise and leave out a preset value. */
  preset: SiteContent;
  /** The operator's edits by path: with `imported`, the only source of the brief's facts. */
  edits: Record<string, unknown>;
  brief: CopyBrief;
  tickedSections: Section[];
  blocks: ResolvedBlock[];
  onBriefChange: Update;
  model: string;
  onModelChange: (m: string) => void;
  onGenerated: (p: Partial<SiteContent>) => void;
  onClearGenerated: () => void;
  hasGenerated: boolean;
  /** The live composition's pages besides Home: the run's `subpages`, and the prompt's page list. */
  pages: CopyPage[];
}) {
  // Joined here rather than calling compileBriefPrompt separately, so the text on screen is
  // provably the same assembly the run uses — one compile, two consumers. The '\n\n' join
  // matches compileBriefPrompt exactly; if that ever changes, this must change with it.
  const prompt = useMemo(() => {
    const segments = compileBriefSegments(
      { vertical: verticalDef, effective: base, imported, preset, edits, brief, tickedSections, subpages: copyPages(pages) },
      blocks,
      tickedSections,
    );
    return {
      system: segments.system.map((s) => s.text).join('\n\n'),
      user: segments.user.map((s) => s.text).join('\n\n'),
    };
  }, [verticalDef, base, imported, preset, edits, brief, tickedSections, blocks, pages]);

  return (
    // The prompt takes the full width and reads sideways; the run box floats over its bottom-right
    // corner, just above the intake's Back / Next bar.
    <div className="relative h-full min-h-0">
      <PromptPlainView system={prompt.system} user={prompt.user} />
      <RunControls
          vertical={vertical}
          base={base}
          imported={imported}
          edits={edits}
          brief={brief}
          tickedSections={tickedSections}
          onBriefChange={onBriefChange}
          model={model}
          onModelChange={onModelChange}
          onGenerated={onGenerated}
          onClearGenerated={onClearGenerated}
          hasGenerated={hasGenerated}
          pages={pages}
        />
    </div>
  );
}
