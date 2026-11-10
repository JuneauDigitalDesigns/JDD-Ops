/**
 * The Intake's step registry: the single place that defines what the Intake IS.
 *
 * ── The 2026-11-10 redesign (approved mockup, intake-wizard-proposal.md) ──────────────────
 * Eleven steps, every one a fixed board that fits the window with no page scroll. Before it,
 * step 1 was one form 3,785 px tall at 1440×900 and Review was 8,078 px. So:
 *   - the old "Client intake" form split into Business, Services, Area & profiles and Reviews,
 *     each a set of columns;
 *   - Structure and Section instructions became one step (they were each half a screen);
 *   - the Approve gate moved to Still to do, the last step, which lists everything not yet
 *     supplied. Once the intake has run, reopening it lands there.
 *
 * The rail shows every step's name, because there is room: the old phase-and-dot stepper
 * existed only because fourteen labelled pills overflowed a narrower layout.
 *
 * INVARIANT: `facts` never appears in blockIds. resolveBrief doesn't produce it; the Business
 * step edits those paths directly.
 */
import type { CopyBriefBlockId } from '@jdd/schema';

export type IntakePhaseId = 'intake' | 'direction' | 'structure' | 'generate' | 'summary';

export type IntakeStepKind =
  | 'business' | 'services' | 'area' | 'reviews' | 'words' | 'blocks' | 'prompt' | 'review' | 'todo';

export const PHASES: ReadonlyArray<{ id: IntakePhaseId; label: string }> = [
  { id: 'intake', label: 'Intake' },
  { id: 'direction', label: 'Direction' },
  { id: 'structure', label: 'Structure' },
  { id: 'generate', label: 'Generate' },
  { id: 'summary', label: 'Summary' },
];

export interface IntakeStepDef {
  id: string;
  label: string;
  phase: IntakePhaseId;
  kind: IntakeStepKind;
  /** The blocks this screen renders, in order, side by side. Only for kind 'blocks' / 'words'.
   *  A block resolveBrief doesn't produce is skipped, never thrown on. */
  blockIds?: CopyBriefBlockId[];
}

export const INTAKE_STEPS: ReadonlyArray<IntakeStepDef> = [
  { id: 'business', label: 'Business', phase: 'intake', kind: 'business' },
  { id: 'services', label: 'Services', phase: 'intake', kind: 'services' },
  { id: 'area', label: 'Area & profiles', phase: 'intake', kind: 'area' },
  { id: 'reviews', label: 'Reviews', phase: 'intake', kind: 'reviews' },
  { id: 'words', label: 'Their words', phase: 'intake', kind: 'words', blockIds: ['clientWords', 'website'] },
  { id: 'voice', label: 'Voice & rules', phase: 'direction', kind: 'blocks', blockIds: ['role', 'guardrails', 'forbidden'] },
  { id: 'positioning', label: 'Positioning', phase: 'direction', kind: 'blocks', blockIds: ['positioning', 'offers'] },
  { id: 'structure', label: 'Structure', phase: 'structure', kind: 'blocks', blockIds: ['structure', 'sections', 'custom'] },
  { id: 'prompt', label: 'Prompt', phase: 'generate', kind: 'prompt' },
  { id: 'review', label: 'Review', phase: 'generate', kind: 'review' },
  { id: 'todo', label: 'Still to do', phase: 'summary', kind: 'todo' },
];

export const LAST_STEP_ID = 'todo';

export function stepsInPhase(phase: IntakePhaseId): IntakeStepDef[] {
  return INTAKE_STEPS.filter((s) => s.phase === phase);
}

export function stepIndex(id: string): number {
  const i = INTAKE_STEPS.findIndex((s) => s.id === id);
  return i < 0 ? 0 : i;
}

/**
 * Saved bundles hold the step id of whatever layout saved them:
 *   - before 2026-10: 'brief' | 'prompt' | 'review' (three sub-stages);
 *   - until 2026-11-10: 'intake' (the one long form) and 'sections' (its own step then).
 * Each maps to the step that now holds its content. Anything unrecognised lands on step 1.
 */
const LEGACY: Record<string, string> = { brief: 'business', intake: 'business', sections: 'structure' };

export function migrateStepId(saved: unknown): string {
  if (typeof saved !== 'string') return 'business';
  if (LEGACY[saved]) return LEGACY[saved];
  if (INTAKE_STEPS.some((s) => s.id === saved)) return saved;
  return 'business';
}

/**
 * Where the Intake opens. Once it has run (Approve stamps `brief.lastRunAt`), reopening lands on
 * Still to do, the summary of what's left, whatever step was open last. Before that, the saved
 * step (migrated).
 */
export function landingStepId(saved: unknown, lastRunAt: string | undefined | null): string {
  return lastRunAt ? LAST_STEP_ID : migrateStepId(saved);
}
