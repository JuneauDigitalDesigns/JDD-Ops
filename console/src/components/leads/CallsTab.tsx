'use client';
// Every call to the demo number, grouped by day.
//
// This exists because of a deliberate asymmetry: a call that yields no name never becomes
// a card. The funnel is for people you can follow up with, and a board full of bare phone
// numbers would bury the leads that have somewhere to go. But the calls still happened —
// they're the clearest signal there is of whether the site is doing its job — so they get
// a list of their own rather than being discarded.

import { Phone } from '@phosphor-icons/react';
import type { DemoCall } from '@/lib/leadTypes';
import { absoluteTime } from '@/lib/relativeTime';

function formatDuration(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms)) return '—';
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** "Today" / "Yesterday" / a date — the granularity you actually think in. */
function dayLabel(at: number): string {
  const d = new Date(at);
  const today = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(today) - startOf(d)) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
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
    <div className="flex flex-col gap-6">
      {groups.map((g) => (
        <section key={g.label}>
          <h3 className="meta mb-2">{g.label}</h3>
          <ul className="flex flex-col rounded-[10px] border border-rule">
            {g.items.map((c, i) => (
              <li
                key={c.callId}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5"
                style={{ borderTop: i === 0 ? undefined : '1px solid var(--rule)' }}
              >
                <Phone size={12} weight="fill" className="shrink-0 text-fg3" />
                <span className="mono text-xs text-fg">{c.fromNumber ?? 'unknown'}</span>
                <span className="mono text-xs text-fg3">{formatDuration(c.durationMs)}</span>
                {c.outcome && <span className="text-xs text-fg2">{c.outcome}</span>}

                {c.leadId ? (
                  <button
                    type="button"
                    onClick={() => onOpenLead(c.leadId!)}
                    className="ml-auto text-xs"
                    style={{ color: 'var(--accent)' }}
                  >
                    → lead
                  </button>
                ) : (
                  <span className="ml-auto text-2xs text-fg3">no name given</span>
                )}

                <span className="mono w-full text-2xs text-fg3" title={absoluteTime(c.at)}>
                  {new Date(c.at).toLocaleTimeString(undefined, {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                  {c.summary ? ` — ${c.summary}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
