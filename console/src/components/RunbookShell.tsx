'use client';
// One client's runbook: rail on the left, stage on the right.
//
// This owns the three pieces of state the walk needs and nothing else:
//   • activeId — which step is on stage. One cursor, replacing StepGuide's two overlapping
//     open/expanded states.
//   • mode — 'steps' or 'launch'. The launch screen replaces the STAGE only; the rail stays
//     put so you never lose your place mid-provision.
//   • the run itself, via useOnboardRun. It lives here rather than inside the launch screen
//     so switching steps or modes mid-run doesn't abort the stream.
//
// Mounted with key={ctx.slug} by RunbookApp, so the cursor resets per client but survives the
// client-list refetch that happens after every run.

import { useCallback, useMemo, useState } from 'react';
import { buildRunbook } from '@/lib/runbook-content';
import { firstIncomplete, flatten, nextActionable, progressOf } from '@/lib/runbook-nav';
import { useOnboardRun } from '@/lib/useOnboardRun';
import type { ClientContext, ClientState, ClientStatus, OpsConfig } from '@/lib/types';
import { RunbookProvider } from './RunbookContext';
import StepRail from './StepRail';
import StepStage from './StepStage';
import LaunchStage from './LaunchStage';

export default function RunbookShell({
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

  // Uncontrolled until the operator picks something: default to the first unfinished step so
  // reopening a client drops you where you left off.
  const fallback = firstIncomplete(nodes, done) ?? nodes[nodes.length - 1];
  const active = nodes.find((x) => x.step.id === cursor) ?? fallback;

  const { total, completed, pct } = progressOf(nodes, done);
  const effectiveStatus = clientState?.status ?? ctx.detectedStatus;

  const goTo = useCallback((id: string) => {
    setCursor(id);
    setMode('steps');
  }, []);

  const select = useCallback((id: string) => {
    const node = nodes.find((x) => x.step.id === id);
    // Clicking the provisioning step in the rail goes straight to the launch screen — that
    // step IS the run, and routing through a stage that only says "click here" is a detour.
    if (node?.step.launch) { setCursor(id); setMode('launch'); return; }
    goTo(id);
  }, [nodes, goTo]);

  const complete = useCallback(() => {
    if (!active) return;
    onToggleStep(active.step.id, true);
    const next = nextActionable(nodes, active.index, done);
    if (next) goTo(next.step.id);
  }, [active, nodes, done, onToggleStep, goTo]);

  const step = useCallback((delta: number) => {
    if (!active) return;
    const next = nodes[active.index + delta];
    if (next) goTo(next.step.id);
  }, [active, nodes, goTo]);

  if (!active) return null;

  return (
    <RunbookProvider value={{ ctx, config, run: run.run, running: run.running }}>
      <div className="flex min-h-0 flex-1">
        <StepRail
          ctx={ctx}
          nodes={nodes}
          done={done}
          activeId={mode === 'launch' ? '' : active.step.id}
          onSelect={select}
          pct={pct}
          completed={completed}
          total={total}
          effectiveStatus={effectiveStatus}
          onSetStatus={onSetStatus}
          launchActive={mode === 'launch'}
        />

        <main className="no-scrollbar min-w-0 flex-1 overflow-y-auto">
          {mode === 'launch' ? (
            <LaunchStage
              ctx={ctx}
              run={run}
              onExit={() => {
                // Leaving a clean run advances to the next thing to actually do.
                const next = nextActionable(nodes, active.index, done);
                if (next) goTo(next.step.id);
                else setMode('steps');
              }}
            />
          ) : (
            <StepStage
              node={active}
              done={done.has(active.step.id)}
              total={total}
              onToggle={() => onToggleStep(active.step.id, !done.has(active.step.id))}
              onBack={() => step(-1)}
              onNext={() => step(1)}
              onComplete={complete}
              onLaunch={() => setMode('launch')}
              hasBack={active.index > 0}
              hasNext={active.index < nodes.length - 1}
            />
          )}
        </main>
      </div>
    </RunbookProvider>
  );
}
