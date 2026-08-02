'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowsClockwise } from '@phosphor-icons/react';
import { STATUS_ORDER } from '@/lib/types';
import type { ClientContext, OpsConfig } from '@/lib/types';
import { useRunbookState } from '@/lib/useRunbookState';
import RunbookShell from '@/components/RunbookShell';
import WarnBanner from '@/components/shell/WarnBanner';

/**
 * Hosts the runbook for ONE client — the client half of what RunbookApp used to be. The
 * cross-client roster it was fused to is now the root picker, which is the whole point:
 * the board answers "where is everything", this answers "what do I do next for this one".
 *
 * Still reads the full list from /api/runbook/clients and picks its slug out, rather than
 * a per-client endpoint. The list is a handful of folders and the route already assembles
 * exactly the ClientContext + OpsConfig pair RunbookShell wants; a second endpoint would be
 * a second thing to keep in step with it.
 */
export default function OnboardTool({ slug }: { slug: string }) {
  const [clients, setClients] = useState<ClientContext[]>([]);
  const [config, setConfig] = useState<OpsConfig>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  /** Whether we've ever successfully loaded — decides fatal error vs. soft warning. */
  const hasData = useRef(false);

  const { state, setStatus, toggleStep } = useRunbookState();

  // A refresh failure must NOT destroy the view. Refreshes happen right after a provisioning
  // run, and replacing the page with an error panel used to wipe the run's tracker/log/outcome
  // — hiding the actual failure. So: hard error only when we have nothing to show; otherwise
  // keep the last-known data and surface a dismissible banner.
  const load = useCallback(async (): Promise<ClientContext[] | null> => {
    setRefreshing(true);
    try {
      // ?fixtures=1 is REQUIRED, not cosmetic: this route hides `_`-prefixed fixtures by
      // default for the client index, and without it the runbook can't find a fixture client
      // it was opened on and reports "client not found" for a client that plainly exists.
      // Addressing one client by slug must never depend on another screen's display filter.
      const res = await fetch('/api/runbook/clients?fixtures=1', { cache: 'no-store' });
      const data = (await res.json()) as {
        clients?: ClientContext[];
        config?: OpsConfig;
        error?: string;
      };
      const list = data.clients ?? [];
      setClients(list);
      hasData.current = list.length > 0;
      setConfig(data.config ?? {});
      if (data.error) {
        if (list.length === 0) setError(data.error);
        else setWarning(data.error);
      } else {
        setError(null);
        setWarning(null);
      }
      return list;
    } catch {
      const msg = 'Couldn’t reach the console dev server (is it still running?).';
      if (hasData.current) setWarning(msg);
      else setError(msg);
      return null;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Close the loop: after a clean REAL run, refetch and advance manual status to the (newly
  // higher) detected floor + check the "Launch onboard.js" step — no manual bookkeeping.
  const handleRunComplete = useCallback(
    async (result: { ok: boolean; dryRun: boolean }) => {
      const list = await load();
      if (!result.ok || result.dryRun || !list) return;
      const c = list.find((x) => x.slug === slug);
      if (!c) return;
      const eff = state[slug]?.status ?? c.detectedStatus;
      if (STATUS_ORDER.indexOf(eff) < STATUS_ORDER.indexOf(c.detectedStatus)) {
        setStatus(slug, c.detectedStatus);
      }
      toggleStep(slug, 'run-onboard', true);
    },
    [load, slug, state, setStatus, toggleStep],
  );

  const ctx = clients.find((c) => c.slug === slug) ?? null;

  if (loading) {
    return (
      <div className="relative z-10 flex h-full items-center justify-center">
        <p className="meta text-fg3">Reading clients/ …</p>
      </div>
    );
  }

  if (error || !ctx) {
    return (
      <div className="relative z-10 flex h-full items-start justify-start px-6 py-10 md:px-10">
        <div className="panel max-w-md p-6">
          <h3
            className="mb-1 font-display text-base font-medium"
            style={{ color: 'var(--danger)' }}
          >
            {error ? "Couldn't load clients" : 'Client not found'}
          </h3>
          <p className="text-xs text-fg2">
            {error ?? `No client folder at clients/${slug} in the runbook listing.`}
          </p>
          <p className="mt-2 text-2xs text-fg3">
            The console runs from <code className="codechip">jdd-ops/console</code> and reads{' '}
            <code className="codechip">../clients</code>. Start it with{' '}
            <code className="codechip">npm run console</code> from the jdd-ops root.
          </p>
          <button type="button" onClick={load} className="btn btn-sm mt-3" disabled={refreshing}>
            <ArrowsClockwise size={13} className={refreshing ? 'animate-spin' : undefined} /> Try
            again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-10 flex h-full flex-col">
      {/* Soft banner: a refresh failed but we still have data. Never replaces the view. */}
      {warning && (
        <WarnBanner
          message={warning}
          onRetry={load}
          onDismiss={() => setWarning(null)}
          busy={refreshing}
        />
      )}

      {/* Keyed by slug so the step cursor resets per client but survives the post-run
          refetch, which does not remount. */}
      <RunbookShell
        key={ctx.slug}
        ctx={ctx}
        config={config}
        clientState={state[ctx.slug]}
        onSetStatus={(s) => setStatus(ctx.slug, s)}
        onToggleStep={(id, done) => toggleStep(ctx.slug, id, done)}
        onRunComplete={handleRunComplete}
      />
    </div>
  );
}
