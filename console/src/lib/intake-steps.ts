/**
 * The Intake's step registry — the single place that defines what the Intake IS.
 *
 * ── Why 8 steps and not 14 ───────────────────────────────────────────────────────────────
 * An earlier pass gave every CopyBrief block its own full screen. That read as a step-by-step
 * flow on paper and failed in practice for two reasons. Most blocks are thin — `role` and
 * `guardrails` are a single textarea each — so a full viewport per block produced screens that
 * were emptier than the rail they replaced, which was the original complaint. And fourteen
 * labelled pills overflow every realistic window width, so steps sat permanently off-edge,
 * strictly worse than the vertical rail that at least showed all eleven at once.
 *
 * So thin blocks that share a subject share a screen, and the row groups into four phases that
 * fit any width. Every step below holds at least three controls; that is the bar this file
 * exists to hold.
 *
 * ── Why this is static ───────────────────────────────────────────────────────────────────
 * It takes no `blocks` argument. Every block id is known at author time now that `facts` is
 * not a step (the Client intake step edits those paths directly — see compile-brief.ts's
 * factsSegment for where the include/exclude flag went). A registry derived from runtime
 * blocks would be a second source of truth for an ordering that is a design decision.
 */
import type { CopyBriefBlockId } from '@jdd/schema';

export type IntakePhaseId = 'intake' | 'direction' | 'structure' | 'generate';

export type IntakeStepKind = 'intake' | 'blocks' | 'prompt' | 'review';

export const PHASES: ReadonlyArray<{ id: IntakePhaseId; label: string }> = [
  { id: 'intake', label: 'Intake' },
  { id: 'direction', label: 'Direction' },
  { id: 'structure', label: 'Structure' },
  { id: 'generate', label: 'Generate' },
];

export interface IntakeStepDef {
  id: string;
  label: string;
  phase: IntakePhaseId;
  kind: IntakeStepKind;
  /** The blocks this screen renders, in order. Only for kind === 'blocks'. A block named
   *  here that resolveBrief doesn't produce is skipped, never thrown on. */
  blockIds?: CopyBriefBlockId[];
}

/**
 * INVARIANT: `facts` must never appear in any blockIds. resolveBrief no longer produces it,
 * and the Client intake step owns every one of its paths. Adding it here would render an
 * empty pane and give two screens write access to the same SiteContent paths.
 */
export const INTAKE_STEPS: ReadonlyArray<IntakeStepDef> = [
  { id: 'intake', label: 'Client intake', phase: 'intake', kind: 'intake' },
  { id: 'words', label: 'Their words', phase: 'intake', kind: 'blocks', blockIds: ['clientWords', 'website'] },
  { id: 'voice', label: 'Voice & rules', phase: 'direction', kind: 'blocks', blockIds: ['role', 'guardrails', 'forbidden'] },
  { id: 'positioning', label: 'Positioning', phase: 'direction', kind: 'blocks', blockIds: ['positioning', 'offers'] },
  { id: 'structure', label: 'Structure', phase: 'structure', kind: 'blocks', blockIds: ['structure'] },
  { id: 'sections', label: 'Section instructions', phase: 'structure', kind: 'blocks', blockIds: ['sections', 'custom'] },
  { id: 'prompt', label: 'Prompt', phase: 'generate', kind: 'prompt' },
  { id: 'review', label: 'Review', phase: 'generate', kind: 'review' },
];

export function stepsInPhase(phase: IntakePhaseId): IntakeStepDef[] {
  return INTAKE_STEPS.filter((s) => s.phase === phase);
}

export function stepIndex(id: string): number {
  const i = INTAKE_STEPS.findIndex((s) => s.id === id);
  return i < 0 ? 0 : i;
}

/**
 * Bundles persisted before this rebuild stored the Intake position as 'brief' | 'prompt' |
 * 'review' (the old three sub-stages). 'prompt' and 'review' survive as real step ids, so
 * they map to themselves; 'brief' covered eleven blocks and resolves to the first step.
 * Anything unrecognised — a step id from a future or abandoned layout — lands on step 1
 * rather than leaving the shell with an active id that matches nothing.
 */
export function migrateStepId(saved: unknown): string {
  if (typeof saved !== 'string') return 'intake';
  if (saved === 'brief') return 'intake';
  if (INTAKE_STEPS.some((s) => s.id === saved)) return saved;
  return 'intake';
}
