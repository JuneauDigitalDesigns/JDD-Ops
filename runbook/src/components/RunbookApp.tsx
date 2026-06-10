'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowsClockwise, Wrench, Compass } from '@phosphor-icons/react';
import type { ClientContext, OpsConfig } from '@/lib/types';
import { buildPartA } from '@/lib/runbook-content';
import { useRunbookState } from '@/lib/useRunbookState';
import ClientList from './ClientList';
import ClientPanel from './ClientPanel';
import PartASheet from './PartASheet';

const PART_A_SLUG = '_one-time-setup';

export default function RunbookApp() {
  const [clients, setClients] = useState<ClientContext[]>([]);
  const [config, setConfig] = useState<OpsConfig>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [partAOpen, setPartAOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { state, setStatus, toggleStep } = useRunbookState();

  const load = useCallback(async (keep = true) => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/clients', { cache: 'no-store' });
      const data = (await res.json()) as { clients?: ClientContext[]; config?: OpsConfig; error?: string };
      setError(data.error ?? null);
      const list = data.clients ?? [];
      setClients(list);
      setConfig(data.config ?? {});
      setSelected((prev) => (keep && prev ? prev : list[0]?.slug ?? prev ?? null));
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

  const partAPhases = useMemo(() => buildPartA(config), [config]);

  const partADone = useMemo(
    () =>
      new Set(
        Object.entries(state[PART_A_SLUG]?.steps ?? {})
          .filter(([, v]) => v)
          .map(([k]) => k),
      ),
    [state],
  );

  return (
    <div className="relative z-10 flex h-screen flex-col">
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
          <button type="button" onClick={() => setPartAOpen(true)} className="btn btn-sm">
            <Wrench size={13} /> One-time setup
          </button>
          <button type="button" onClick={() => load(true)} className="btn btn-sm" disabled={refreshing}>
            <ArrowsClockwise size={13} className={refreshing ? 'animate-spin' : undefined} /> Refresh
          </button>
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[300px_1fr]">
        {/* Left rail */}
        <aside className="hidden min-h-0 flex-col border-r border-rule px-4 py-5 md:flex">
          <div className="mb-3 flex items-center justify-between">
            <span className="kicker">Clients</span>
            <span className="kicker text-fg3">{clients.length}</span>
          </div>
          <div className="min-h-0 flex-1">
            <ClientList
              clients={clients}
              state={state}
              selectedSlug={selected}
              onSelect={setSelected}
              query={query}
              setQuery={setQuery}
            />
          </div>
        </aside>

        {/* Main */}
        <main className="no-scrollbar min-h-0 overflow-y-auto px-6 py-7 md:px-10">
          <div className="mx-auto max-w-[760px]">
            {loading ? (
              <p className="kicker pt-10 text-center">Reading clients/ …</p>
            ) : error ? (
              <div className="panel p-6">
                <h3 className="mb-1 font-display text-[16px] font-medium" style={{ color: 'var(--danger)' }}>
                  Couldn’t load clients
                </h3>
                <p className="text-[13px] text-fg2">{error}</p>
                <p className="mt-2 text-[12px] text-fg3">Run this app from jdd-ops/runbook so it can see ../clients.</p>
              </div>
            ) : ctx ? (
              <ClientPanel
                ctx={ctx}
                config={config}
                clientState={state[ctx.slug]}
                onSetStatus={(s) => setStatus(ctx.slug, s)}
                onToggleStep={(id, done) => toggleStep(ctx.slug, id, done)}
                onRefresh={() => load(true)}
              />
            ) : (
              <div className="panel p-8 text-center">
                <Compass size={26} weight="fill" style={{ color: 'var(--accent)', margin: '0 auto 10px' }} />
                <h3 className="font-display text-[18px] font-medium">No client selected</h3>
                <p className="mt-1 text-[13px] text-fg3">
                  Pick a client on the left, or build one in the studio first.
                </p>
              </div>
            )}
          </div>
        </main>
      </div>

      <PartASheet
        open={partAOpen}
        onClose={() => setPartAOpen(false)}
        phases={partAPhases}
        done={partADone}
        onToggle={(id) => toggleStep(PART_A_SLUG, id, !partADone.has(id))}
      />
    </div>
  );
}
