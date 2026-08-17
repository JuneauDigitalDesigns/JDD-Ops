'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowsClockwise,
  CheckCircle,
  CurrencyDollar,
  Funnel,
  SpinnerGap,
  Users,
  WarningCircle,
  WarningOctagon,
} from '@phosphor-icons/react';
import { relativeTime } from '@/lib/relativeTime';
import type { BriefingPayload } from '@/app/api/briefing/route';

/**
 * The console's front door: what needs doing, what the money is, where the funnel moved.
 *
 * The roster it replaced was excellent at "open a specific client" and incapable of
 * "tell me what's wrong" — it sorted for lookup, and a roster of healthy clients looked
 * identical to a roster nobody had checked. It moved to /clients unchanged.
 *
 * ── Never says "all clear" without having looked ────────────────────────────
 *
 * Everything here reads cached sweep results, so a client that has never been swept has no
 * findings — which is indistinguishable from a client with no problems unless it is said
 * out loud. `staleSlugs` is therefore rendered as prominently as the issues themselves. A
 * dashboard that reports calm because it never checked is worse than no dashboard.
 */

function money(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export default function BriefingView() {
  const [data, setData] = useState<BriefingPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sweeping, setSweeping] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/briefing', { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) setError(body?.error ?? `Failed (${res.status})`);
      else setData(body as BriefingPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Sweeping every client is the one expensive action on this page, so it is a button and
   * never automatic — the same rule env drift has followed since before any of this.
   */
  const sweepAll = useCallback(async () => {
    setSweeping(true);
    setError(null);
    try {
      const res = await fetch('/api/manage/reconcile', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // No `fixtures` key on purpose. Omitting it means "no opinion", and the route
        // resolves the same CONSOLE_INCLUDE_FIXTURES this payload was built from — so the
        // sweep covers exactly what the screen shows. Passing a copy of the policy from the
        // client would be a second source of the same truth, free to drift.
        body: JSON.stringify({ all: true }),
      });
      const body = await res.json();
      if (!res.ok) setError(body?.error ?? `Sweep failed (${res.status})`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSweeping(false);
    }
  }, [load]);

  if (error && !data) return <p className="meta" style={{ color: 'var(--danger)' }}>{error}</p>;
  if (!data) {
    return (
      <p className="meta flex items-center gap-2">
        <SpinnerGap size={13} className="animate-spin" /> Loading…
      </p>
    );
  }

  const nothingWrong = data.issues.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-6">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tightish text-fg">Briefing</h1>
          <p className="meta">
            {data.clientCount} client{data.clientCount === 1 ? '' : 's'}
            {/* A screen whose population is unusual has to say so, or the counts below are
                unreadable — this is the difference between "nothing wrong" and "nothing
                wrong among the clients I was willing to look at". */}
            {data.includingFixtures && ' · including fixtures'}
            {data.checkedAt && ` · swept ${relativeTime(new Date(data.checkedAt).toISOString())}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/clients" className="btn btn-xs">
            <Users size={12} /> All clients
          </Link>
          <button type="button" className="btn btn-xs" onClick={sweepAll} disabled={sweeping}>
            {sweeping ? <SpinnerGap size={12} className="animate-spin" /> : <ArrowsClockwise size={12} />}
            {sweeping ? 'Sweeping…' : 'Sweep all'}
          </button>
        </div>
      </header>

      {error && <p className="meta" style={{ color: 'var(--danger)' }}>{error}</p>}

      {/* Never-swept clients rank with the issues, not below them: a zero here is
          ambiguous until you know whether anyone looked. */}
      {data.staleSlugs.length > 0 && (
        <section className="panel flex flex-col gap-1 p-4">
          <p className="text-[13px]" style={{ color: 'var(--warn)' }}>
            {data.staleSlugs.length} client{data.staleSlugs.length === 1 ? ' has' : 's have'} never
            been swept — their state is unknown, not healthy.
          </p>
          <p className="meta">{data.staleSlugs.join(', ')}</p>
        </section>
      )}

      {/* Records with no folder here. Distinct from stale: these aren't unswept, they are
          clients this machine has no copy of. Previously they inflated the stage counts
          silently, which is how the totals stopped matching clientCount. */}
      {data.recordsWithoutFolder.length > 0 && (
        <p className="meta">
          {data.recordsWithoutFolder.length} client record
          {data.recordsWithoutFolder.length === 1 ? '' : 's'} with no folder on this machine:{' '}
          {data.recordsWithoutFolder.join(', ')} — provisioned elsewhere, or torn down.
        </p>
      )}

      {/* The other half of the accounting. These have no record, so they contribute nothing
          to the stage counts — without naming them the totals just quietly fail to add up. */}
      {data.foldersWithoutRecord.length > 0 && (
        <p className="meta">
          {data.foldersWithoutRecord.length} client
          {data.foldersWithoutRecord.length === 1 ? '' : 's'} with no record, so no lifecycle
          stage: {data.foldersWithoutRecord.join(', ')} — usually no portal account yet
          (<code className="codechip">npm run link-portal</code>).
        </p>
      )}

      {/* ── Issues ────────────────────────────────────────────────────────── */}
      <section className="panel flex flex-col gap-3 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lg font-semibold tracking-tightish text-fg">
            Needs attention
          </h2>
          <span className="meta">
            {data.counts.red} breaking · {data.counts.amber} drifting · {data.counts.unknown} unchecked
          </span>
        </div>

        {nothingWrong ? (
          <p className="meta flex items-center gap-1.5">
            <CheckCircle size={13} weight="fill" style={{ color: 'var(--ok)' }} />
            {data.staleSlugs.length > 0
              ? 'Nothing wrong on the clients that have been swept.'
              : 'Nothing wrong across every client and vendor checked.'}
          </p>
        ) : (
          <ul className="flex flex-col">
            {data.issues.map((f) => (
              <li
                key={`${f.slug}:${f.siteSlug}:${f.id}`}
                className="flex items-start gap-2.5 border-b py-2.5 last:border-b-0"
                style={{ borderColor: 'var(--rule)' }}
              >
                {f.severity === 'red' ? (
                  <WarningOctagon size={14} weight="fill" style={{ color: 'var(--danger)', marginTop: 2, flexShrink: 0 }} />
                ) : (
                  <WarningCircle size={14} weight="fill" style={{ color: 'var(--warn)', marginTop: 2, flexShrink: 0 }} />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[13px]" style={{ color: 'var(--fg-1)' }}>
                    {f.title}
                  </p>
                  <p className="meta mt-0.5 line-clamp-1">{f.detail}</p>
                </div>
                <Link
                  href={`/c/${f.slug}/manage/overview`}
                  className="meta shrink-0 hover:text-accent"
                  title={`Open ${f.brandName}`}
                >
                  {f.brandName}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── Money ───────────────────────────────────────────────────────── */}
        <section className="panel flex flex-col gap-3 p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold tracking-tightish text-fg">
            <CurrencyDollar size={16} /> Money
            {/* A LABEL, not a warning. Running against test keys is the intended state
                while the six-vendor stack is still being stood up, so this is toned as
                neutral metadata rather than amber. It exists because a dollar figure reads
                as revenue the instant it's on screen: "$6,534 MRR" and "$6,534 MRR (test)"
                are the same pixels and completely different facts. Turns itself off in
                live mode, when the number means what it looks like. */}
            {data.stripe.mode !== 'live' && (
              <span
                className="rounded-sm border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide"
                style={{ borderColor: 'var(--rule)', color: 'var(--fg-3)' }}
                title="Figures below come from Stripe test mode, not live revenue."
              >
                {data.stripe.mode ?? 'no key'}
              </span>
            )}
          </h2>

          {data.stripe.error ? (
            <p className="meta" style={{ color: 'var(--warn)' }}>
              Couldn’t read Stripe ({data.stripe.error}). Revenue is unknown, not zero.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                {/* The total leads, because it's the number that matches the dashboard and
                    the one you'd otherwise go and check. */}
                <Stat label="MRR" value={money(data.stripe.totalMrrCents)} />
                <Stat label="Overage billed" value={money(data.money.overageBilledCents)} />
              </div>

              {/* The attribution split. When it's clean this is one quiet line; when it
                  isn't, the unattributed figure is the actionable one — revenue tied to no
                  client means someone is paying for something that may not exist. */}
              <p className="meta">
                {money(data.stripe.attributedMrrCents)} tied to a client
                {data.stripe.unattributedCount > 0 && (
                  <>
                    {' · '}
                    <span style={{ color: 'var(--warn)' }}>
                      {money(data.stripe.unattributedCents)} across{' '}
                      {data.stripe.unattributedCount} subscription
                      {data.stripe.unattributedCount === 1 ? '' : 's'} matched to no client
                    </span>
                  </>
                )}
                {data.stripe.truncated && ' · more than 500 active subscriptions — total is partial'}
              </p>
            </>
          )}

          {data.money.failing.length > 0 && (
            <div className="flex flex-col gap-1 border-t pt-2" style={{ borderColor: 'var(--rule)' }}>
              <p className="meta" style={{ color: 'var(--danger)' }}>Payment not collecting</p>
              {data.money.failing.map((x) => (
                <Link key={x.slug} href={`/c/${x.slug}/account`} className="meta hover:text-accent">
                  {x.brandName} — {x.status}
                </Link>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-1 border-t pt-2" style={{ borderColor: 'var(--rule)' }}>
            <p className="meta">Renewing in the next 14 days</p>
            {data.money.renewingSoon.length === 0 ? (
              <p className="meta">None.</p>
            ) : (
              data.money.renewingSoon.map((r) => (
                <Link key={r.slug} href={`/c/${r.slug}/account`} className="meta hover:text-accent">
                  {r.brandName} — {new Date(r.at).toISOString().slice(0, 10)} · {money(r.amountCents ?? 0)}
                </Link>
              ))
            )}
          </div>
        </section>

        {/* ── Funnel ──────────────────────────────────────────────────────── */}
        <section className="panel flex flex-col gap-3 p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold tracking-tightish text-fg">
            <Funnel size={16} /> Funnel
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Leads" value={String(data.funnel.leadsTotal)} />
            <Stat label="New" value={String(data.funnel.leadsNew)} />
            <Stat label="Demo calls (7d)" value={String(data.funnel.demoCalls7d)} />
            <Stat
              label="Call → lead"
              // Null, not 0%: "0% of no calls" reads as a collapse in conversion.
              value={data.funnel.callToLeadPct === null ? '—' : `${data.funnel.callToLeadPct}%`}
            />
          </div>
          <Link href="/leads" className="meta border-t pt-2 hover:text-accent" style={{ borderColor: 'var(--rule)' }}>
            Open the funnel →
          </Link>

          {Object.keys(data.stages).length > 0 && (
            <div className="flex flex-col gap-1 border-t pt-2" style={{ borderColor: 'var(--rule)' }}>
              <p className="meta">Lifecycle</p>
              <p className="meta">
                {Object.entries(data.stages)
                  .map(([stage, n]) => `${n} ${stage}`)
                  .join(' · ')}
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="meta">{label}</span>
      <span className="font-display text-xl font-semibold tracking-tightish text-fg">{value}</span>
    </div>
  );
}
