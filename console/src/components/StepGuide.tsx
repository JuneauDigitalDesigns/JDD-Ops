'use client';
import { useState } from 'react';
import type { Phase } from '@/lib/runbook-content';
import StepCard from './StepCard';

export default function StepGuide({
  phases,
  done,
  onToggle,
  startIndex = 1,
}: {
  phases: Phase[];
  done: Set<string>;
  onToggle: (id: string) => void;
  startIndex?: number;
}) {
  // Flat, ordered list drives auto-advance.
  const flat = phases.flatMap((p) => p.steps);
  const firstIncomplete = flat.find((s) => !done.has(s.id))?.id ?? '';

  // openId === null → "auto" (open the first incomplete step). A real id or '' (none) is explicit.
  const [openId, setOpenId] = useState<string | null>(null);
  const effectiveOpen = openId ?? firstIncomplete;

  function handleToggle(id: string) {
    const wasDone = done.has(id);
    onToggle(id);
    if (!wasDone) {
      // Just marked done → auto-open the next still-incomplete step.
      const idx = flat.findIndex((s) => s.id === id);
      const next = flat.slice(idx + 1).find((s) => !done.has(s.id));
      setOpenId(next ? next.id : '');
    }
  }

  function handleOpen(id: string) {
    setOpenId((prev) => {
      const cur = prev ?? firstIncomplete;
      return cur === id ? '' : id; // clicking the open step collapses it; otherwise open just that one
    });
  }

  let n = startIndex;
  return (
    <div className="flex flex-col gap-8">
      {phases.map((phase) => {
        const completed = phase.steps.filter((s) => done.has(s.id)).length;
        return (
          <section key={phase.id} className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3 border-b border-rule pb-2">
              <div className="flex flex-col gap-0.5">
                <h3 className="font-display text-[19px] font-medium tracking-tightish">{phase.title}</h3>
                {phase.subtitle && <p className="text-[12.5px] text-fg3">{phase.subtitle}</p>}
              </div>
              <span className="kicker shrink-0">
                {completed}/{phase.steps.length} done
              </span>
            </div>
            <div className="flex flex-col gap-2.5">
              {phase.steps.map((step) => {
                const idx = n++;
                return (
                  <StepCard
                    key={step.id}
                    step={step}
                    n={idx}
                    done={done.has(step.id)}
                    onToggle={() => handleToggle(step.id)}
                    open={effectiveOpen === step.id}
                    onOpen={() => handleOpen(step.id)}
                  />
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
