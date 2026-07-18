'use client';
import { useMemo, useState } from 'react';
import { CaretRight } from '@phosphor-icons/react';
import type { Phase } from '@/lib/runbook-content';
import StepCard from './StepCard';

export default function StepGuide({
  phases, done, onToggle, startIndex = 1,
}: {
  phases: Phase[];
  done: Set<string>;
  onToggle: (id: string) => void;
  startIndex?: number;
}) {
  const flat = phases.flatMap((p) => p.steps);
  const firstIncomplete = flat.find((s) => !s.auto && !done.has(s.id));

  // The phase owning the first incomplete step is "active" and open by default.
  const activePhaseId = useMemo(() => {
    if (!firstIncomplete) return phases[phases.length - 1]?.id ?? null;
    return phases.find((p) => p.steps.some((s) => s.id === firstIncomplete.id))?.id ?? phases[0]?.id ?? null;
  }, [phases, firstIncomplete]);

  const [expandedPhaseId, setExpandedPhaseId] = useState<string | null>(null);
  const effectivePhase = expandedPhaseId ?? activePhaseId;

  const [openStepId, setOpenStepId] = useState<string | null>(null);
  const effectiveOpenStep = openStepId ?? firstIncomplete?.id ?? '';

  function toggleStep(id: string) {
    const wasDone = done.has(id);
    onToggle(id);
    if (!wasDone) {
      const idx = flat.findIndex((s) => s.id === id);
      const next = flat.slice(idx + 1).find((s) => !s.auto && !done.has(s.id));
      setOpenStepId(next ? next.id : '');
    }
  }
  function openStep(id: string) {
    setOpenStepId((prev) => ((prev ?? firstIncomplete?.id ?? '') === id ? '' : id));
  }

  let n = startIndex;
  return (
    <div className="flex flex-col">
      {phases.map((phase) => {
        const actionable = phase.steps.filter((s) => !s.auto).length;
        const completed = phase.steps.filter((s) => !s.auto && done.has(s.id)).length;
        const isOpen = effectivePhase === phase.id;
        const stepNumbers = phase.steps.map((s) => (s.auto ? 0 : n++)); // continuous across phases
        return (
          <section key={phase.id} className="border-b border-rule last:border-0">
            <button
              type="button"
              onClick={() => setExpandedPhaseId(isOpen ? '' : phase.id)}
              className="flex w-full items-center gap-3 py-4 text-left"
            >
              <CaretRight
                size={14}
                className="shrink-0 text-fg3 transition-transform"
                style={{ transform: isOpen ? 'rotate(90deg)' : 'none' }}
              />
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-[18px] font-medium tracking-tightish">{phase.title}</h3>
                {phase.subtitle && isOpen && <p className="mt-0.5 text-[12.5px] text-fg3">{phase.subtitle}</p>}
              </div>
              <span className="kicker shrink-0">{completed}/{actionable} done</span>
            </button>
            {isOpen && (
              <div className="flex flex-col pb-4">
                {phase.steps.map((step, i) => (
                  <StepCard
                    key={step.id}
                    step={step}
                    n={stepNumbers[i]}
                    done={done.has(step.id)}
                    onToggle={() => toggleStep(step.id)}
                    open={effectiveOpenStep === step.id}
                    onOpen={() => openStep(step.id)}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
