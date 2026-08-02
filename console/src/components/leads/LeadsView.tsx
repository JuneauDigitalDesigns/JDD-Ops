'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowsClockwise } from '@phosphor-icons/react';
import type { DemoCall, LeadStage, QueuedLead } from '@/lib/leadTypes';
import PageHeader from '@/components/shell/PageHeader';
import RefreshButton from '@/components/shell/RefreshButton';
import WarnBanner from '@/components/shell/WarnBanner';
import CallsTab from './CallsTab';
import LeadBoard from './LeadBoard';
import LeadModal from './LeadModal';

/**
 * The leads screen: the funnel, and the raw call feed behind it.
 *
 * Error discipline is copied deliberately from ClientIndex/PipelineView, because it is the
 * console's house rule and it matters most here: a failed refresh must NEVER replace the
 * view. You keep the last-known leads and get a dismissible banner. A hard error only when
 * there is genuinely nothing to show.
 */

type Tab = 'board' | 'calls';

export default function LeadsView() {
  const [leads, setLeads] = useState<QueuedLead[]>([]);
  const [calls, setCalls] = useState<DemoCall[]>([]);
  const [siteUrl, setSiteUrl] = useState('https://juneaudigitaldesigns.com');
  const [tab, setTab] = useState<Tab>('board');
  const [openId, setOpenId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  /**
   * Five columns need width — below ~900px they're unusable. A viewport breakpoint is
   * legitimate here: the board has no rail, so viewport width and available width agree.
   */
  const [narrow, setNarrow] = useState(false);
  const hasData = useRef(false);

  useEffect(() => {
    const check = () => setNarrow(window.innerWidth < 900);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [leadRes, callRes] = await Promise.all([
        fetch('/api/leads', { cache: 'no-store' }),
        fetch('/api/leads/calls', { cache: 'no-store' }),
      ]);
      const data = (await leadRes.json()) as {
        leads?: QueuedLead[];
        siteUrl?: string;
        error?: string;
      };
      const callData = (await callRes.json().catch(() => ({}))) as { calls?: DemoCall[] };

      const list = data.leads ?? [];
      setLeads(list);
      setCalls(callData.calls ?? []);
      if (data.siteUrl) setSiteUrl(data.siteUrl);
      hasData.current = list.length > 0;

      if (data.error) {
        if (list.length === 0) setError(data.error);
        else setWarning(data.error);
      } else {
        setError(null);
        setWarning(null);
      }
    } catch {
      const msg = 'Couldn’t reach the console dev server (is it still running?).';
      if (hasData.current) setWarning(msg);
      else setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Commit a change to one lead, optimistically.
   *
   * The board must not wait on a round-trip — a card that snaps back for 200ms after every
   * drop feels broken. So state moves first and the request reconciles; a failure surfaces
   * as the warn banner and the next refresh puts things back.
   */
  const patch = useCallback(
    async (id: string, next: { stage?: LeadStage; order?: number; notes?: string; lostReason?: string }) => {
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...next } : l)));
      try {
        const res = await fetch('/api/leads', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, ...next }),
        });
        if (!res.ok) {
          setWarning('That change didn’t save.');
          return;
        }
        const data = (await res.json()) as { lead?: QueuedLead };
        // Take the server's copy — it owns updatedAt and the activity trail.
        if (data.lead) setLeads((prev) => prev.map((l) => (l.id === id ? data.lead! : l)));
      } catch {
        setWarning('That change didn’t save.');
      }
    },
    [],
  );

  const openLead = leads.find((l) => l.id === openId) ?? null;
  const openCall = openLead?.callId ? calls.find((c) => c.callId === openLead.callId) ?? null : null;

  const tabButton = (id: Tab, label: string, count: number) => (
    <button
      key={id}
      type="button"
      onClick={() => setTab(id)}
      className="rounded-[7px] border px-3 py-1 text-xs transition-colors"
      style={{
        borderColor: tab === id ? 'var(--accent)' : 'var(--rule)',
        background: tab === id ? 'var(--accent-glow)' : 'transparent',
        color: tab === id ? 'var(--accent)' : 'var(--fg-2)',
      }}
    >
      {label} <span className="text-fg3">{count}</span>
    </button>
  );

  return (
    <div className="relative z-10 flex h-full flex-col">
      <RefreshButton onClick={load} busy={refreshing} />

      {warning && !error && (
        <WarnBanner
          message={warning}
          onRetry={load}
          onDismiss={() => setWarning(null)}
          busy={refreshing}
        />
      )}

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="meta text-fg3">Reading the lead queue …</p>
        </div>
      ) : error ? (
        <div className="flex flex-1 items-start justify-start px-6 py-10 md:px-10">
          <div className="panel max-w-md p-6">
            <h3
              className="mb-1 font-display text-base font-medium"
              style={{ color: 'var(--danger)' }}
            >
              Couldn&apos;t load leads
            </h3>
            <p className="text-xs text-fg2">{error}</p>
            <button type="button" onClick={load} className="btn btn-sm mt-3" disabled={refreshing}>
              <ArrowsClockwise size={13} className={refreshing ? 'animate-spin' : undefined} /> Try
              again
            </button>
          </div>
        </div>
      ) : (
        <div className="no-scrollbar flex-1 overflow-y-auto">
          <div className="w-full px-6 py-6 md:px-8">
            <PageHeader
              title="Leads"
              lede="Interest from the site · drag a card to advance it."
            />

            <div className="mb-5 flex items-center gap-2">
              {tabButton('board', 'Board', leads.length)}
              {tabButton('calls', 'Calls', calls.length)}
            </div>

            {tab === 'board' ? (
              narrow ? (
                /* Five columns crushed into a phone is worse than no board. The calls list
                   reads fine at any width, so offer that instead of degrading. */
                <div className="flex items-center justify-center py-16">
                  <div className="panel max-w-sm p-6 text-center">
                    <h3 className="mb-1 font-display text-base font-medium text-fg">
                      Not enough room
                    </h3>
                    <p className="text-xs text-fg2">
                      The funnel needs five columns side by side. Widen the window, or read the
                      Calls tab — it works at this size.
                    </p>
                    <Link href="/" className="btn btn-sm mt-3">
                      <ArrowLeft size={13} /> All clients
                    </Link>
                  </div>
                </div>
              ) : leads.length === 0 ? (
                <p className="py-16 text-center text-xs text-fg3">
                  No leads yet. They arrive from the site&apos;s interest form and from calls to
                  the demo agent.
                </p>
              ) : (
                <LeadBoard leads={leads} onOpen={setOpenId} onPlace={patch} />
              )
            ) : (
              <CallsTab calls={calls} onOpenLead={setOpenId} />
            )}
          </div>
        </div>
      )}

      {openLead && (
        <LeadModal
          lead={openLead}
          call={openCall}
          siteUrl={siteUrl}
          onClose={() => setOpenId(null)}
          onPatch={(p) => patch(openLead.id, p)}
        />
      )}
    </div>
  );
}
