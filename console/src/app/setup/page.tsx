'use client';
import { useEffect, useMemo, useState } from 'react';
import type { OpsConfig } from '@/lib/types';
import { buildPartA } from '@/lib/runbook-content';
import { useRunbookState } from '@/lib/useRunbookState';
import StepGuide from '@/components/StepGuide';

// The master "Part A" one-time setup checklist, as a standalone page. Previously this lived
// in a slide-in drawer (PartASheet) opened from the Runbook header. It is intentionally NOT
// linked from any nav — reachable only by typing /setup. Progress is keyed by the same
// `_one-time-setup` slug as before, so existing completion state carries over and stays in
// sync with anywhere else that reads it.
const PART_A_SLUG = '_one-time-setup';

export const dynamic = 'force-dynamic';

export default function SetupPage() {
  const [config, setConfig] = useState<OpsConfig>({});
  const { state, toggleStep } = useRunbookState();

  useEffect(() => {
    let alive = true;
    fetch('/api/runbook/clients', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { config?: OpsConfig }) => {
        if (alive) setConfig(d.config ?? {});
      })
      .catch(() => {
        /* fall back to an empty config — the checklist is still fully rendered */
      });
    return () => {
      alive = false;
    };
  }, []);

  const phases = useMemo(() => buildPartA(config), [config]);
  const done = useMemo(
    () =>
      new Set(
        Object.entries(state[PART_A_SLUG]?.steps ?? {})
          .filter(([, v]) => v)
          .map(([k]) => k),
      ),
    [state],
  );

  return (
    <div className="no-scrollbar h-full overflow-y-auto">
      <div className="mx-auto max-w-[720px] px-6 py-10 md:px-8">
        <div className="mb-6 flex flex-col gap-1">
          <span className="kicker">One-time · Part A</span>
          <h1 className="font-display text-[30px] font-semibold tracking-tightest">Master setup</h1>
          <p className="text-[12.5px] text-fg3">Do these once, before your first paid client.</p>
        </div>
        <StepGuide
          phases={phases}
          done={done}
          onToggle={(id) => toggleStep(PART_A_SLUG, id, !done.has(id))}
        />
      </div>
    </div>
  );
}
