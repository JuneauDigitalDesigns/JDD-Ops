'use client';

import { motion } from 'framer-motion';
import { Lightning } from '@phosphor-icons/react';
import NavRail, { RailGroup } from '@/components/shell/NavRail';
import RailRow, { RefTag, StepNumber } from '@/components/shell/RailRow';
import { EASE } from '@/lib/motion';
import { groupBySite, phaseProgress, type StepNode } from '@/lib/runbook-nav';
import type { ClientContext, ClientStatus } from '@/lib/types';
import StatusControl from './StatusControl';

/**
 * The runbook's step list: where you are, what's left, and jump-anywhere navigation.
 *
 * Thin, like ManageRail — <NavRail> owns the shell and <RailRow> owns the row, so the two
 * rails can no longer drift apart in width, padding, or active treatment. What's left here
 * is the runbook-specific structure: phases → per-site groups → steps.
 *
 * Two row treatments, deliberately different:
 *   • Actionable steps get a numbered circle that fills on completion — a to-do.
 *   • Reference steps (auto: true) get a REF tag instead. They're the architecture screens,
 *     but they are read, not done. Giving them a checkbox would put them in the progress
 *     count and make 100% unreachable.
 *
 * The client identity header (brandName, plan badge) moved out — the navbar says it. What
 * stayed is what the header carried that was load-bearing: the status control and the run
 * progress, both now in the rail footer where they read as status rather than as a title.
 */
export default function StepRail({
  ctx, nodes, done, activeId, onSelect, pct, completed, total,
  effectiveStatus, onSetStatus, launchActive,
}: {
  ctx: ClientContext;
  nodes: StepNode[];
  done: Set<string>;
  activeId: string;
  onSelect: (id: string) => void;
  pct: number;
  completed: number;
  total: number;
  effectiveStatus: ClientStatus;
  onSetStatus: (s: ClientStatus) => void;
  launchActive: boolean;
}) {
  const phases = [...new Map(nodes.map((x) => [x.phase.id, x.phase])).values()];
  // Only two phases (starter) reads as a truncated app if each gets a heavy header, so the
  // group headers stay hairline-quiet at low phase counts.
  const quietHeaders = phases.length <= 2;

  const siteName = (slug: string) => {
    const s = ctx.sites.find((x) => x.slug === slug);
    return s?.brandShort ?? s?.brandName ?? slug;
  };

  return (
    <NavRail
      label="Runbook steps"
      footer={
        <>
          <StatusControl
            value={effectiveStatus}
            detected={ctx.detectedStatus}
            onChange={onSetStatus}
          />
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <span className="meta">{completed}/{total} steps</span>
              <span className="font-display text-base font-medium leading-none text-accent">
                {pct}%
              </span>
            </div>
            <div
              className="h-[3px] w-full overflow-hidden rounded-full"
              style={{ background: 'var(--rule)' }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'var(--accent)', boxShadow: '0 0 12px var(--accent-glow)' }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.5, ease: EASE }}
              />
            </div>
          </div>
        </>
      }
    >
      {phases.map((phase) => {
        const phaseNodes = nodes.filter((x) => x.phase.id === phase.id);
        const p = phaseProgress(phase, done);

        return (
          <RailGroup
            key={phase.id}
            title={phase.title}
            count={`${p.completed}/${p.total}`}
            tight={quietHeaders}
          >
            {groupBySite(phaseNodes).map((group, gi) => (
              <div key={`${phase.id}-${group.site ?? gi}`} className="flex flex-col">
                {group.site && ctx.isEnterprise && (
                  <span
                    className="meta truncate px-4 pb-0.5 pt-2"
                    style={{ color: 'var(--accent)' }}
                  >
                    {siteName(group.site)}
                  </span>
                )}
                {group.nodes.map((node) => {
                  const isDone = done.has(node.step.id);
                  const highlighted = activeId === node.step.id || (launchActive && !!node.step.launch);
                  return (
                    <RailRow
                      key={node.step.id}
                      label={node.step.title}
                      active={highlighted}
                      onClick={() => onSelect(node.step.id)}
                      muted={!node.actionable}
                      struck={isDone && !highlighted}
                      sublabel={node.step.est && !isDone ? node.step.est : undefined}
                      leading={
                        node.actionable ? (
                          <StepNumber n={node.n} done={isDone} active={highlighted} />
                        ) : (
                          <RefTag />
                        )
                      }
                      trailing={
                        node.step.launch ? (
                          <Lightning
                            size={12}
                            weight="fill"
                            className="mt-[3px] shrink-0"
                            style={{ color: 'var(--accent-2)' }}
                          />
                        ) : undefined
                      }
                    />
                  );
                })}
              </div>
            ))}
          </RailGroup>
        );
      })}
    </NavRail>
  );
}
