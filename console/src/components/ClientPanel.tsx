'use client';
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { buildRunbook, PLAN_LABEL } from '@/lib/runbook-content';
import type { ClientContext, ClientState, ClientStatus, OpsConfig } from '@/lib/types';
import StatusControl from './StatusControl';
import LaunchPanel from './LaunchPanel';
import StepGuide from './StepGuide';

export default function ClientPanel({
  ctx,
  config,
  clientState,
  onSetStatus,
  onToggleStep,
  onRefresh,
  onOpenSetup,
}: {
  ctx: ClientContext;
  config: OpsConfig;
  clientState: ClientState | undefined;
  onSetStatus: (status: ClientStatus) => void;
  onToggleStep: (id: string, done: boolean) => void;
  onRefresh: () => void;
  onOpenSetup: () => void;
}) {
  const phases = useMemo(() => buildRunbook(ctx, config), [ctx, config]);

  const done = useMemo(
    () => new Set(Object.entries(clientState?.steps ?? {}).filter(([, v]) => v).map(([k]) => k)),
    [clientState],
  );
  const effectiveStatus = clientState?.status ?? ctx.detectedStatus;

  const total = phases.reduce((n, p) => n + p.steps.length, 0);
  const completed = phases.reduce((n, p) => n + p.steps.filter((s) => done.has(s.id)).length, 0);
  const pct = total ? Math.round((completed / total) * 100) : 0;

  return (
    <motion.div
      key={ctx.slug}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col gap-6"
    >
      {/* Header */}
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <h2 className="font-display text-[30px] font-semibold leading-none tracking-tightest">{ctx.brandName}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <span className="codechip">{ctx.slug}</span>
              <span className="badge badge-accent">{PLAN_LABEL[ctx.plan]}</span>
              <StatusControl value={effectiveStatus} detected={ctx.detectedStatus} onChange={onSetStatus} />
            </div>
          </div>
          <div className="text-right">
            <div className="font-display text-[26px] font-medium leading-none text-accent">{pct}%</div>
            <div className="kicker mt-1">
              {completed}/{total} steps
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-[3px] w-full overflow-hidden rounded-full" style={{ background: 'var(--rule)' }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'var(--accent)', boxShadow: '0 0 12px var(--accent-glow)' }}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>

        {/* Enterprise site roster */}
        {ctx.isEnterprise && ctx.sites.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {ctx.sites.map((s) => (
              <span key={s.slug} className="badge">
                {s.brandShort ?? s.brandName}
                <span className="mono ml-1 text-fg3">{s.slug}</span>
              </span>
            ))}
          </div>
        )}
      </header>

      <LaunchPanel ctx={ctx} onComplete={onRefresh} onOpenSetup={onOpenSetup} />

      <StepGuide phases={phases} done={done} onToggle={(id) => onToggleStep(id, !done.has(id))} />
    </motion.div>
  );
}
