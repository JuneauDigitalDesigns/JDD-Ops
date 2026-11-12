'use client';

/**
 * The Intake: eleven steps, each a board that fills the window with no page scroll
 * (redesign approved 2026-11-10; lib/intake-steps.ts declares the sequence).
 *
 * One rail of named steps on top, the board, and Back / Next at the bottom. Navigation is free:
 * every step is always reachable. The one hard gate is Approve, on Still to do.
 */
import { useCallback, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight } from '@phosphor-icons/react';
import type { CopyBrief } from '@jdd/schema';
import type { SiteContent } from '@/data/site';
import type { SetField } from '@/components/fields';
import type { LinesBlock, ResolvedBlock } from '@/lib/copy-brief/types';
import type { Section, VerdictKey } from '@/lib/copy-schema';
import type { ReviewPage } from '@/lib/copy-review-groups';
import type { SourceContext } from '@/lib/intake-sources';
import type { TodoItem } from '@/lib/intake-todo';
import type { CopyRisks } from '@/lib/copyRisks';
import type { RiskTarget } from '@/lib/intake-risks';
import type { ReviewDraft } from '@/lib/review-draft';
import type { SaveStatus } from '@/lib/autosave';
import SaveIndicator from '../intake/SaveIndicator';
import { INTAKE_STEPS, stepIndex, type IntakeStepDef } from '@/lib/intake-steps';
import { stepVariants, stepTransition } from '@/lib/step-motion';
import type { VerticalId } from '@/lib/verticals';
import BlockGroupPane from './BlockGroupPane';
import PromptStage from '../prompt/PromptStage';
import type { SectionVerdict } from '../CopyWireframe';
import StepRail from '../intake/StepRail';
import BusinessStep from '../intake/BusinessStep';
import ServicesStep from '../intake/ServicesStep';
import AreaStep from '../intake/AreaStep';
import ReviewsStep from '../intake/ReviewsStep';
import WordsStep from '../intake/WordsStep';
import ReviewBoard from '../intake/ReviewBoard';
import TodoStep from '../intake/TodoStep';

type Update = (mutate: (brief: CopyBrief) => CopyBrief) => void;

/** Column widths for the block steps, so each fits its contents side by side. */
const BLOCK_WIDTHS: Record<string, string> = {
  voice: 'minmax(0,1.2fr) minmax(0,1fr) minmax(0,.9fr)',
  positioning: 'minmax(0,1fr) minmax(0,1fr)',
  structure: 'minmax(260px,.7fr) minmax(0,1.6fr) minmax(0,1fr)',
};

export default function IntakeShell({
  activeId, onSelect,
  blocks, content, setField, onUpdate, sources,
  vertical, onVerticalChange, clientPickedVertical, onReplaceContent,
  brief, verticalDef, imported, tickedSections, copyModel, onCopyModelChange,
  onGenerated, onClearGenerated, hasGenerated, generated,
  verdictFor, pages, unreviewed, gateReason, onApprove,
  todo, counts, stats, risks, reviewDraft, onReviewDraftChange, saveStatus, onRetrySave,
}: {
  activeId: string;
  onSelect: (id: string) => void;

  blocks: ResolvedBlock[];
  content: SiteContent;
  setField: SetField;
  onUpdate: Update;
  sources: SourceContext;
  vertical: VerticalId;
  onVerticalChange: (v: VerticalId) => void;
  clientPickedVertical: VerticalId | null;
  onReplaceContent: (site: SiteContent) => void;

  brief: CopyBrief;
  verticalDef: import('@jdd/schema').VerticalDef;
  imported: SiteContent | null;
  tickedSections: Section[];
  copyModel: string;
  onCopyModelChange: (m: string) => void;
  onGenerated: (p: Partial<SiteContent>) => void;
  onClearGenerated: () => void;
  hasGenerated: boolean;
  /** The generated layer: the Review step's parts are the text it holds (lib/review-parts.ts). */
  generated: Partial<SiteContent> | null;

  verdictFor: (key: VerdictKey) => SectionVerdict;
  pages: ReviewPage[];
  unreviewed: Set<VerdictKey>;
  gateReason?: string;
  onApprove: () => void;

  todo: TodoItem[];
  counts: Record<string, number>;
  stats: Array<{ value: string; label: string; ok?: boolean }>;
  /** client-seo's copyRisks over the effective content: the Still to do warning (SEO plan D2). */
  risks: CopyRisks;
  reviewDraft: ReviewDraft | null;
  onReviewDraftChange: (d: ReviewDraft | null) => void;
  saveStatus: SaveStatus;
  onRetrySave: () => void;
}) {
  const reduce = useReducedMotion();
  const [dir, setDir] = useState(1);
  /** Where a Still to do jump points inside the step it opens. */
  const [focus, setFocus] = useState<{ path?: string; service?: number; section?: string; route?: string; n: number }>({ n: 0 });

  const index = stepIndex(activeId);
  const step: IntakeStepDef = INTAKE_STEPS[index];

  const select = useCallback((id: string) => {
    setDir(stepIndex(id) > index ? 1 : -1);
    onSelect(id);
  }, [index, onSelect]);

  const jump = useCallback((it: TodoItem) => {
    const target = it.step === 'review' ? 'review' : it.step;
    setFocus((f) => ({ path: it.path, service: it.serviceIndex, n: f.n + 1 }));
    select(target);
  }, [select]);

  const riskJump = useCallback((t: RiskTarget) => {
    setFocus((f) => ({ service: t.serviceIndex, section: t.section, route: t.route, n: f.n + 1 }));
    select(t.step);
  }, [select]);

  const prev = index > 0 ? INTAKE_STEPS[index - 1] : null;
  const next = index < INTAKE_STEPS.length - 1 ? INTAKE_STEPS[index + 1] : null;
  const factsEnabled = brief.blocks.facts?.enabled !== false;
  const clientWords = blocks.find((b): b is LinesBlock => b.kind === 'lines');

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-4 border-b border-uiCardRule bg-uiBg px-6 py-1.5">
        <div className="min-w-0 flex-1">
          <StepRail steps={INTAKE_STEPS} activeId={activeId} counts={counts} onSelect={select} />
        </div>
        <SaveIndicator status={saveStatus} onRetry={onRetrySave} />
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <AnimatePresence custom={dir} initial={false} mode="popLayout">
          <motion.div
            key={activeId}
            custom={dir}
            variants={stepVariants(reduce)}
            initial="enter"
            animate="center"
            exit="exit"
            transition={stepTransition(reduce)}
            className="absolute inset-0 flex flex-col"
          >
            <div className="min-h-0 flex-1 overflow-hidden">
              {step.kind === 'business' && (
                <BusinessStep
                  key={focus.n}
                  content={content}
                  sources={sources}
                  setField={setField}
                  clientWords={clientWords}
                  factsEnabled={factsEnabled}
                  onUpdate={onUpdate}
                  vertical={vertical}
                  clientPickedVertical={clientPickedVertical}
                  onVerticalChange={onVerticalChange}
                  onReplaceContent={onReplaceContent}
                  focusPath={focus.path}
                />
              )}
              {step.kind === 'services' && (
                <ServicesStep content={content} setField={setField} sources={sources} focusService={focus.service} vertical={vertical} onDone={() => select('area')} />
              )}
              {step.kind === 'area' && <AreaStep content={content} sources={sources} setField={setField} />}
              {step.kind === 'reviews' && (
                <ReviewsStep content={content} sources={sources} setField={setField} reviewDraft={reviewDraft} onReviewDraftChange={onReviewDraftChange} />
              )}
              {step.kind === 'words' && step.blockIds && (
                <WordsStep blockIds={step.blockIds} blocks={blocks} content={content} setField={setField} onUpdate={onUpdate} />
              )}
              {step.kind === 'blocks' && step.blockIds && (
                <div className="flex h-full min-h-0 flex-col gap-3.5 px-6 py-4">
                  <h2 className="shrink-0 font-display text-[28px] font-bold leading-none text-uiInk">{step.label}</h2>
                  <div className="min-h-0 flex-1">
                    <BlockGroupPane
                      blockIds={step.blockIds}
                      blocks={blocks}
                      content={content}
                      setField={setField}
                      onUpdate={onUpdate}
                      columns
                      widths={BLOCK_WIDTHS[step.id]}
                    />
                  </div>
                </div>
              )}
              {step.kind === 'prompt' && (
                <PromptStage
                  vertical={vertical}
                  verticalDef={verticalDef}
                  base={content}
                  imported={imported}
                  preset={sources.preset}
                  edits={sources.edits}
                  brief={brief}
                  tickedSections={tickedSections}
                  blocks={blocks}
                  onBriefChange={onUpdate}
                  model={copyModel}
                  onModelChange={onCopyModelChange}
                  onGenerated={onGenerated}
                  onClearGenerated={onClearGenerated}
                  hasGenerated={hasGenerated}
                  pages={pages}
                />
              )}
              {step.kind === 'review' && (
                <ReviewBoard
                  content={content}
                  setField={setField}
                  generated={generated}
                  run={{ vertical, imported, edits: sources.edits, brief, model: copyModel }}
                  verdictFor={verdictFor}
                  pages={pages}
                  unreviewed={unreviewed}
                  hasGenerated={hasGenerated}
                  focusSection={focus.section}
                  focusRoute={focus.route}
                  focusKey={focus.n}
                />
              )}
              {step.kind === 'todo' && (
                <TodoStep
                  items={todo}
                  lastRunAt={brief.lastRunAt}
                  stats={stats}
                  onJump={jump}
                  blocked={unreviewed.size > 0}
                  gateReason={gateReason}
                  onApprove={onApprove}
                  onRerun={() => select('prompt')}
                  risks={risks}
                  onRiskJump={riskJump}
                />
              )}
            </div>

            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-uiCardRule bg-uiBg px-6 py-2">
              {prev ? (
                <button type="button" onClick={() => select(prev.id)} className="btn btn-sm">
                  <ArrowLeft size={14} /> {prev.label}
                </button>
              ) : <span />}
              <span className="font-chromeMono text-2xs text-uiFg3">{index + 1} of {INTAKE_STEPS.length}</span>
              {next ? (
                <button type="button" onClick={() => select(next.id)} className="btn btn-sm btn-primary">
                  {next.label} <ArrowRight size={14} />
                </button>
              ) : <span />}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
