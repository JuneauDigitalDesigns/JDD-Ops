'use client';
// Every call to the demo number, grouped by day.
//
// Expandable rows: collapsed shows the headline (number, duration, outcome); expanded adds
// the full AI summary, audio player, disconnection reason, and a link to the lead if one
// exists. Capped at max-w-[760px] so it reads as a column on large monitors.

import { useState } from 'react';
import { CaretDown, CaretUp, Phone } from '@phosphor-icons/react';
import type { DemoCall } from '@/lib/leadTypes';
import { absoluteTime } from '@/lib/relativeTime';

// Normalise raw Retell outcome strings into readable labels.
const OUTCOME_LABEL: Record<string, string> = {
  call_completed: 'Completed',
  user_hangup: 'Completed',
  voicemail: 'Voicemail',
  voicemail_reached: 'Voicemail',
  no_answer: 'No answer',
  dial_failed: 'Failed',
  dial_no_answer: 'No answer',
};

const DISCONNECTION_LABEL: Record<string, string> = {
  user_hangup: 'Caller hung up',
  agent_hangup: 'Agent ended call',
  voicemail_reached: 'Reached voicemail',
  no_answer: 'No answer',
  dial_failed: 'Dial failed',
  dial_no_answer: 'No answer',
  call_transfer: 'Transferred',
  inactivity: 'Inactivity timeout',
  machine_detected: 'Machine detected',
};

function outcomeColor(outcome: string | null): string {
  if (!outcome) return 'var(--fg-3)';
  if (['call_completed', 'user_hangup'].includes(outcome)) return 'var(--ok)';
  if (['voicemail', 'voicemail_reached'].includes(outcome)) return 'var(--warn)';
  if (['no_answer', 'dial_failed', 'dial_no_answer'].includes(outcome)) return 'var(--danger)';
  return 'var(--fg-3)';
}

function formatDuration(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms)) return '—';
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function dayLabel(at: number): string {
  const d = new Date(at);
  const today = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(today) - startOf(d)) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function CallRow({
  call, onOpenLead, borderTop,
}: {
  call: DemoCall;
  onOpenLead: (id: string) => void;
  borderTop?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const outLabel = call.outcome ? (OUTCOME_LABEL[call.outcome] ?? call.outcome) : null;
  const discLabel = call.disconnectionReason
    ? (DISCONNECTION_LABEL[call.disconnectionReason] ?? call.disconnectionReason)
    : null;
  const color = outcomeColor(call.outcome);
  const time = new Date(call.at).toLocaleTimeString(undefined, {
    hour: 'numeric', minute: '2-digit',
  });

  return (
    <li className="flex flex-col" style={{ borderTop: borderTop ? '1px solid var(--rule)' : undefined }}>
      {/* Collapsed row */}
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--surface)]"
        aria-expanded={open}
      >
        <Phone size={12} weight="fill" className="shrink-0 text-fg3" />
        <span className="mono text-xs text-fg">{call.fromNumber ?? 'unknown'}</span>
        <span className="mono text-xs text-fg3">{formatDuration(call.durationMs)}</span>
        {outLabel && (
          <span
            className="rounded-[5px] px-1.5 py-0.5 text-2xs font-medium"
            style={{
              color,
              background: `color-mix(in srgb, ${color} 12%, transparent)`,
            }}
          >
            {outLabel}
          </span>
        )}
        {/* Lead indicator dot */}
        {call.leadId && (
          <span
            className="h-[6px] w-[6px] shrink-0 rounded-full"
            style={{ background: 'var(--accent)' }}
            title="Has a lead card"
          />
        )}
        <span className="mono ml-auto shrink-0 text-2xs text-fg3" title={absoluteTime(call.at)}>
          {time}
        </span>
        <span className="shrink-0 text-fg3">
          {open ? <CaretUp size={12} /> : <CaretDown size={12} />}
        </span>
      </button>

      {/* Expanded area */}
      {open && (
        <div className="flex flex-col gap-3 border-t border-rule bg-[var(--surface)] px-4 py-3">
          {call.summary ? (
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-fg2">{call.summary}</p>
          ) : (
            <p className="text-xs text-fg3">No summary on this call.</p>
          )}

          {call.recordingUrl && (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <audio controls preload="none" src={call.recordingUrl} className="w-full" />
          )}

          {discLabel && (
            <p className="text-xs text-fg3">{discLabel}</p>
          )}

          {call.leadId && (
            <button
              type="button"
              onClick={() => onOpenLead(call.leadId!)}
              className="self-start text-xs"
              style={{ color: 'var(--accent)' }}
            >
              → Open lead
            </button>
          )}
        </div>
      )}
    </li>
  );
}

export default function CallsTab({
  calls, onOpenLead,
}: {
  calls: DemoCall[];
  onOpenLead: (leadId: string) => void;
}) {
  if (calls.length === 0) {
    return (
      <p className="py-16 text-center text-xs text-fg3">
        No calls to the demo number yet.
      </p>
    );
  }

  const groups: { label: string; items: DemoCall[] }[] = [];
  for (const call of calls) {
    const label = dayLabel(call.at);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(call);
    else groups.push({ label, items: [call] });
  }

  return (
    <div className="flex max-w-[760px] flex-col gap-6">
      {groups.map((g) => (
        <section key={g.label}>
          <h3 className="meta mb-2">{g.label}</h3>
          <ul className="flex flex-col overflow-hidden rounded-[10px] border border-rule">
            {g.items.map((c, i) => (
              <CallRow key={c.callId} call={c} onOpenLead={onOpenLead} borderTop={i > 0} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
