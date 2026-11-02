'use client';

/**
 * The Intake's one navigation row: four phases, each with a dot per step.
 *
 * Replaces a flat row of labelled pills — one per step. That worked at eleven and broke at
 * fourteen: the pills overflowed every realistic window width, so some steps were always
 * hidden off the right edge, which is strictly worse than the vertical rail it had replaced
 * (that at least showed every block at once). Phases fit any width because the label count is
 * fixed at four no matter how many steps exist.
 *
 * The grouping also carries the meaning the flat list threw away. Brief → Prompt → Review used
 * to be its own row of pills; flattening deleted that row, and these phases are where its
 * three-act story went — assemble what the client gave us, decide direction, fix the shape,
 * then generate.
 *
 * Two targets per phase, deliberately: the label jumps to the phase's first step (the common
 * move — "take me to Direction"), each dot jumps to its exact step (the precise move — "back
 * to Guardrails"). Both are always enabled; navigation here is fully free and the only hard
 * gate in the Intake is Approve, which the Review step owns.
 */
import { PHASES, type IntakeStepDef, type IntakePhaseId } from '@/lib/intake-steps';

export interface PhaseStepperStep {
  id: string;
  label: string;
  phase: IntakePhaseId;
  /** Things still wanting a value on this step. Renders an amber badge on the phase. */
  attention: number;
}

export default function PhaseStepper({
  steps, activeId, onSelect,
}: {
  /** One entry per step in INTAKE_STEPS order. */
  steps: PhaseStepperStep[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const activePhase = steps.find((s) => s.id === activeId)?.phase;

  return (
    <nav aria-label="Intake steps" className="flex flex-wrap items-center gap-x-1 gap-y-2">
      {PHASES.map((phase, phaseIdx) => {
        const inPhase = steps.filter((s) => s.phase === phase.id);
        if (inPhase.length === 0) return null;
        const isActive = activePhase === phase.id;
        const attention = inPhase.reduce((n, s) => n + s.attention, 0);
        const activeStep = inPhase.find((s) => s.id === activeId);

        return (
          <div key={phase.id} className="flex items-center gap-1">
            {/* Generate is the one phase that isn't an input — it runs the model and shows the
                result — so it reads as a separate group rather than a fourth sibling. */}
            {phaseIdx > 0 && (
              <span
                className={phase.id === 'generate' ? 'mx-1.5 h-5 w-px bg-uiCardRule' : 'mx-0.5 h-3 w-px bg-uiCardRule/60'}
                aria-hidden
              />
            )}

            <button
              type="button"
              onClick={() => onSelect(inPhase[0].id)}
              aria-current={isActive ? 'step' : undefined}
              title={`${phase.label} — ${inPhase.map((s) => s.label).join(', ')}`}
              className={[
                'flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                isActive
                  ? 'border-transparent bg-uiAccent text-uiAccentInk'
                  : 'border-uiCardRule text-uiFg2 hover:bg-uiSurface hover:text-uiInk',
              ].join(' ')}
            >
              <span className="whitespace-nowrap">{phase.label}</span>

              {attention > 0 && (
                <span
                  className="inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-chromeMono text-2xs font-semibold"
                  style={{ background: 'var(--warn)', color: '#fff' }}
                  title={`${attention} field${attention === 1 ? '' : 's'} with no value yet`}
                >
                  {attention}
                </span>
              )}
            </button>

            {/* Dots — one per step. Hidden for a single-step phase, where the label already
                is the step and a lone dot beside it would say nothing. */}
            {inPhase.length > 1 && (
              <span className="flex items-center gap-1 pl-0.5">
                {inPhase.map((s) => {
                  const on = s.id === activeId;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onSelect(s.id)}
                      aria-label={s.label}
                      aria-current={on ? 'step' : undefined}
                      title={s.label}
                      className="group flex h-5 w-3 items-center justify-center"
                    >
                      <span
                        className="block rounded-full transition-all"
                        style={{
                          width: on ? 7 : 5,
                          height: on ? 7 : 5,
                          background: on ? 'var(--ui-accent)' : 'var(--ui-fg-3)',
                          opacity: on ? 1 : 0.5,
                        }}
                      />
                    </button>
                  );
                })}
              </span>
            )}

            {/* The active step's name, shown only for the active phase. This is what keeps the
                row honest: four phase labels alone never tell you which of a phase's steps you
                are actually on. */}
            {isActive && activeStep && inPhase.length > 1 && (
              <span className="ml-0.5 whitespace-nowrap font-chromeMono text-2xs text-uiFg3">
                {activeStep.label}
              </span>
            )}
          </div>
        );
      })}
    </nav>
  );
}

/** Build the stepper's step list from the registry plus a per-step attention lookup. */
export function toStepperSteps(
  defs: ReadonlyArray<IntakeStepDef>,
  attentionFor: (step: IntakeStepDef) => number,
): PhaseStepperStep[] {
  return defs.map((s) => ({ id: s.id, label: s.label, phase: s.phase, attention: attentionFor(s) }));
}
