'use client';
import { CaretRight } from '@phosphor-icons/react';
import type { Phase } from '@/lib/runbook-content';

export default function PhaseNav({
  phases,
  activePhaseId,
  onJump,
}: {
  phases: Phase[];
  activePhaseId: string | null;
  onJump: (id: string) => void;
}) {
  return (
    <nav className="mb-1 flex flex-wrap items-center gap-2 border-b border-rule pb-5">
      {phases.map((phase, i) => (
        <div key={phase.id} className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onJump(phase.id)}
            className="text-[12.5px] font-medium transition-colors"
            style={{ color: activePhaseId === phase.id ? 'var(--accent)' : 'var(--fg-3)' }}
          >
            {phase.title}
          </button>
          {i < phases.length - 1 && (
            <CaretRight size={11} style={{ color: 'var(--fg-3)', flexShrink: 0 }} />
          )}
        </div>
      ))}
    </nav>
  );
}
