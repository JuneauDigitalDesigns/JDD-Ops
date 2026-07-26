'use client';
// The persistent left rail: where you are, what's left, and jump-anywhere navigation.
//
// Two row treatments, deliberately different:
//   • Actionable steps get a numbered circle that fills on completion — a to-do.
//   • Reference steps (auto: true) get a REF tag instead. They're the architecture screens,
//     now the most valuable ones in the app, but they are read, not done. Giving them a
//     checkbox would put them in the progress count and make 100% unreachable.

import { motion } from 'framer-motion';
import { ArrowLeft, Check, Lightning } from '@phosphor-icons/react';
import { EASE } from '@/lib/motion';
import { groupBySite, phaseProgress, type StepNode } from '@/lib/runbook-nav';
import { PLAN_LABEL } from '@/lib/runbook-content';
import type { ClientContext, ClientStatus } from '@/lib/types';
import StatusControl from './StatusControl';

export default function StepRail({
  ctx, nodes, done, activeId, onSelect, onBack, backDisabled, pct, completed, total,
  effectiveStatus, onSetStatus, launchActive,
}: {
  ctx: ClientContext;
  nodes: StepNode[];
  done: Set<string>;
  activeId: string;
  onSelect: (id: string) => void;
  onBack: () => void;
  /** True while a run is streaming — leaving would kill it mid-provision. */
  backDisabled: boolean;
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
    <nav
      className="no-scrollbar flex h-full w-[286px] shrink-0 flex-col overflow-y-auto border-r border-rule"
      aria-label="Runbook steps"
    >
      {/* ── Client header ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 border-b border-rule px-5 py-4">
        <button
          type="button"
          onClick={onBack}
          disabled={backDisabled}
          title={backDisabled ? 'A provisioning run is in progress' : 'Back to all clients'}
          className="-ml-1 flex w-fit items-center gap-1.5 text-xs text-fg3 transition-colors hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowLeft size={13} /> All clients
        </button>

        <div className="flex flex-col gap-1.5">
          <h2 className="font-display text-2xl font-semibold leading-none tracking-tightest">{ctx.brandName}</h2>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="badge badge-accent">{PLAN_LABEL[ctx.plan]}</span>
            <StatusControl value={effectiveStatus} detected={ctx.detectedStatus} onChange={onSetStatus} />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <span className="kicker">{completed}/{total} steps</span>
            <span className="font-display text-lg font-medium leading-none text-accent">{pct}%</span>
          </div>
          <div className="h-[3px] w-full overflow-hidden rounded-full" style={{ background: 'var(--rule)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'var(--accent)', boxShadow: '0 0 12px var(--accent-glow)' }}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.5, ease: EASE }}
            />
          </div>
        </div>
      </div>

      {/* ── Phases → steps ────────────────────────────────────────────── */}
      <div className="flex flex-col py-2">
        {phases.map((phase) => {
          const phaseNodes = nodes.filter((x) => x.phase.id === phase.id);
          const p = phaseProgress(phase, done);
          const groups = groupBySite(phaseNodes);

          return (
            <section key={phase.id} className="flex flex-col">
              <div className={`flex items-center justify-between gap-2 px-5 ${quietHeaders ? 'pb-1 pt-3' : 'pb-1.5 pt-4'}`}>
                <span className="kicker truncate">{phase.title}</span>
                <span className="kicker shrink-0" style={{ fontSize: 9.5 }}>{p.completed}/{p.total}</span>
              </div>

              {groups.map((group, gi) => (
                <div key={`${phase.id}-${group.site ?? gi}`} className="flex flex-col">
                  {group.site && ctx.isEnterprise && (
                    <span className="kicker px-5 pb-0.5 pt-2 truncate" style={{ color: 'var(--accent)', fontSize: 9.5 }}>
                      {siteName(group.site)}
                    </span>
                  )}
                  {group.nodes.map((node) => (
                    <RailRow
                      key={node.step.id}
                      node={node}
                      done={done.has(node.step.id)}
                      active={activeId === node.step.id}
                      launchActive={launchActive && !!node.step.launch}
                      onSelect={() => onSelect(node.step.id)}
                    />
                  ))}
                </div>
              ))}
            </section>
          );
        })}
      </div>
    </nav>
  );
}

function RailRow({
  node, done, active, launchActive, onSelect,
}: {
  node: StepNode;
  done: boolean;
  active: boolean;
  launchActive: boolean;
  onSelect: () => void;
}) {
  const highlighted = active || launchActive;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={highlighted ? 'step' : undefined}
      className="group relative flex w-full items-start gap-2.5 py-2 pl-5 pr-4 text-left transition-colors"
      style={{ background: highlighted ? 'var(--surface-2)' : undefined }}
    >
      {/* Active marker — a 2px accent edge, not a border, so rows don't shift. */}
      <span
        className="absolute left-0 top-0 h-full w-[2px]"
        style={{ background: highlighted ? 'var(--accent)' : 'transparent' }}
      />

      {node.actionable ? (
        <span
          className="mt-[1px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border text-[10px] font-medium transition-colors"
          style={
            done
              ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: 'var(--accent-ink)' }
              : { borderColor: highlighted ? 'var(--accent)' : 'var(--rule-strong)', color: 'var(--fg-3)' }
          }
        >
          {done ? <Check size={11} weight="bold" /> : node.n}
        </span>
      ) : (
        <span className="kicker mt-[3px] w-[18px] shrink-0 text-center" style={{ fontSize: 8.5 }}>REF</span>
      )}

      <span className="min-w-0 flex-1">
        <span
          className="block text-xs leading-[1.4]"
          style={{
            color: highlighted ? 'var(--fg)' : node.actionable ? 'var(--fg-2)' : 'var(--fg-3)',
            fontWeight: highlighted ? 500 : 400,
            textDecoration: done && !highlighted ? 'line-through' : undefined,
          }}
        >
          {node.step.title}
        </span>
        {node.step.est && !done && (
          <span className="kicker mt-0.5 block" style={{ fontSize: 9 }}>{node.step.est}</span>
        )}
      </span>

      {node.step.launch && (
        <Lightning size={12} weight="fill" className="mt-[3px] shrink-0" style={{ color: 'var(--accent-2)' }} />
      )}
    </button>
  );
}
