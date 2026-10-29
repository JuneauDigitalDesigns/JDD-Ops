'use client';
// The onboarding wizard's wayfinding trail: one crumb per PHASE (Provision → Voice → Post-call →
// Portal), replacing the old left rail. Linear with jump-back — you can click any phase you have
// reached (the active one or an earlier one) to return to it; phases ahead of you are not yet
// clickable. Distinct from the global shell/Breadcrumbs (Home / Section); this lives inside the
// wizard header and knows nothing about routes.

import { Fragment } from 'react';
import { CaretRight, Check } from '@phosphor-icons/react';
import { phaseProgress } from '@/lib/runbook-nav';
import type { Phase } from '@/lib/runbook-content';

export default function PhaseBreadcrumbs({
  phases,
  activePhaseId,
  done,
  onSelect,
}: {
  phases: Phase[];
  activePhaseId: string;
  done: Set<string>;
  onSelect: (phaseId: string) => void;
}) {
  const activeIndex = phases.findIndex((p) => p.id === activePhaseId);
  const GROUP_LABEL: Record<'onboarding' | 'review', string> = {
    onboarding: 'Onboarding',
    review: 'Review',
  };

  return (
    // WRAPS rather than scrolls. It used to be `overflow-x-auto`, which on a normal window cut
    // the later phases off entirely behind a scrollbar the operator had no reason to look for —
    // a wayfinding trail that hides where you are going is worse than no trail. Wrapping to a
    // second line costs a few pixels of header and shows every phase at once.
    <nav aria-label="Onboarding phases" className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-1.5">
      {phases.map((phase, i) => {
        const { completed, total } = phaseProgress(phase, done);
        const complete = total > 0 && completed >= total;
        const active = phase.id === activePhaseId;
        // Jump-back: reachable if it's the active phase, any earlier phase, or one you've already
        // made progress in. Never a phase ahead of where you are.
        const reachable = i <= activeIndex || completed > 0;
        // A macro-group label is printed when the group changes (always before the first crumb).
        const groupChanged = i === 0 || phases[i - 1].group !== phase.group;

        return (
          <Fragment key={phase.id}>
            {groupChanged && phase.group ? (
              <span className="flex shrink-0 items-center gap-1">
                {i > 0 && <span className="mx-1 h-3 w-px shrink-0" style={{ background: 'var(--rule)' }} aria-hidden />}
                <span className="kicker shrink-0" style={{ color: 'var(--fg-3)' }}>{GROUP_LABEL[phase.group]}</span>
              </span>
            ) : (
              i > 0 && <CaretRight size={11} className="shrink-0 text-fg3" aria-hidden />
            )}
            <button
              type="button"
              disabled={!reachable}
              onClick={() => onSelect(phase.id)}
              aria-current={active ? 'step' : undefined}
              className="group flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors disabled:cursor-default"
              style={{
                background: active ? 'var(--surface)' : 'transparent',
                color: active ? 'var(--fg)' : reachable ? 'var(--fg-2)' : 'var(--fg-3)',
                cursor: reachable && !active ? 'pointer' : undefined,
              }}
            >
              <span
                className="flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
                style={{
                  background: complete ? 'var(--accent)' : active ? 'var(--accent-glow)' : 'var(--surface-2)',
                  color: complete ? 'var(--bg-deep)' : active ? 'var(--accent)' : 'var(--fg-3)',
                  border: active && !complete ? '1px solid var(--accent)' : undefined,
                }}
              >
                {complete ? <Check size={10} weight="bold" /> : i + 1}
              </span>
              <span className="truncate">{phase.title}</span>
            </button>
          </Fragment>
        );
      })}
    </nav>
  );
}
