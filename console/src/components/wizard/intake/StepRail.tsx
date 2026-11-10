'use client';

/**
 * The Intake's one navigation row: every step by name, grouped by phase, each with a count of
 * its required open items (the same list Still to do shows). Replaces PhaseStepper's
 * phase-and-dots row, which hid step names because fourteen pills once overflowed; eleven
 * names fit a laptop width. On a narrow window the row scrolls sideways rather than wrapping.
 */
import { PHASES, type IntakeStepDef } from '@/lib/intake-steps';

export default function StepRail({
  steps, activeId, counts, onSelect,
}: {
  steps: ReadonlyArray<IntakeStepDef>;
  activeId: string;
  counts: Record<string, number>;
  onSelect: (id: string) => void;
}) {
  return (
    <nav aria-label="Intake steps" className="no-scrollbar flex items-stretch overflow-x-auto">
      {PHASES.map((phase, pi) => {
        const inPhase = steps.filter((s) => s.phase === phase.id);
        if (inPhase.length === 0) return null;
        return (
          <div key={phase.id} className={`flex shrink-0 flex-col justify-center gap-1 px-2.5 ${pi > 0 ? 'border-l border-uiCardRule/60' : 'pl-0'}`}>
            <span className="font-chromeMono text-[10px] uppercase tracking-[0.14em] text-uiFg3">{phase.label}</span>
            <div className="flex gap-1">
              {inPhase.map((s) => {
                const n = steps.indexOf(s) + 1;
                const on = s.id === activeId;
                const count = counts[s.id] ?? 0;
                const end = s.kind === 'todo';
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onSelect(s.id)}
                    aria-current={on ? 'step' : undefined}
                    className={[
                      'inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-[13px] transition-colors',
                      on ? 'font-semibold' : 'text-uiFg2 hover:bg-uiSurface hover:text-uiInk',
                      end && !on ? 'border border-dashed border-uiCardRule' : '',
                    ].join(' ')}
                    style={on ? { background: 'var(--ui-accent)', color: 'var(--ui-accent-ink)' } : undefined}
                  >
                    <span className="font-chromeMono text-[11px]" style={{ opacity: on ? 0.85 : 0.6 }}>{n}</span>
                    {s.label}
                    {count > 0 && (
                      <span
                        className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 font-chromeMono text-[10.5px] text-white"
                        style={{ background: 'var(--warn)' }}
                        title={`${count} open`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
