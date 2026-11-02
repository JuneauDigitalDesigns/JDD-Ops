'use client';

/**
 * The Intake, as eight steps in four phases.
 *
 * Replaces BriefBlockShell, and with it two whole rows of chrome. The screen used to carry a
 * Brief/Prompt/Review pill row, a pinned "from the client's intake" card, AND a row of one
 * pill per block — three navigation tiers plus a context card, roughly 275px of furniture
 * before any actual work appeared. This owns all of it in one stepper row.
 *
 * What makes that possible is that the Intake is now ONE sequence rather than a tier of
 * stages each containing steps. Prompt and Review are steps 7 and 8, not a separate mode —
 * see lib/intake-steps.ts, which declares the whole sequence and is the only place the
 * grouping lives.
 *
 * Navigation is fully free: every phase and every dot is always clickable. The one hard gate
 * in the Intake is Approve, which the Review step owns.
 */
import { useCallback, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight } from '@phosphor-icons/react';
import type { CopyBrief } from '@jdd/schema';
import type { SiteContent } from '@/data/site';
import type { SetField } from '@/components/fields';
import type { LinesBlock, ResolvedBlock } from '@/lib/copy-brief/types';
import type { Section, VerdictKey } from '@/lib/copy-schema';
import type { ReviewPage } from '@/lib/copy-review-groups';
import { intakeAttention } from '@/lib/copy-brief/attention';
import { INTAKE_STEPS, stepIndex, type IntakeStepDef } from '@/lib/intake-steps';
import { stepVariants, stepTransition } from '@/lib/step-motion';
import type { VerticalId } from '@/lib/verticals';
import PhaseStepper, { toStepperSteps } from './PhaseStepper';
import BlockGroupPane from './BlockGroupPane';
import ClientIntakeStep from './ClientIntakeStep';
import ReviewStep from './ReviewStep';
import PromptStage from '../prompt/PromptStage';
import type { SectionVerdict } from '../CopyWireframe';

type Update = (mutate: (brief: CopyBrief) => CopyBrief) => void;

export default function IntakeShell({
  activeId, onSelect,
  blocks, content, setField, missingFields, onUpdate, intakePaths,
  vertical, onVerticalChange, clientPickedVertical, onReplaceContent,
  brief, verticalDef, imported, tickedSections, copyModel, onCopyModelChange,
  onGenerated, onClearGenerated, hasGenerated,
  verdictFor, pages, unreviewed, gateReason, onApprove,
}: {
  activeId: string;
  onSelect: (id: string) => void;

  // Brief inputs
  blocks: ResolvedBlock[];
  content: SiteContent;
  setField: SetField;
  missingFields: string[];
  onUpdate: Update;
  intakePaths: Set<string>;
  vertical: VerticalId;
  onVerticalChange: (v: VerticalId) => void;
  clientPickedVertical: VerticalId | null;
  onReplaceContent: (site: SiteContent) => void;

  // Prompt step
  brief: CopyBrief;
  verticalDef: import('@jdd/schema').VerticalDef;
  imported: SiteContent | null;
  tickedSections: Section[];
  copyModel: string;
  onCopyModelChange: (m: string) => void;
  onGenerated: (p: Partial<SiteContent>) => void;
  onClearGenerated: () => void;
  hasGenerated: boolean;

  // Review step
  verdictFor: (key: VerdictKey) => SectionVerdict;
  pages: ReviewPage[];
  unreviewed: Set<VerdictKey>;
  gateReason?: string;
  onApprove: () => void;
}) {
  const reduce = useReducedMotion();
  const [dir, setDir] = useState(1);

  const index = stepIndex(activeId);
  const step: IntakeStepDef = INTAKE_STEPS[index];

  /** Only the Client intake step carries a count — see copy-brief/attention.ts for why no
   *  other step has an honest one. */
  const attentionFor = useCallback(
    (s: IntakeStepDef) => (s.kind === 'intake' ? intakeAttention(content) : 0),
    [content],
  );
  const stepperSteps = useMemo(
    () => toStepperSteps(INTAKE_STEPS, attentionFor),
    [attentionFor],
  );

  const go = useCallback(
    (nextIndex: number) => {
      if (nextIndex < 0 || nextIndex > INTAKE_STEPS.length - 1) return;
      setDir(nextIndex > index ? 1 : -1);
      onSelect(INTAKE_STEPS[nextIndex].id);
    },
    [index, onSelect],
  );

  const handleSelect = useCallback(
    (id: string) => {
      setDir(stepIndex(id) > index ? 1 : -1);
      onSelect(id);
    },
    [index, onSelect],
  );

  const prev = index > 0 ? INTAKE_STEPS[index - 1] : null;
  const next = index < INTAKE_STEPS.length - 1 ? INTAKE_STEPS[index + 1] : null;
  // `brief.blocks.facts` is a settings key now, not a block — the Client intake step's toggle
  // writes it and compile-brief.ts reads it. Absent means included, matching resolve.ts.
  const factsEnabled = brief.blocks.facts?.enabled !== false;
  // Narrowed via a type guard rather than cast: the Client intake step reads this block's
  // `lines`, and resolveBrief is free to stop producing it.
  const clientWords = blocks.find((b): b is LinesBlock => b.kind === 'lines');

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-uiCardRule px-6 py-2.5">
        <PhaseStepper steps={stepperSteps} activeId={activeId} onSelect={handleSelect} />
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
            {/* The Prompt step manages its own two-pane scrolling, so it gets the bare box;
                every other step scrolls inside the shell's padded body. */}
            {step.kind === 'prompt' ? (
              <div className="min-h-0 flex-1">
                <PromptStage
                  vertical={vertical}
                  verticalDef={verticalDef}
                  base={content}
                  imported={imported}
                  brief={brief}
                  tickedSections={tickedSections}
                  blocks={blocks}
                  onBriefChange={onUpdate}
                  model={copyModel}
                  onModelChange={onCopyModelChange}
                  onGenerated={onGenerated}
                  onClearGenerated={onClearGenerated}
                  hasGenerated={hasGenerated}
                />
              </div>
            ) : (
              <div className="no-scrollbar min-w-0 flex-1 overflow-y-auto">
                <div className={step.kind === 'review' ? 'px-6 py-6' : 'step-body max-w-3xl'}>
                  {step.kind === 'intake' && (
                    <ClientIntakeStep
                      content={content}
                      setField={setField}
                      missingFields={missingFields}
                      intakePaths={intakePaths}
                      clientWords={clientWords}
                      factsEnabled={factsEnabled}
                      onUpdate={onUpdate}
                      vertical={vertical}
                      clientPickedVertical={clientPickedVertical}
                      onVerticalChange={onVerticalChange}
                      onReplaceContent={onReplaceContent}
                    />
                  )}

                  {step.kind === 'blocks' && step.blockIds && (
                    <BlockGroupPane
                      blockIds={step.blockIds}
                      blocks={blocks}
                      content={content}
                      setField={setField}
                      onUpdate={onUpdate}
                    />
                  )}

                  {step.kind === 'review' && (
                    <ReviewStep
                      content={content}
                      setField={setField}
                      verdictFor={verdictFor}
                      pages={pages}
                      unreviewed={unreviewed}
                      hasGenerated={hasGenerated}
                      gateReason={gateReason}
                      onApprove={onApprove}
                    />
                  )}
                </div>
              </div>
            )}

            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-uiCardRule px-6 py-2.5">
              {prev ? (
                <button type="button" onClick={() => go(index - 1)} className="btn btn-sm">
                  <ArrowLeft size={14} /> {prev.label}
                </button>
              ) : (
                <span />
              )}
              <span className="font-chromeMono text-2xs text-uiFg3">
                {index + 1} of {INTAKE_STEPS.length}
              </span>
              {next ? (
                <button type="button" onClick={() => go(index + 1)} className="btn btn-sm btn-primary">
                  {next.label} <ArrowRight size={14} />
                </button>
              ) : (
                <span />
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
