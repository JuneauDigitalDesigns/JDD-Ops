'use client';
// The provisioning run, lifted out of LaunchPanel so it can outlive the component that
// started it. The stage swaps between steps and the launch screen while a run is streaming;
// if the run lived in the launch component, navigating away mid-run would abort the reader
// and orphan half-created (billable) resources with no log to show for it.
//
// Mount this ONCE, in RunbookShell. The stream logic below is the original LaunchPanel
// implementation moved unchanged — the only additions are the `running` guard exposed for
// the beforeunload/back-nav locks.

import { useCallback, useEffect, useRef, useState } from 'react';
import { initRunState, reduceRun, type RunState } from './onboard-parse';
import type { ClientContext } from './types';

export interface OnboardRun {
  run: RunState | null;
  running: boolean;
  dryRun: boolean;
  setDryRun: (v: boolean) => void;
  launch: () => Promise<void>;
  /** Clear the last run's result (e.g. when leaving the launch screen after a failure). */
  reset: () => void;
}

export function useOnboardRun(
  ctx: ClientContext,
  onComplete: (result: { ok: boolean; dryRun: boolean }) => void,
): OnboardRun {
  const [dryRun, setDryRun] = useState(true);
  const [running, setRunning] = useState(false);
  const [run, setRun] = useState<RunState | null>(null);

  // onComplete is re-created every render by the caller; hold it in a ref so `launch` stays
  // stable and a re-render mid-run can't swap the callback out from under the finally block.
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;

  // A run creates real resources. Warn on tab close / reload while one is in flight.
  useEffect(() => {
    if (!running) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [running]);

  const launch = useCallback(async () => {
    setRunning(true);
    let acc = initRunState();
    if (dryRun) acc = reduceRun(acc, '=== DRY RUN MODE ===');
    setRun(acc);

    let exit: number | null = null;
    try {
      const res = await fetch('/api/runbook/onboard', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: ctx.slug, dryRun }),
      });
      if (!res.body) throw new Error('No response stream.');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split('\n');
        buf = parts.pop() ?? '';
        for (const part of parts) {
          if (!part.trim()) continue;
          let ev: { type: string; line?: string; message?: string; command?: string; code?: number };
          try { ev = JSON.parse(part); } catch { continue; }
          if (ev.type === 'start') acc = reduceRun(acc, `$ ${ev.command}`);
          else if (ev.type === 'log' && ev.line != null) acc = reduceRun(acc, ev.line);
          else if (ev.type === 'error') acc = { ...reduceRun(acc, ev.message ?? 'Error'), failed: acc.failed ?? { label: 'onboard.js', message: ev.message ?? 'Error' } };
          else if (ev.type === 'exit') exit = ev.code ?? 1;
        }
        setRun(acc);
      }
    } catch (err) {
      // A bare "Failed to fetch" is the browser's way of saying the dev server didn't answer —
      // say so, since it's indistinguishable from an onboard.js failure in the raw text.
      const raw = err instanceof Error ? err.message : 'Run failed.';
      const network = err instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(raw);
      const message = network
        ? 'Couldn’t reach the console dev server, so onboard.js was never started. Check that the dev server is still running, then try again.'
        : raw;
      acc = { ...reduceRun(acc, message), failed: acc.failed ?? { label: network ? 'Dev server' : 'Run', message } };
      exit = 1;
    } finally {
      setRun(acc);
      setRunning(false);
      const ok = acc.onboarded && !acc.failed && (exit === 0 || exit === null);
      completeRef.current({ ok, dryRun });
    }
  }, [ctx.slug, dryRun]);

  const reset = useCallback(() => setRun(null), []);

  return { run, running, dryRun, setDryRun, launch, reset };
}
