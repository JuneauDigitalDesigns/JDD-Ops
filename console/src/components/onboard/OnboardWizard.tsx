'use client';
// One client's onboarding, as a top-breadcrumb wizard.
//
// The state model is one cursor (which step is on stage) and one mode ('steps' | 'launch'),
// with the run itself in useOnboardRun — kept here, above the stage, so switching steps or
// phases mid-run never aborts the stream.
//
// Three things about the chrome are deliberate:
//
// 1. There is no identity block. "ONBOARD / {brand}" sat left of the trail and cost it enough
//    width to clip the later phases on a normal window — the one thing a wayfinding trail may
//    never do. The client is already named in the route, the global breadcrumbs and the page
//    title; the trail is the only thing here that needs the space.
// 2. Back/Next live in a STICKY sub-bar under the header rather than in the stage footer, so
//    they stay reachable on a long step instead of requiring a scroll back to the bottom.
// 3. Next COMPLETES an actionable step and advances, instead of there being a separate
//    "Complete step" button. Revisiting a completed step then shows the completed overlay,
//    which is what makes one forward control sufficient.

import { useCallback, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check } from '@phosphor-icons/react';
import { buildRunbook } from '@/lib/runbook-content';
import { firstIncomplete, flatten, progressOf } from '@/lib/runbook-nav';
import { useOnboardRun } from '@/lib/useOnboardRun';
import { EASE } from '@/lib/motion';
import type { ClientContext, ClientState, ClientStatus, OpsConfig } from '@/lib/types';
import { RunbookProvider } from '@/components/RunbookContext';
import StatusControl from '@/components/StatusControl';
import PhaseBreadcrumbs from './PhaseBreadcrumbs';
import OnboardStage from './OnboardStage';
import OnboardLaunch from './OnboardLaunch';
import ReferencePanel from './ReferencePanel';

export default function OnboardWizard({
  ctx, config, clientState, onSetStatus, onToggleStep, onRunComplete,
}: {
  ctx: ClientContext;
  config: OpsConfig;
  clientState: ClientState | undefined;
  onSetStatus: (status: ClientStatus) => void;
  onToggleStep: (id: string, done: boolean) => void;
  onRunComplete: (result: { ok: boolean; dryRun: boolean }) => void;
}) {
  const phases = useMemo(() => buildRunbook(ctx, config), [ctx, config]);
  const nodes = useMemo(() => flatten(phases), [phases]);
  const done = useMemo(
    () => new Set(Object.entries(clientState?.steps ?? {}).filter(([, v]) => v).map(([k]) => k)),
    [clientState],
  );

  const [cursor, setCursor] = useState<string | null>(null);
  const [mode, setMode] = useState<'steps' | 'launch'>('steps');

  const run = useOnboardRun(ctx, onRunComplete);

  const fallback = firstIncomplete(nodes, done) ?? nodes[nodes.length - 1];
  const active = nodes.find((x) => x.step.id === cursor) ?? fallback;

  const { total, completed, pct } = progressOf(nodes, done);
  const effectiveStatus = clientState?.status ?? ctx.detectedStatus;

  const goTo = useCallback((id: string) => {
    setCursor(id);
    setMode('steps');
  }, []);

  // Breadcrumb click: land on the phase's first step in steps mode (never straight to launch).
  const selectPhase = useCallback((phaseId: string) => {
    const first = nodes.find((x) => x.phase.id === phaseId);
    if (first) goTo(first.step.id);
  }, [nodes, goTo]);

  const move = useCallback((delta: number) => {
    if (!active) return;
    const next = nodes[active.index + delta];
    if (next) goTo(next.step.id);
  }, [active, nodes, goTo]);

  /**
   * The single forward control. Completes an actionable step that isn't done, then advances.
   *
   * Plain sequential order, not nextActionable: now that the routing reference lives in the
   * reference panel rather than the step list, there is nothing in the flow to skip, and
   * "Next goes to the next thing" is easier to trust than a rule about which steps count.
   */
  const forward = useCallback(() => {
    if (!active) return;
    if (active.actionable && !done.has(active.step.id)) onToggleStep(active.step.id, true);
    const next = nodes[active.index + 1];
    if (next) goTo(next.step.id);
  }, [active, nodes, done, onToggleStep, goTo]);

  if (!active) return null;

  const isDone = done.has(active.step.id);
  const hasNext = active.index < nodes.length - 1;
  const atEnd = !hasNext;
  const forwardLabel = active.actionable && !isDone ? (atEnd ? 'Mark done' : 'Done, next') : 'Next';

  return (
    <RunbookProvider value={{ ctx, config, run: run.run, running: run.running }}>
      {/* pr-[46px] leaves room for the reference rail, which is fixed to the right edge. */}
      <div className="no-scrollbar flex h-full min-h-0 flex-col overflow-hidden pr-[46px]">
        {/* ── Header: phase trail · status + progress ──────────────────── */}
        <div className="shrink-0 border-b border-rule px-6 py-2.5 lg:px-10">
          <div className="mx-auto flex w-full max-w-[1420px] items-center gap-5">
            <div className="min-w-0 flex-1">
              <PhaseBreadcrumbs
                phases={phases}
                activePhaseId={active.phase.id}
                done={done}
                onSelect={selectPhase}
              />
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <StatusControl value={effectiveStatus} detected={ctx.detectedStatus} onChange={onSetStatus} />
              <div className="hidden min-w-[132px] flex-col gap-1 sm:flex">
                <div className="flex items-baseline justify-between">
                  <span className="meta">{completed}/{total}</span>
                  <span className="font-display text-sm font-medium leading-none text-accent">{pct}%</span>
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
          </div>
        </div>

        {/* ── Sticky nav sub-bar ───────────────────────────────────────── */}
        {mode === 'steps' && (
          <div
            className="shrink-0 border-b border-rule px-6 py-2 lg:px-10"
            style={{ background: 'color-mix(in srgb, var(--bg) 86%, transparent)', backdropFilter: 'blur(12px)' }}
          >
            <div className="mx-auto flex w-full max-w-[1420px] items-center gap-4">
              <button
                type="button"
                onClick={() => move(-1)}
                disabled={active.index === 0}
                className="btn btn-sm"
              >
                <ArrowLeft size={13} /> Back
              </button>

              <div className="flex min-w-0 flex-1 items-center justify-center gap-2.5">
                <span className="meta truncate">{active.phase.title}</span>
                <span className="h-[3px] w-[3px] shrink-0 rounded-full" style={{ background: 'var(--fg-3)' }} />
                <span className="meta shrink-0">
                  {active.actionable ? `Step ${active.n} of ${total}` : 'Reference'}
                </span>
              </div>

              <button
                type="button"
                onClick={forward}
                disabled={atEnd && (isDone || !active.actionable)}
                className="btn btn-sm btn-primary"
              >
                {active.actionable && !isDone && <Check size={13} weight="bold" />}
                {forwardLabel}
                {!atEnd && <ArrowRight size={13} weight="bold" />}
              </button>
            </div>
          </div>
        )}

        {/* ── Stage ────────────────────────────────────────────────────── */}
        <main className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
          {mode === 'launch' ? (
            <OnboardLaunch
              ctx={ctx}
              run={run}
              onExit={() => {
                const next = nodes[active.index + 1];
                if (next) goTo(next.step.id);
                else setMode('steps');
              }}
            />
          ) : (
            <OnboardStage
              // Remounts on every step change, which is what resets the completed overlay's
              // "View this step" reveal — a step you already finished reads as finished every
              // time you land on it.
              key={active.step.id}
              node={active}
              done={isDone}
              total={total}
              onToggle={() => onToggleStep(active.step.id, !isDone)}
              onNext={() => move(1)}
              onLaunch={() => setMode('launch')}
              hasNext={hasNext}
            />
          )}
        </main>
      </div>

      <ReferencePanel ctx={ctx} />
    </RunbookProvider>
  );
}
