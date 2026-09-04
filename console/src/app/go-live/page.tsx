'use client';

import { useCallback, useMemo, useState } from 'react';
import { buildGoLive } from '@/lib/go-live-content';
import { firstIncomplete, flatten, nextActionable, progressOf } from '@/lib/runbook-nav';
import { useRunbookState } from '@/lib/useRunbookState';
import StepStage from '@/components/StepStage';

// The production go-live wizard: one linear walk through every step of taking JDD live,
// running the guarded actions in-app. Reuses the runbook's StepStage + block DSL; progress is
// persisted under the `_go-live` slug (same store as /setup's `_one-time-setup`), so you can
// leave and come back where you left off. No rail — this is a single ordered sequence, not a
// per-client tree.
const GO_LIVE_SLUG = '_go-live';

export const dynamic = 'force-dynamic';

export default function GoLivePage() {
  const { state, toggleStep } = useRunbookState();

  const phases = useMemo(() => buildGoLive(), []);
  const nodes = useMemo(() => flatten(phases), [phases]);
  const done = useMemo(
    () =>
      new Set(
        Object.entries(state[GO_LIVE_SLUG]?.steps ?? {})
          .filter(([, v]) => v)
          .map(([k]) => k),
      ),
    [state],
  );

  const [cursor, setCursor] = useState<string | null>(null);
  const fallback = firstIncomplete(nodes, done) ?? nodes[0];
  const active = nodes.find((x) => x.step.id === cursor) ?? fallback;
  const { total, completed, pct } = progressOf(nodes, done);

  const goTo = useCallback((id: string) => setCursor(id), []);

  const stepBy = useCallback(
    (delta: number) => {
      if (!active) return;
      const next = nodes[active.index + delta];
      if (next) goTo(next.step.id);
    },
    [active, nodes, goTo],
  );

  const complete = useCallback(() => {
    if (!active) return;
    toggleStep(GO_LIVE_SLUG, active.step.id, true);
    const next = nextActionable(nodes, active.index, done);
    if (next) goTo(next.step.id);
  }, [active, nodes, done, toggleStep, goTo]);

  if (!active) return null;

  return (
    <div className="no-scrollbar flex h-full min-h-0 flex-col overflow-hidden">
      {/* ── Top progress bar ──────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-rule px-8 py-3 lg:px-10">
        <div className="mx-auto flex w-full max-w-[1180px] items-center gap-4">
          <div className="flex flex-col">
            <span className="kicker">Production</span>
            <span className="font-display text-sm font-semibold tracking-tightish text-fg">Go live</span>
          </div>
          <div className="ml-auto flex min-w-0 flex-1 items-center gap-3">
            <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--surface-2)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, background: 'var(--accent)' }}
              />
            </div>
            <span className="meta shrink-0" style={{ color: 'var(--fg-3)' }}>
              {completed}/{total} done
            </span>
          </div>
        </div>
      </div>

      {/* ── Stage ─────────────────────────────────────────────────────────── */}
      <main className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
        <StepStage
          node={active}
          done={done.has(active.step.id)}
          total={total}
          onToggle={() => toggleStep(GO_LIVE_SLUG, active.step.id, !done.has(active.step.id))}
          onBack={() => stepBy(-1)}
          onNext={() => stepBy(1)}
          onComplete={complete}
          onLaunch={() => {}}
          hasBack={active.index > 0}
          hasNext={active.index < nodes.length - 1}
        />
      </main>
    </div>
  );
}
