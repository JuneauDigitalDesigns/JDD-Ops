'use client';
import { useCallback, useEffect, useState } from 'react';
import type { ClientStatus, RunbookState } from './types';

// App-level durable state: loads the whole progress map once, mutates one client at a time
// with optimistic updates, and persists via PATCH /api/state. Replaces the old localStorage
// useProgress hook so status + step completion survive browser clears / machine switches.
export function useRunbookState() {
  const [state, setState] = useState<RunbookState>({});
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    try {
      const res = await fetch('/api/runbook/state', { cache: 'no-store' });
      const data = (await res.json()) as { state?: RunbookState };
      setState(data.state ?? {});
    } catch {
      /* leave whatever we have */
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const patch = useCallback(
    async (slug: string, body: { status?: ClientStatus; step?: { id: string; done: boolean } }) => {
      // Optimistic local update.
      setState((prev) => {
        const cur = prev[slug] ?? { steps: {} };
        const steps = { ...cur.steps };
        if (body.step) {
          if (body.step.done) steps[body.step.id] = true;
          else delete steps[body.step.id];
        }
        return { ...prev, [slug]: { ...cur, status: body.status ?? cur.status, steps } };
      });
      try {
        await fetch('/api/runbook/state', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ slug, ...body }),
        });
      } catch {
        /* keep the optimistic value; a later reload reconciles */
      }
    },
    [],
  );

  const setStatus = useCallback((slug: string, status: ClientStatus) => patch(slug, { status }), [patch]);
  const toggleStep = useCallback(
    (slug: string, id: string, done: boolean) => patch(slug, { step: { id, done } }),
    [patch],
  );

  return { state, loaded, setStatus, toggleStep, reload };
}
