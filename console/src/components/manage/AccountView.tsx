'use client';

import { useCallback, useEffect, useState } from 'react';
import { Phone, SpinnerGap, Warning } from '@phosphor-icons/react';
import { relativeTime, absoluteTime } from '@/lib/relativeTime';
import type { AccountPayload } from '@/app/api/manage/account/route';

/**
 * Money first, then history, then evidence.
 *
 * The order is the point. You open this before a renewal conversation or when deciding
 * whether to chase someone, and the first question is always "what are they worth and is
 * it arriving". Engagement matters — but as the thing you cite once you already know the
 * number, not as the headline.
 *
 * Every money figure carries the sweep's timestamp. These come from the reconcile cache,
 * not a live Stripe call, so an un-swept client shows "never checked" rather than a
 * confident zero. A financial figure with no age on it is the kind of number people act on
 * and shouldn't.
 */

function money(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '—';
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export default function AccountView({ slug }: { slug: string }) {
  const [data, setData] = useState<AccountPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/manage/account?slug=${encodeURIComponent(slug)}`, {
        cache: 'no-store',
      });
      const body = await res.json();
      if (!res.ok) setError(body?.error ?? `Failed (${res.status})`);
      else setData(body as AccountPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return (
      <p className="meta flex items-center gap-2">
        <SpinnerGap size={13} className="animate-spin" /> Loading account…
      </p>
    );
  }
  if (error) return <p className="meta" style={{ color: 'var(--danger)' }}>{error}</p>;
  if (!data) return null;

  const mrrCents = data.money.reduce((sum, m) => sum + (m.amountCents ?? 0), 0);
  const renewal = data.money.find((m) => m.currentPeriodEnd)?.currentPeriodEnd ?? null;
  const worstStatus = data.money.find((m) => m.status && m.status !== 'active')?.status ?? null;

  return (
    <div className="flex flex-col gap-4">
      {/* ── Money ─────────────────────────────────────────────────────────── */}
      <section className="panel flex flex-col gap-4 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lg font-semibold tracking-tightish text-fg">Money</h2>
          <span className="meta">
            {data.checkedAt ? (
              <span title={absoluteTime(new Date(data.checkedAt).toISOString())}>
                as of {relativeTime(new Date(data.checkedAt).toISOString())}
              </span>
            ) : (
              'never checked — run a sweep from Manage'
            )}
          </span>
        </div>

        {data.money.length === 0 ? (
          <p className="meta">
            No subscription found for this client on the last sweep. If they are live, that is
            worth acting on — an unbilled client shows up as a red finding on Manage.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-4">
            <Stat label="Monthly" value={money(mrrCents)} />
            <Stat
              label="Renews"
              value={renewal ? new Date(renewal).toISOString().slice(0, 10) : '—'}
            />
            <Stat
              label="Payment"
              value={worstStatus ?? 'active'}
              tone={worstStatus ? 'danger' : undefined}
            />
            <Stat label="Plan" value={data.money.map((m) => m.plan).join(', ') || '—'} />
          </div>
        )}

        {data.money.length > 1 && (
          <ul className="flex flex-col gap-1 border-t pt-3" style={{ borderColor: 'var(--rule)' }}>
            {/* Enterprise: one line per site, because a client can have one site cancelling
                while the others are fine, and a single summed figure would hide that. */}
            {data.money.map((m) => (
              <li key={m.siteSlug} className="meta flex justify-between gap-3">
                <span>{m.siteSlug}</span>
                <span>
                  {money(m.amountCents)} · {m.plan} · {m.status ?? 'unknown'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── History ───────────────────────────────────────────────────────── */}
      <section className="panel flex flex-col gap-4 p-5">
        <h2 className="font-display text-lg font-semibold tracking-tightish text-fg">History</h2>
        {data.ledger ? (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Stat label="Lifetime value" value={money(data.ledger.ltvCents)} />
              <Stat
                label="Tenure"
                value={
                  data.tenureMonths === null || data.tenureMonths === 0
                    ? '—'
                    : `${data.tenureMonths} month${data.tenureMonths === 1 ? '' : 's'}`
                }
              />
              <Stat label="Stage" value={data.stage ?? '—'} />
            </div>

            {data.ledger.overages.length > 0 ? (
              <div className="flex flex-col gap-1 border-t pt-3" style={{ borderColor: 'var(--rule)' }}>
                <p className="meta">Overage periods — the upsell signal.</p>
                {data.ledger.overages.map((o) => (
                  <div key={o.periodEnd} className="meta flex justify-between gap-3">
                    <span>{new Date(o.periodEnd).toISOString().slice(0, 10)}</span>
                    <span>
                      {o.minutes} min over · billed {money(o.billedCents)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="meta">No overage periods recorded.</p>
            )}
          </>
        ) : (
          <p className="meta">
            No client record yet. Run <code>npm run backfill-client-records</code> to create one —
            lifetime value and overage history accumulate from that point on.
          </p>
        )}
      </section>

      {/* ── Evidence ──────────────────────────────────────────────────────── */}
      <section className="panel flex flex-col gap-3 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lg font-semibold tracking-tightish text-fg">
            Recent calls
          </h2>
          {data.email && <span className="meta">{data.email}</span>}
        </div>

        {data.callsReason ? (
          <p className="meta flex items-center gap-1.5">
            <Warning size={12} style={{ color: 'var(--warn)' }} /> {data.callsReason}
          </p>
        ) : data.calls.length === 0 ? (
          <p className="meta">
            No calls logged. For a live client that is itself worth checking — the post-call
            scenario failing is silent, and Manage will say so if it is.
          </p>
        ) : (
          <ul className="flex flex-col">
            {data.calls.map((c) => (
              <li
                key={c.id}
                className="flex items-start gap-3 border-b py-2 last:border-b-0"
                style={{ borderColor: 'var(--rule)' }}
              >
                <Phone size={13} style={{ color: 'var(--fg-3)', marginTop: 3, flexShrink: 0 }} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px]" style={{ color: 'var(--fg-1)' }}>
                    {c.callerName ?? c.callerNumber ?? 'Unknown caller'}
                    {c.outcome && <span className="meta"> · {c.outcome}</span>}
                  </p>
                  {c.summary && <p className="meta mt-0.5 line-clamp-2">{c.summary}</p>}
                </div>
                <span className="meta shrink-0">
                  {c.durationSeconds !== null && `${Math.round(c.durationSeconds / 60)}m · `}
                  {c.date ? relativeTime(c.date) : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'danger';
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="meta">{label}</span>
      <span
        className="font-display text-xl font-semibold tracking-tightish"
        style={{ color: tone === 'danger' ? 'var(--danger)' : 'var(--fg-1)' }}
      >
        {value}
      </span>
    </div>
  );
}
