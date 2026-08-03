'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ArchiveStep, ArchiveStatus } from './archive';

/**
 * Consumes the NDJSON stream from POST /api/manage/teardown.
 *
 * Same line-buffered reader loop as useOnboardRun, with one addition: `step` events, since
 * teardown's progress is a per-resource checklist rather than a linear phase list — the UI
 * wants to show "GitHub repo: deleted, Vercel project: failed" as they land, not just a log.
 *
 * Keeps the beforeunload guard from useOnboardRun. It matters more here than there: an
 * onboard run left half-finished is annoying; a teardown left half-finished is exactly the
 * case the "skip the local-folder delete on any failure" rule exists to make survivable,
 * but you'd still rather not walk away mid-run without knowing.
 */

export interface TeardownRunState {
  lines: string[];
  steps: ArchiveStep[];
  archiveId: string | null;
  status: ArchiveStatus | null;
  exitCode: number | null;
  error: string | null;
}

const EMPTY: TeardownRunState = { lines: [], steps: [], archiveId: null, status: null, exitCode: null, error: null };

export function useTeardownRun(onComplete: (state: TeardownRunState) => void) {
  const [state, setState] = useState<TeardownRunState>(EMPTY);
  const [running, setRunning] = useState(false);
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;

  useEffect(() => {
    if (!running) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [running]);

  const start = useCallback(
    async (body: { slug: string; previewHash: string; confirmSlug: string; domainConfirm?: string; reason?: string; resumeId?: string }) => {
      setState(EMPTY);
      setRunning(true);
      let acc: TeardownRunState = EMPTY;

      try {
        const res = await fetch('/api/manage/teardown', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!res.ok || !res.body) {
          const errBody = (await res.json().catch(() => ({}))) as { error?: string };
          acc = { ...acc, error: errBody.error ?? `Request failed (${res.status}).` };
          setState(acc);
          return acc;
        }

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
            let ev: {
              type: string;
              line?: string;
              step?: ArchiveStep;
              message?: string;
              archiveId?: string;
              status?: ArchiveStatus;
              code?: number;
            };
            try {
              ev = JSON.parse(part);
            } catch {
              continue;
            }
            if (ev.type === 'start') {
              acc = { ...acc, archiveId: ev.archiveId ?? null };
            } else if (ev.type === 'log' && ev.line != null) {
              acc = { ...acc, lines: [...acc.lines, ev.line] };
            } else if (ev.type === 'step' && ev.step) {
              acc = { ...acc, steps: [...acc.steps, ev.step] };
            } else if (ev.type === 'error') {
              acc = { ...acc, error: ev.message ?? 'Teardown failed.' };
            } else if (ev.type === 'exit') {
              acc = { ...acc, exitCode: ev.code ?? 1, archiveId: ev.archiveId ?? acc.archiveId, status: ev.status ?? acc.status };
            }
            setState(acc);
          }
        }
      } catch (err) {
        acc = { ...acc, error: err instanceof Error ? err.message : 'Connection lost mid-run.' };
        setState(acc);
      } finally {
        setRunning(false);
        completeRef.current(acc);
      }
      return acc;
    },
    [],
  );

  return { state, running, start };
}
