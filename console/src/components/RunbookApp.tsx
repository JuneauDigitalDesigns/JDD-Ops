'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowsClockwise, Warning, X } from '@phosphor-icons/react';
import { STATUS_ORDER } from '@/lib/types';
import type { ClientContext, OpsConfig } from '@/lib/types';
import { useRunbookState } from '@/lib/useRunbookState';
import ClientGrid from './ClientGrid';
import ClientBoard from './ClientBoard';
import RunbookShell from './RunbookShell';
import NavSlot from './NavSlot';

export default function RunbookApp() {
  const [clients, setClients] = useState<ClientContext[]>([]);
  const [config, setConfig] = useState<OpsConfig>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // Board (the Kanban pipeline) is the default landing view; a stored preference still wins.
  const [view, setView] = useState<'list' | 'board'>('board');
  /**
   * Five columns need width. Below ~900px they'd be unusable, so the list renders instead.
   * A viewport breakpoint is legitimate HERE, unlike the step diagrams: the roster has no rail,
   * so viewport width and available width agree.
   */
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const check = () => setNarrow(window.innerWidth < 900);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  /** Whether we've ever successfully loaded clients — decides fatal error vs. soft warning. */
  const hasData = useRef(false);

  const { state, setStatus, toggleStep, place } = useRunbookState();

  // A refresh failure must NOT destroy the view. Refreshes happen after a provisioning run, and
  // replacing the whole page with an error panel used to wipe the run's tracker/log/outcome —
  // hiding the actual failure. So: hard error only when we have nothing to show; otherwise keep
  // the last-known clients and surface a dismissible banner.
  const load = useCallback(async (keep = true): Promise<ClientContext[] | null> => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/runbook/clients', { cache: 'no-store' });
      const data = (await res.json()) as { clients?: ClientContext[]; config?: OpsConfig; error?: string };
      const list = data.clients ?? [];
      setClients(list);
      hasData.current = list.length > 0;
      setConfig(data.config ?? {});
      if (data.error) {
        // The route answered but couldn't read clients/ — real, but non-destructive if we have data.
        if (list.length === 0) setError(data.error);
        else setWarning(data.error);
      } else {
        setError(null);
        setWarning(null);
      }
      // On initial load don't auto-select — show the grid. On refresh, keep current selection.
      if (!keep) setSelected(null);
      return list;
    } catch {
      // fetch threw / non-JSON body → the dev server isn't answering. Keep whatever we have.
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
    load(false);
    try {
      const v = localStorage.getItem('onboard:view');
      if (v === 'board' || v === 'list') setView(v);
    } catch { /* ignore */ }
  }, [load]);

  const changeView = useCallback((v: 'list' | 'board') => {
    setView(v);
    try { localStorage.setItem('onboard:view', v); } catch { /* ignore */ }
  }, []);

  // Close the loop: after a clean REAL run, refetch and advance manual status to the (newly
  // higher) detected floor + check the "Launch onboard.js" step — no manual bookkeeping.
  const handleRunComplete = useCallback(
    async (slug: string, result: { ok: boolean; dryRun: boolean }) => {
      const list = await load(true);
      if (!result.ok || result.dryRun || !list) return;
      const c = list.find((x) => x.slug === slug);
      if (!c) return;
      const eff = state[slug]?.status ?? c.detectedStatus;
      if (STATUS_ORDER.indexOf(eff) < STATUS_ORDER.indexOf(c.detectedStatus)) {
        setStatus(slug, c.detectedStatus);
      }
      toggleStep(slug, 'run-onboard', true);
    },
    [load, state, setStatus, toggleStep],
  );

  const ctx = clients.find((c) => c.slug === selected) ?? null;

  const showRunbook = !!selected && !!ctx;

  return (
    <div className="relative z-10 flex h-full flex-col">
      {/* ── Header, rendered up into the global ConsoleNav (one bar, not two). ──────── */}
      <NavSlot>
        <span className="font-display text-lg font-semibold tracking-tightish text-fg">
          Onboarding Runbook
        </span>
        <span className="kicker hidden md:inline">Juneau Digital Designs · internal</span>
        <div className="ml-auto flex items-center gap-2">
          {!showRunbook && (
            <div className="flex items-center rounded-md border border-rule p-0.5" role="group" aria-label="View">
              {(['list', 'board'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => changeView(v)}
                  aria-pressed={view === v}
                  className="rounded px-2.5 py-0.5 text-xs font-medium capitalize transition-colors"
                  style={view === v ? { background: 'var(--surface-2)', color: 'var(--fg)' } : { color: 'var(--fg-3)' }}
                >
                  {v}
                </button>
              ))}
            </div>
          )}
          <button type="button" onClick={() => load(true)} className="btn btn-sm" disabled={refreshing}>
            <ArrowsClockwise size={13} className={refreshing ? 'animate-spin' : undefined} /> Refresh
          </button>
        </div>
      </NavSlot>

      {/* Soft banner: a refresh failed but we still have data. Never replaces the view (a
          provisioning run's tracker/log/outcome must survive a failed post-run refetch). */}
      {warning && !error && (
        <div
          className="flex shrink-0 items-center gap-2 border-b px-6 py-2"
          style={{ borderColor: 'var(--warn)', background: 'var(--warn-glow)' }}
        >
          <Warning size={14} weight="fill" style={{ color: 'var(--warn)', flexShrink: 0 }} />
          <span className="text-xs text-fg2">{warning} Showing the last-known client data.</span>
          <button type="button" onClick={() => load(true)} className="btn btn-xs ml-auto" disabled={refreshing}>
            <ArrowsClockwise size={12} className={refreshing ? 'animate-spin' : undefined} /> Retry
          </button>
          <button type="button" onClick={() => setWarning(null)} aria-label="Dismiss" className="rounded p-1 text-fg3 hover:text-fg">
            <X size={13} />
          </button>
        </div>
      )}

      {/* ── Body ───────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="kicker text-fg3">Reading clients/ …</p>
        </div>
      ) : error ? (
        <div className="flex flex-1 items-start justify-start px-6 py-10 md:px-10">
          <div className="panel p-6 max-w-md">
            <h3 className="mb-1 font-display text-base font-medium" style={{ color: 'var(--danger)' }}>
              Couldn't load clients
            </h3>
            <p className="text-xs text-fg2">{error}</p>
            <p className="mt-2 text-2xs text-fg3">
              The console runs from <code className="codechip">jdd-ops/console</code> and reads
              <code className="codechip">../clients</code>. Start it with{' '}
              <code className="codechip">npm run console</code> from the jdd-ops root.
            </p>
            <button type="button" onClick={() => load(true)} className="btn btn-sm mt-3" disabled={refreshing}>
              <ArrowsClockwise size={13} className={refreshing ? 'animate-spin' : undefined} /> Try again
            </button>
          </div>
        </div>
      ) : showRunbook ? (
        /* ── Runbook view — rail + stage. Keyed by slug so the step cursor resets per
           client but survives the post-run refetch, which does not remount. ────────── */
        <RunbookShell
          key={ctx.slug}
          ctx={ctx}
          config={config}
          clientState={state[ctx.slug]}
          onSetStatus={(s) => setStatus(ctx.slug, s)}
          onToggleStep={(id, done) => toggleStep(ctx.slug, id, done)}
          onRunComplete={(result) => handleRunComplete(ctx.slug, result)}
          onBack={() => setSelected(null)}
        />
      ) : (
        /* ── Client list / board ───────────────────────────────────────── */
        <div className="no-scrollbar flex-1 overflow-y-auto">
          {view === 'board' && !narrow ? (
            <ClientBoard
              clients={clients}
              state={state}
              config={config}
              onSelect={setSelected}
              onPlace={place}
            />
          ) : (
            <ClientGrid clients={clients} state={state} config={config} onSelect={setSelected} />
          )}
        </div>
      )}
    </div>
  );
}
