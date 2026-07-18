'use client';
import { useMemo } from 'react';
import { CaretRight } from '@phosphor-icons/react';
import type { ClientContext, ClientState, OpsConfig } from '@/lib/types';
import { buildRunbook, PLAN_LABEL } from '@/lib/runbook-content';

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
  ctx, clientState, config, onSelect,
}: {
  ctx: ClientContext;
  clientState: ClientState | undefined;
  config: OpsConfig;
  onSelect: () => void;
}) {
  const phases = useMemo(() => buildRunbook(ctx, config), [ctx, config]);
  const { total, completed } = useMemo(() => {
    const steps = clientState?.steps ?? {};
    let t = 0, c = 0;
    for (const p of phases) for (const s of p.steps) { if (s.auto) continue; t++; if (steps[s.id]) c++; }
    return { total: t, completed: c };
  }, [phases, clientState]);
  const { label, color } = STATUS[deriveStatus(completed, total)];
  const pct = total ? Math.round((completed / total) * 100) : 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group flex w-full items-center gap-5 border-b border-rule px-2 py-4 text-left transition-colors last:border-0 hover:bg-[var(--surface)]"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2.5">
          <h3 className="truncate font-display text-[18px] font-semibold leading-none">{ctx.brandName}</h3>
          <span className="kicker shrink-0 text-fg3">{PLAN_LABEL[ctx.plan]}</span>
        </div>
        <span className="mono mt-1 block text-[12px] text-fg3">{ctx.slug}</span>
      </div>

      <div className="hidden items-center gap-2 sm:flex" style={{ width: 120 }}>
        <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: color, boxShadow: `0 0 8px 1px ${color}` }} />
        <span className="text-[12.5px] font-medium" style={{ color }}>{label}</span>
      </div>

      <div className="flex w-[120px] shrink-0 items-center gap-3">
        <div className="h-[4px] flex-1 overflow-hidden rounded-full" style={{ background: 'var(--rule)' }}>
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
        </div>
        <span className="kicker w-[42px] shrink-0 text-right">{completed}/{total}</span>
      </div>

      <CaretRight size={15} className="shrink-0 text-fg3 transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}
