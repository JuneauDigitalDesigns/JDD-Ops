'use client';
// One client, as an editorial-index row.
//
// The old card carried a single percentage bar, which tells you how much is left but not
// WHERE a client is stuck — and "stuck" is the only thing this screen exists to surface. So
// the bar is now one segment per phase, and the row names the next actual step. At a glance:
// which client is stalled, and on what.

import { useMemo } from 'react';
import { CaretRight } from '@phosphor-icons/react';
import type { ClientContext, ClientState, OpsConfig } from '@/lib/types';
import { buildRunbook, PLAN_LABEL } from '@/lib/runbook-content';
import { firstIncomplete, flatten, progressOf } from '@/lib/runbook-nav';
import PhaseMeter from './PhaseMeter';

type StepStatus = 'not-started' | 'in-progress' | 'done';
function deriveStatus(c: number, t: number): StepStatus {
  if (t === 0 || c === 0) return 'not-started';
  if (c === t) return 'done';
  return 'in-progress';
}
const STATUS: Record<StepStatus, { label: string; color: string }> = {
  'not-started': { label: 'Not started', color: 'var(--fg-3)' },
  'in-progress': { label: 'In progress', color: 'var(--warn)' },
  done: { label: 'Done', color: 'var(--ok)' },
};

export default function ClientCard({
  ctx, clientState, config, index, onSelect,
}: {
  ctx: ClientContext;
  clientState: ClientState | undefined;
  config: OpsConfig;
  index: number;
  onSelect: () => void;
}) {
  const phases = useMemo(() => buildRunbook(ctx, config), [ctx, config]);
  const nodes = useMemo(() => flatten(phases), [phases]);
  const done = useMemo(
    () => new Set(Object.entries(clientState?.steps ?? {}).filter(([, v]) => v).map(([k]) => k)),
    [clientState],
  );

  const { total, completed } = progressOf(nodes, done);
  const { label, color } = STATUS[deriveStatus(completed, total)];
  const next = firstIncomplete(nodes, done);

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group relative flex w-full items-center gap-5 border-b border-rule py-5 pl-3 pr-3 text-left transition-all last:border-0 hover:bg-[var(--surface)] hover:shadow-raised"
    >
      {/* Heavy numeral — an index, not a count. Dim until hover. */}
      <span
        aria-hidden
        className="hidden w-[52px] shrink-0 select-none text-right font-display font-black leading-none transition-colors sm:block"
        style={{ fontSize: 34, color: 'var(--rule-strong)' }}
      >
        {String(index + 1).padStart(2, '0')}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <h3 className="truncate font-display text-2xl font-semibold leading-none tracking-tightish">
            {ctx.brandName}
          </h3>
          <span className="kicker shrink-0">{PLAN_LABEL[ctx.plan]}</span>
          {ctx.isEnterprise && ctx.sites.length > 1 && (
            <span className="kicker shrink-0" style={{ color: 'var(--accent)' }}>{ctx.sites.length} sites</span>
          )}
        </div>
        <span className="mono mt-1 block truncate text-2xs text-fg3">
          {next ? <>next · {next.step.title}</> : ctx.slug}
        </span>
      </div>

      <div className="hidden items-center gap-2 md:flex" style={{ width: 110 }}>
        <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: color, boxShadow: `0 0 8px 1px ${color}` }} />
        <span className="text-xs font-medium" style={{ color }}>{label}</span>
      </div>

      {/* Segmented phase meter — one segment per phase, filled by that phase's progress. */}
      <div className="flex w-[150px] shrink-0 flex-col gap-1.5">
        <PhaseMeter phases={phases} done={done} color={color} />
        <span className="kicker text-right" style={{ fontSize: 9.5 }}>{completed}/{total} steps</span>
      </div>

      <CaretRight size={15} className="shrink-0 text-fg3 transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}
