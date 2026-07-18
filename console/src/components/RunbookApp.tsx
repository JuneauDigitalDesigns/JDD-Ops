'use client';
import { useCallback, useEffect, useState } from 'react';
import { ArrowsClockwise, Compass, ArrowLeft } from '@phosphor-icons/react';
import type { ClientContext, OpsConfig } from '@/lib/types';
import { useRunbookState } from '@/lib/useRunbookState';
import ClientGrid from './ClientGrid';
import ClientPanel from './ClientPanel';

export default function RunbookApp() {
  const [clients, setClients] = useState<ClientContext[]>([]);
  const [config, setConfig] = useState<OpsConfig>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const { state, setStatus, toggleStep } = useRunbookState();

  const load = useCallback(async (keep = true) => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/runbook/clients', { cache: 'no-store' });
      const data = (await res.json()) as { clients?: ClientContext[]; config?: OpsConfig; error?: string };
      setError(data.error ?? null);
      const list = data.clients ?? [];
      setClients(list);
      setConfig(data.config ?? {});
      // On initial load don't auto-select — show the grid. On refresh, keep current selection.
      if (!keep) setSelected(null);
    } catch {
      setError('Failed to reach the runbook API.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  const ctx = clients.find((c) => c.slug === selected) ?? null;

  const showRunbook = !!selected && !!ctx;

  return (
    <div className="relative z-10 flex h-full flex-col">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between gap-4 border-b border-rule px-7 py-4">
        <div className="flex items-baseline gap-3">
          <div className="flex items-center gap-2.5">
            <Compass size={20} weight="fill" style={{ color: 'var(--accent)' }} />
            <span className="font-display text-[18px] font-semibold tracking-tightish">Onboarding Runbook</span>
          </div>
          <span className="kicker hidden sm:inline">Juneau Digital Designs · internal</span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => load(true)} className="btn btn-sm" disabled={refreshing}>
            <ArrowsClockwise size={13} className={refreshing ? 'animate-spin' : undefined} /> Refresh
          </button>
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="kicker text-fg3">Reading clients/ …</p>
        </div>
      ) : error ? (
        <div className="flex flex-1 items-start justify-start px-6 py-10 md:px-10">
          <div className="panel p-6 max-w-md">
            <h3 className="mb-1 font-display text-[16px] font-medium" style={{ color: 'var(--danger)' }}>
              Couldn't load clients
            </h3>
            <p className="text-[13px] text-fg2">{error}</p>
            <p className="mt-2 text-[12px] text-fg3">Run this app from jdd-ops/runbook so it can see ../clients.</p>
          </div>
        </div>
      ) : showRunbook ? (
        /* ── Runbook view ──────────────────────────────────────────────── */
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Back nav strip */}
          <div className="flex items-center gap-3 border-b border-rule px-6 py-3">
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="btn btn-sm flex items-center gap-1.5"
            >
              <ArrowLeft size={13} /> All clients
            </button>
            <span className="text-[12.5px] text-fg3">{ctx.brandName}</span>
          </div>
          <main className="no-scrollbar flex-1 overflow-y-auto px-6 py-8 md:px-10">
            <ClientPanel
              ctx={ctx}
              config={config}
              clientState={state[ctx.slug]}
              onSetStatus={(s) => setStatus(ctx.slug, s)}
              onToggleStep={(id, done) => toggleStep(ctx.slug, id, done)}
              onRefresh={() => load(true)}
            />
          </main>
        </div>
      ) : (
        /* ── Client grid ───────────────────────────────────────────────── */
        <div className="no-scrollbar flex-1 overflow-y-auto">
          <ClientGrid
            clients={clients}
            state={state}
            config={config}
            onSelect={setSelected}
          />
        </div>
      )}
    </div>
  );
}
