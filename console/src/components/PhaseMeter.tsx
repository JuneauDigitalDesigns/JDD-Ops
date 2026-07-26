'use client';
// One segment per runbook phase, filled by that phase's completion.
//
// A single percentage tells you how much is left; this tells you WHERE a client is stuck, which
// is the only question the roster exists to answer. Shared by the list row and the Kanban card so
// the two can't drift into showing progress differently.

import { phaseProgress } from '@/lib/runbook-nav';
import type { Phase } from '@/lib/runbook-content';

export default function PhaseMeter({
  phases,
  done,
  color,
  height = 5,
}: {
  phases: Phase[];
  /** Completed step ids. */
  done: Set<string>;
  color: string;
  height?: number;
}) {
  return (
    <div className="flex gap-1" aria-hidden>
      {phases.map((phase) => {
        const p = phaseProgress(phase, done);
        const frac = p.total ? p.completed / p.total : 0;
        return (
          <span
            key={phase.id}
            title={`${phase.title} — ${p.completed}/${p.total}`}
            className="flex-1 overflow-hidden rounded-full"
            style={{ height, background: 'var(--rule)' }}
          >
            <span
              className="block h-full rounded-full transition-[width] duration-500"
              style={{ width: `${frac * 100}%`, background: color }}
            />
          </span>
        );
      })}
    </div>
  );
}
