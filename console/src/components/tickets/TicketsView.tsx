'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowsClockwise } from '@phosphor-icons/react';
import type { Ticket, TicketStatus } from '@jdd/schema';
import { TICKETS_LAST_SEEN_KEY, needsAttention } from '@/lib/ticket-meta';
import PageHeader from '@/components/shell/PageHeader';
import RefreshButton from '@/components/shell/RefreshButton';
import WarnBanner from '@/components/shell/WarnBanner';
import TicketBoard from './TicketBoard';
import TicketModal from './TicketModal';

/**
 * The tickets screen: the operator's support queue as a Kanban board.
 *
 * Error discipline is copied from LeadsView, the console's house rule: a failed refresh must
 * NEVER replace the view. You keep the last-known tickets and get a dismissible banner. A hard
 * error only when there is genuinely nothing to show.
 */
export default function TicketsView() {
  const searchParams = useSearchParams();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  /** Five columns need width — below ~900px they're unusable, same as the lead board. */
  const [narrow, setNarrow] = useState(false);
  const hasData = useRef(false);

  const [lastSeenAt, setLastSeenAt] = useState<number | null>(null);
  const lastSeenRead = useRef(false);
  /** The briefing / email deep link opens one ticket; honoured once, after the first load. */
  const deepLinkOpened = useRef(false);

  useEffect(() => {
    const check = () => setNarrow(window.innerWidth < 900);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Read the stamp on mount, write a fresh one on the way out. The ref guard survives StrictMode.
  useEffect(() => {
    if (!lastSeenRead.current) {
      lastSeenRead.current = true;
      try {
        const raw = window.localStorage.getItem(TICKETS_LAST_SEEN_KEY);
        const parsed = raw ? Number(raw) : NaN;
        setLastSeenAt(Number.isFinite(parsed) ? parsed : null);
      } catch {
        setLastSeenAt(null);
      }
    }
    return () => {
      try {
        window.localStorage.setItem(TICKETS_LAST_SEEN_KEY, String(Date.now()));
      } catch {}
    };
  }, []);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/tickets', { cache: 'no-store' });
      const data = (await res.json()) as { tickets?: Ticket[]; error?: string };
      const list = data.tickets ?? [];
      setTickets(list);
      hasData.current = list.length > 0;

      if (data.error) {
        if (list.length === 0) setError(data.error);
        else setWarning(data.error);
      } else {
        setError(null);
        setWarning(null);
      }
    } catch {
      const msg = "Couldn't reach the console dev server (is it still running?).";
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

  // Honour ?open={id} once the first load has populated the board.
  useEffect(() => {
    if (deepLinkOpened.current || loading) return;
    const want = searchParams.get('open');
    if (want && tickets.some((t) => t.id === want)) {
      deepLinkOpened.current = true;
      setOpenId(want);
    }
  }, [loading, tickets, searchParams]);

  /**
   * Commit a change to one ticket, optimistically. The board must not wait on a round-trip.
   * State moves first and the request reconciles; a failure surfaces as the warn banner and the
   * next refresh puts things back.
   */
  const patch = useCallback(
    async (id: string, next: { status?: TicketStatus; order?: number; message?: string }) => {
      // Optimistic: reflect status/order immediately. A reply is left to the server echo so the
      // thread shows the stamped message rather than a guessed one.
      if (next.status !== undefined || next.order !== undefined) {
        setTickets((prev) =>
          prev.map((t) =>
            t.id === id
              ? { ...t, ...(next.status ? { status: next.status } : {}), ...(next.order !== undefined ? { order: next.order } : {}) }
              : t,
          ),
        );
      }
      try {
        const res = await fetch('/api/tickets', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, ...next }),
        });
        if (!res.ok) {
          setWarning("That change didn't save.");
          return;
        }
        const data = (await res.json()) as { ticket?: Ticket };
        if (data.ticket) setTickets((prev) => prev.map((t) => (t.id === id ? data.ticket! : t)));
      } catch {
        setWarning("That change didn't save.");
      }
    },
    [],
  );

  const removeTicket = useCallback(
    async (id: string) => {
      setTickets((prev) => prev.filter((t) => t.id !== id));
      setOpenId(null);
      try {
        const res = await fetch('/api/tickets', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });
        if (!res.ok) {
          setWarning("That ticket couldn't be deleted.");
          load();
        }
      } catch {
        setWarning("That ticket couldn't be deleted.");
        load();
      }
    },
    [load],
  );

  const openTicket = tickets.find((t) => t.id === openId) ?? null;

  const attentionCount = tickets.filter((t) => needsAttention(t.status)).length;
  const lede =
    tickets.length === 0
      ? 'No tickets yet — clients open them from the Support tab in their portal.'
      : `${tickets.length} ticket${tickets.length !== 1 ? 's' : ''} · ${attentionCount} needing a reply`;

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
          <p className="meta text-fg3">Reading the ticket queue …</p>
        </div>
      ) : error ? (
        <div className="flex flex-1 items-start justify-start px-6 py-10 md:px-10">
          <div className="panel max-w-md p-6">
            <h3 className="mb-1 font-display text-base font-medium" style={{ color: 'var(--danger)' }}>
              Couldn&apos;t load tickets
            </h3>
            <p className="text-xs text-fg2">{error}</p>
            <button type="button" onClick={load} className="btn btn-sm mt-3" disabled={refreshing}>
              <ArrowsClockwise size={13} className={refreshing ? 'animate-spin' : undefined} /> Try again
            </button>
          </div>
        </div>
      ) : (
        <div className="no-scrollbar flex-1 overflow-y-auto">
          <div className="w-full px-6 py-6 md:px-8">
            <PageHeader title="Tickets" lede={lede} />

            {narrow ? (
              <div className="flex items-center justify-center py-16">
                <div className="panel max-w-sm p-6 text-center">
                  <h3 className="mb-1 font-display text-base font-medium text-fg">Not enough room</h3>
                  <p className="text-xs text-fg2">
                    The ticket board needs its columns side by side. Widen the window to triage.
                  </p>
                  <Link href="/clients" className="btn btn-sm mt-3">
                    <ArrowLeft size={13} /> All clients
                  </Link>
                </div>
              </div>
            ) : tickets.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16">
                <p className="max-w-sm text-center text-xs text-fg3">
                  No tickets yet. Clients open them from the Support tab in their portal, and they
                  arrive here for you to triage and reply.
                </p>
              </div>
            ) : (
              <TicketBoard tickets={tickets} onOpen={setOpenId} onPlace={patch} lastSeenAt={lastSeenAt} />
            )}
          </div>
        </div>
      )}

      {openTicket && (
        <TicketModal
          ticket={openTicket}
          onClose={() => setOpenId(null)}
          onPatch={(p) => patch(openTicket.id, p)}
          onDelete={removeTicket}
        />
      )}
    </div>
  );
}
