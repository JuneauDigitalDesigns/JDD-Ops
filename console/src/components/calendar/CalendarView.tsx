'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowsClockwise, CaretLeft, CaretRight } from '@phosphor-icons/react';
import type { Meeting, MeetingStatus } from '@/lib/meetingTypes';
import {
  RANGE_END, RANGE_START, firstConflict, formatTime, monthLabel, monthsInRange, shiftMonth, todayDay,
} from '@/lib/meetingTime';
import RefreshButton from '@/components/shell/RefreshButton';
import WarnBanner from '@/components/shell/WarnBanner';
import MonthGrid from './MonthGrid';
import MeetingForm, { type MeetingFormValues } from './MeetingForm';
import MeetingModal from './MeetingModal';

/**
 * The calendar screen.
 *
 * Error discipline is copied deliberately from LeadsView, the console's house rule: a failed
 * refresh must NEVER replace the view. You keep the last-known meetings and get a dismissible
 * banner; a hard error only when there is genuinely nothing to show. Writes are optimistic — a bar
 * that snaps back for 200ms after every drop feels broken — and the next refresh reconciles.
 */

/** Current month, clamped into the default range for the initial view (nav may still page beyond). */
function defaultMonth(): string {
  const ym = todayDay().slice(0, 7);
  if (ym < RANGE_START) return RANGE_START;
  if (ym > RANGE_END) return RANGE_END;
  return ym;
}

type FormState = { initial: MeetingFormValues } | null;

/** The mutable subset a PATCH may carry — mirrors the server's MeetingPatch (which is
 *  server-only and can't be imported here). Optional text fields accept null to clear. */
type MeetingWrite = {
  day?: string;
  startMinutes?: number;
  durationMinutes?: number;
  kind?: Meeting['kind'];
  status?: MeetingStatus;
  businessName?: string;
  contactName?: string | null;
  trade?: string | null;
  phone?: string | null;
  notes?: string | null;
};

export default function CalendarView() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [ym, setYm] = useState(defaultMonth);
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const hasData = useRef(false);
  const prefillRead = useRef(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/meetings', { cache: 'no-store' });
      const data = (await res.json()) as { meetings?: Meeting[]; error?: string };
      const list = data.meetings ?? [];
      setMeetings(list);
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

  // Open the create form prefilled when we arrived from a lead's "Add to calendar". One-shot: the
  // ref guard survives StrictMode's double-mount, and we strip the query so closing + refreshing
  // doesn't reopen it.
  useEffect(() => {
    if (prefillRead.current) return;
    if (searchParams.get('create') !== '1') return;
    prefillRead.current = true;
    setForm({
      initial: {
        day: todayDay(),
        startMinutes: 9 * 60,
        durationMinutes: 30,
        kind: 'call',
        businessName: searchParams.get('business') ?? '',
        contactName: searchParams.get('name') ?? '',
        trade: searchParams.get('trade') ?? '',
        phone: searchParams.get('phone') ?? '',
        notes: '',
        leadId: searchParams.get('leadId') ?? undefined,
      },
    });
    router.replace('/calendar');
  }, [searchParams, router]);

  /** Optimistic field update for one meeting, mirroring LeadsView.patch. */
  const patch = useCallback(async (id: string, next: MeetingWrite) => {
    setMeetings((prev) => prev.map((m) => (m.id === id ? ({ ...m, ...next } as Meeting) : m)));
    try {
      const res = await fetch('/api/meetings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...next }),
      });
      if (!res.ok) {
        setWarning("That change didn't save.");
        return;
      }
      const data = (await res.json()) as { meeting?: Meeting };
      if (data.meeting) setMeetings((prev) => prev.map((m) => (m.id === id ? data.meeting! : m)));
    } catch {
      setWarning("That change didn't save.");
    }
  }, []);

  /** Create (not optimistic — the server owns id/createdAt, like LeadsView.createLead). */
  const createMeeting = useCallback(
    async (values: MeetingFormValues) => {
      setBusy(true);
      try {
        const res = await fetch('/api/meetings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            day: values.day,
            startMinutes: values.startMinutes,
            durationMinutes: values.durationMinutes,
            kind: values.kind,
            businessName: values.businessName.trim(),
            contactName: values.contactName.trim() || undefined,
            trade: values.trade.trim() || undefined,
            phone: values.phone.trim() || undefined,
            notes: values.notes.trim() || undefined,
            leadId: values.leadId,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as { meeting?: Meeting; error?: string };
        if (!res.ok || !data.meeting) {
          setWarning(data.error ?? "That meeting couldn't be created.");
          return;
        }
        setMeetings((prev) => [...prev, data.meeting!]);
        setYm(values.day.slice(0, 7)); // jump to the month it landed in
        setForm(null);
      } catch {
        setWarning("That meeting couldn't be created.");
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  /** Edit an existing meeting from the form. Empty optionals clear to null. */
  const editMeeting = useCallback(
    async (values: MeetingFormValues) => {
      if (!values.id) return;
      setBusy(true);
      try {
        await patch(values.id, {
          day: values.day,
          startMinutes: values.startMinutes,
          durationMinutes: values.durationMinutes,
          kind: values.kind,
          businessName: values.businessName.trim(),
          contactName: values.contactName.trim() || null,
          trade: values.trade.trim() || null,
          phone: values.phone.trim() || null,
          notes: values.notes.trim() || null,
        });
      } finally {
        setBusy(false);
        setForm(null);
      }
    },
    [patch],
  );

  const removeMeeting = useCallback(
    async (id: string) => {
      setMeetings((prev) => prev.filter((m) => m.id !== id));
      setOpenId(null);
      try {
        const res = await fetch('/api/meetings', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });
        if (!res.ok) {
          setWarning("That meeting couldn't be deleted.");
          load();
        }
      } catch {
        setWarning("That meeting couldn't be deleted.");
        load();
      }
    },
    [load],
  );

  /** A bar was dragged to a new day. Keep its time; warn (non-blocking) on a clash. */
  const onMove = useCallback(
    (id: string, targetDay: string) => {
      const m = meetings.find((x) => x.id === id);
      if (!m) return;
      const clash = firstConflict(
        { day: targetDay, startMinutes: m.startMinutes, durationMinutes: m.durationMinutes },
        meetings,
        id,
      );
      if (clash) {
        setWarning(
          `Moved onto ${clash.businessName} at ${formatTime(clash.startMinutes)} — they now overlap.`,
        );
      }
      patch(id, { day: targetDay });
    },
    [meetings, patch],
  );

  const openMeeting = meetings.find((m) => m.id === openId) ?? null;

  const monthOptions = useMemo(() => {
    const opts = monthsInRange();
    if (!opts.includes(ym)) {
      opts.push(ym);
      opts.sort();
    }
    return opts;
  }, [ym]);

  const lede =
    meetings.length === 0
      ? 'No meetings scheduled yet'
      : `${meetings.length} meeting${meetings.length !== 1 ? 's' : ''} scheduled`;

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
          <p className="meta text-fg3">Reading the calendar …</p>
        </div>
      ) : error ? (
        <div className="flex flex-1 items-start justify-start px-6 py-10 md:px-10">
          <div className="panel max-w-md p-6">
            <h3 className="mb-1 font-display text-base font-medium" style={{ color: 'var(--danger)' }}>
              Couldn&apos;t load the calendar
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
            {/* Month nav — the only header (no PageHeader, by request). */}
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setYm((p) => shiftMonth(p, -1))}
                aria-label="Previous month"
                className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-rule-strong text-fg2 hover:border-[var(--accent)] hover:text-accent"
              >
                <CaretLeft size={14} />
              </button>
              <h1 className="min-w-[168px] font-display text-xl font-semibold tracking-tightish text-fg">
                {monthLabel(ym)}
              </h1>
              <button
                type="button"
                onClick={() => setYm((p) => shiftMonth(p, 1))}
                aria-label="Next month"
                className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-rule-strong text-fg2 hover:border-[var(--accent)] hover:text-accent"
              >
                <CaretRight size={14} />
              </button>
              <select
                value={ym}
                onChange={(e) => setYm(e.target.value)}
                className="rounded-[8px] border border-rule-strong bg-transparent px-2.5 py-1.5 text-sm"
                aria-label="Jump to month"
              >
                {monthOptions.map((m) => (
                  <option key={m} value={m}>
                    {monthLabel(m)}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => setYm(defaultMonth())} className="btn btn-sm">
                Today
              </button>

              {/* Legend + count */}
              <div className="ml-auto flex items-center gap-4 text-xs text-fg3">
                <span className="flex items-center gap-1.5">
                  <span className="h-[9px] w-[9px] rounded-[3px]" style={{ background: 'var(--accent)' }} /> Call
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-[9px] w-[9px] rounded-[3px]" style={{ background: 'var(--ok)' }} /> Video
                </span>
                <span>{lede}</span>
              </div>
            </div>

            <MonthGrid
              ym={ym}
              meetings={meetings}
              onOpenMeeting={setOpenId}
              onCreate={(day) =>
                setForm({
                  initial: {
                    day,
                    startMinutes: 9 * 60,
                    durationMinutes: 30,
                    kind: 'call',
                    businessName: '',
                    contactName: '',
                    trade: '',
                    phone: '',
                    notes: '',
                  },
                })
              }
              onMove={onMove}
            />
          </div>
        </div>
      )}

      {form && (
        <MeetingForm
          initial={form.initial}
          allMeetings={meetings}
          busy={busy}
          onCancel={() => setForm(null)}
          onSubmit={(values) => (values.id ? editMeeting(values) : createMeeting(values))}
        />
      )}

      {openMeeting && !form && (
        <MeetingModal
          meeting={openMeeting}
          busy={busy}
          onClose={() => setOpenId(null)}
          onPatch={(p) => patch(openMeeting.id, p)}
          onDelete={removeMeeting}
          onEdit={() =>
            setForm({
              initial: {
                id: openMeeting.id,
                day: openMeeting.day,
                startMinutes: openMeeting.startMinutes,
                durationMinutes: openMeeting.durationMinutes,
                kind: openMeeting.kind,
                businessName: openMeeting.businessName,
                contactName: openMeeting.contactName ?? '',
                trade: openMeeting.trade ?? '',
                phone: openMeeting.phone ?? '',
                notes: openMeeting.notes ?? '',
                leadId: openMeeting.leadId,
              },
            })
          }
          onViewLead={(leadId) => router.push(`/leads?open=${encodeURIComponent(leadId)}`)}
        />
      )}
    </div>
  );
}
