'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowsClockwise,
  CheckCircle,
  CurrencyDollar,
  Funnel as FunnelIcon,
  SpinnerGap,
  Users,
  WarningCircle,
} from '@phosphor-icons/react';
import { severityRank, type FindingArea, type Severity } from '@jdd/schema';
import { relativeTime } from '@/lib/relativeTime';
import type { BriefingPayload } from '@/app/api/briefing/route';
import PageHeader from '@/components/shell/PageHeader';
import RefreshButton from '@/components/shell/RefreshButton';
import WarnBanner from '@/components/shell/WarnBanner';
import { SEVERITY_META } from '@/components/manage/FindingsList';

/**
 * The console's front door: what needs doing, what the money is, where the funnel moved.
 *
 * The roster it replaced was excellent at "open a specific client" and incapable of
 * "tell me what's wrong" — it sorted for lookup, and a roster of healthy clients looked
 * identical to a roster nobody had checked. It moved to /clients unchanged.
 *
 * ── Triage first, state second ───────────────────────────────────────────────
 *
 * Findings, failing payments, and never-swept clients are one list, grouped by client,
 * worst client first — that's the whole left column. Money and the funnel are a calm
 * rail on the right: read-only state, not something you triage every morning. "All
 * clients" is the one loud action, because it's the logical next stop every single time
 * this page has nothing left to say.
 *
 * ── Never says "all clear" without having looked ────────────────────────────
 *
 * A client with no cached sweep renders as its own "Never swept" group, sorted by
 * severity like any other finding — so `groups.length === 0` (the only "nothing wrong"
 * signal on this page) is true only when every client was actually checked. A dashboard
 * that reports calm because it never checked is worse than no dashboard.
 */

const STALE_AFTER_MS = 24 * 60 * 60 * 1000;
const ROW_CAP = 8;

type RowFinding = {
  id: string;
  slug: string;
  brandName: string;
  severity: Severity;
  area: FindingArea;
  title: string;
  detail: string;
};

type FindingGroup = { slug: string; brandName: string; findings: RowFinding[] };

function money(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

/** "2 breaking · 1 drifting" — reuses SEVERITY_META's labels so a group summary can never
 *  say something the icons and the "Needs attention" header don't also say. */
function summarizeGroup(findings: RowFinding[]): string {
  const counts: Partial<Record<Severity, number>> = {};
  for (const f of findings) counts[f.severity] = (counts[f.severity] ?? 0) + 1;
  return (['red', 'amber', 'unknown'] as Severity[])
    .filter((s) => counts[s])
    .map((s) => `${counts[s]} ${SEVERITY_META[s].label.toLowerCase()}`)
    .join(' · ');
}

export default function BriefingView() {
  const [data, setData] = useState<BriefingPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [sweeping, setSweeping] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const hasData = useRef(false);
  const lastFetch = useRef(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/briefing', { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) {
        const msg = body?.error ?? `Failed (${res.status})`;
        if (hasData.current) setWarning(msg);
        else setError(msg);
      } else {
        setData(body as BriefingPayload);
        hasData.current = true;
        setError(null);
        setWarning(null);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (hasData.current) setWarning(msg);
      else setError(msg);
    }
  }, []);

  useEffect(() => {
    lastFetch.current = Date.now();
    void load();
  }, [load]);

  /**
   * Re-read the cached payload when the tab regains focus, throttled to once per 30s.
   * This is a re-fetch, never a sweep — it just catches a sweep that finished elsewhere
   * (another window, cron) so returning to the tab doesn't show yesterday's data.
   */
  useEffect(() => {
    function onFocus() {
      if (Date.now() - lastFetch.current < 30_000) return;
      lastFetch.current = Date.now();
      void load();
    }
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [load]);

  /**
   * Sweeping every client is the one expensive action on this page, so it is a button and
   * never automatic — the same rule env drift has followed since before any of this.
   */
  const sweepAll = useCallback(async () => {
    setSweeping(true);
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
      if (!res.ok) {
        const msg = body?.error ?? `Sweep failed (${res.status})`;
        if (hasData.current) setWarning(msg);
        else setError(msg);
      }
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (hasData.current) setWarning(msg);
      else setError(msg);
    } finally {
      setSweeping(false);
    }
  }, [load]);

  const groups = useMemo<FindingGroup[]>(() => {
    if (!data) return [];
    const rows: RowFinding[] = [
      ...data.issues.map((f) => ({
        id: f.id,
        slug: f.slug,
        brandName: f.brandName,
        severity: f.severity,
        area: f.area,
        title: f.title,
        detail: f.detail,
      })),
      // Failing payments used to sit quietly in the Money panel. A declining card is a
      // triage item, not state — it belongs beside the other things that need doing.
      ...data.money.failing.map((x) => ({
        id: `billing:${x.slug}`,
        slug: x.slug,
        brandName: x.brandName,
        severity: 'red' as Severity,
        area: 'billing' as FindingArea,
        title: 'Payment not collecting',
        detail: `Stripe status: ${x.status}`,
      })),
      // Never-swept clients, folded in as their own finding rather than a bare list — see
      // the module docstring for why this is what keeps "nothing wrong" honest.
      ...data.stale.map((s) => ({
        id: `stale:${s.slug}`,
        slug: s.slug,
        brandName: s.brandName,
        severity: 'unknown' as Severity,
        area: 'site' as FindingArea,
        title: 'Never swept',
        detail: 'No cached reconcile result — state is unknown, not healthy.',
      })),
    ];

    const bySlug = new Map<string, FindingGroup>();
    for (const r of rows) {
      let g = bySlug.get(r.slug);
      if (!g) {
        g = { slug: r.slug, brandName: r.brandName, findings: [] };
        bySlug.set(r.slug, g);
      }
      g.findings.push(r);
    }
    const list = Array.from(bySlug.values());
    for (const g of list) g.findings.sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
    list.sort((a, b) => {
      const ra = severityRank(a.findings[0].severity);
      const rb = severityRank(b.findings[0].severity);
      if (ra !== rb) return ra - rb;
      if (a.findings.length !== b.findings.length) return b.findings.length - a.findings.length;
      return a.brandName.localeCompare(b.brandName);
    });
    return list;
  }, [data]);

  const counts = useMemo(() => {
    const c = { red: 0, amber: 0, unknown: 0 };
    for (const g of groups) {
      for (const f of g.findings) {
        if (f.severity === 'red') c.red++;
        else if (f.severity === 'amber') c.amber++;
        else if (f.severity === 'unknown') c.unknown++;
      }
    }
    return c;
  }, [groups]);

  // Cap at group boundaries, not mid-group — a client's problems stay together even if
  // that pushes the visible total a little past ROW_CAP.
  const { visibleGroups, hiddenCount } = useMemo(() => {
    if (expanded) return { visibleGroups: groups, hiddenCount: 0 };
    let cumulative = 0;
    const visible: FindingGroup[] = [];
    let hidden = 0;
    for (const g of groups) {
      if (cumulative < ROW_CAP) {
        visible.push(g);
        cumulative += g.findings.length;
      } else {
        hidden += g.findings.length;
      }
    }
    return { visibleGroups: visible, hiddenCount: hidden };
  }, [groups, expanded]);

  if (error && !data) {
    return (
      <>
        <RefreshButton onClick={sweepAll} busy={sweeping} />
        <div className="flex justify-center px-6 pt-[14vh]">
          <div className="panel max-w-md p-6">
            <h3 className="mb-1 font-display text-base font-medium" style={{ color: 'var(--danger)' }}>
              Couldn&apos;t load the briefing
            </h3>
            <p className="text-xs text-fg2">{error}</p>
            <button type="button" onClick={load} className="btn btn-sm mt-3">
              <ArrowsClockwise size={13} /> Try again
            </button>
          </div>
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <RefreshButton onClick={sweepAll} busy={sweeping} />
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className="meta flex items-center gap-2">
            <SpinnerGap size={13} className="animate-spin" /> Reading clients…
          </p>
        </div>
      </>
    );
  }

  const isStale = !data.checkedAt || Date.now() - data.checkedAt > STALE_AFTER_MS;
  const nothingWrong = groups.length === 0;

  return (
    <>
      <RefreshButton onClick={sweepAll} busy={sweeping} />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-6">
        <PageHeader
          title="Briefing"
          lede={
            <>
              {data.clientCount} client{data.clientCount === 1 ? '' : 's'}
              {data.includingFixtures && ' · including fixtures'}
              {data.checkedAt ? (
                <span style={isStale ? { color: 'var(--warn)' } : undefined}>
                  {' · swept '}
                  {relativeTime(new Date(data.checkedAt).toISOString())}
                </span>
              ) : (
                <span style={{ color: 'var(--warn)' }}> · never swept</span>
              )}
            </>
          }
          actions={
            <Link href="/clients" className="btn btn-accent">
              <Users size={15} /> All clients <span className="mono">({data.clientCount})</span>
            </Link>
          }
        />

        {isStale && (
          <div
            className="flex items-center gap-3 rounded-[10px] border p-3"
            style={{ borderColor: 'var(--warn)', background: 'var(--warn-glow)' }}
          >
            <WarningCircle size={15} weight="fill" style={{ color: 'var(--warn)', flexShrink: 0 }} />
            <p className="text-[13px]" style={{ color: 'var(--fg-1)' }}>
              {data.checkedAt
                ? `The last sweep was ${relativeTime(new Date(data.checkedAt).toISOString())} — this may be out of date.`
                : 'No client has ever been swept — nothing on this page has been checked.'}
            </p>
            <button type="button" className="btn btn-sm ml-auto shrink-0" onClick={sweepAll} disabled={sweeping}>
              {sweeping ? <SpinnerGap size={12} className="animate-spin" /> : <ArrowsClockwise size={12} />}
              {sweeping ? 'Sweeping…' : 'Sweep all'}
            </button>
          </div>
        )}

        {warning && (
          <WarnBanner message={warning} onRetry={load} onDismiss={() => setWarning(null)} busy={sweeping} />
        )}

        {nothingWrong ? (
          <>
            <div className="panel flex items-center gap-2 p-4">
              <CheckCircle size={15} weight="fill" style={{ color: 'var(--ok)' }} />
              <p className="text-[13px]">
                Nothing wrong across every client and vendor checked — {data.clientCount} clients, swept{' '}
                {data.checkedAt ? relativeTime(new Date(data.checkedAt).toISOString()) : 'never'}.
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <FunnelPanel data={data} />
              <MoneyPanel data={data} />
            </div>
            <ReconciliationPanel data={data} />
          </>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
            <section className="panel flex flex-col gap-1 p-5">
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <h2 className="font-display text-lg font-semibold tracking-tightish text-fg">Needs attention</h2>
                <div className="flex max-w-[260px] flex-1 items-center justify-end gap-2.5">
                  <SevBar counts={counts} />
                  <span className="meta shrink-0 whitespace-nowrap">
                    {[
                      counts.red ? `${counts.red} breaking` : null,
                      counts.amber ? `${counts.amber} drifting` : null,
                      counts.unknown ? `${counts.unknown} unchecked` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
              </div>

              {visibleGroups.map((g, i) => {
                const worst = SEVERITY_META[g.findings[0].severity];
                return (
                  <div
                    key={g.slug}
                    className={i > 0 ? 'border-t pt-1' : undefined}
                    style={i > 0 ? { borderColor: 'var(--rule)' } : undefined}
                  >
                    <div className="flex items-center gap-2 py-2">
                      <span
                        className="h-[7px] w-[7px] shrink-0 rounded-full"
                        style={{ background: worst.color, boxShadow: `0 0 6px ${worst.color}` }}
                      />
                      <Link
                        href={`/c/${g.slug}/manage/overview`}
                        className="font-display text-[15px] font-semibold tracking-tightish text-fg hover:text-accent"
                      >
                        {g.brandName}
                      </Link>
                      <span className="meta">{summarizeGroup(g.findings)}</span>
                    </div>
                    {g.findings.map((f) => {
                      const meta = SEVERITY_META[f.severity];
                      const Icon = meta.Icon;
                      return (
                        <div
                          key={f.id}
                          className="flex items-start gap-2.5 rounded-md py-2 pl-[17px] pr-0.5 transition-colors hover:bg-[var(--surface)]"
                        >
                          <Icon size={14} weight="fill" style={{ color: meta.color, marginTop: 2, flexShrink: 0 }} />
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px]" style={{ color: 'var(--fg-1)' }}>
                              {f.title}
                            </p>
                            <p className="meta mt-0.5 line-clamp-1">{f.detail}</p>
                          </div>
                          <span className="area-tag shrink-0">{f.area}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {hiddenCount > 0 && (
                <button
                  type="button"
                  className="btn btn-xs mt-2 self-start"
                  onClick={() => setExpanded(true)}
                >
                  Show {hiddenCount} more
                </button>
              )}
            </section>

            <aside className="flex flex-col gap-4">
              <FunnelPanel data={data} />
              <MoneyPanel data={data} />
              <ReconciliationPanel data={data} />
            </aside>
          </div>
        )}
      </div>
    </>
  );
}

function SevBar({ counts }: { counts: { red: number; amber: number; unknown: number } }) {
  return (
    <div className="sev-bar">
      {counts.red > 0 && <span className="s-red" style={{ flexGrow: counts.red }} />}
      {counts.amber > 0 && <span className="s-amber" style={{ flexGrow: counts.amber }} />}
      {counts.unknown > 0 && <span className="s-unknown" style={{ flexGrow: counts.unknown }} />}
    </div>
  );
}

function RailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <span className="meta">{label}</span>
      <span className="font-display text-lg font-semibold tracking-tightish text-fg">{value}</span>
    </div>
  );
}

function FunnelPanel({ data }: { data: BriefingPayload }) {
  return (
    <section className="panel flex flex-col gap-2 p-5">
      <Link href="/leads" className="group -m-1 flex items-center gap-2 rounded-md p-1">
        <FunnelIcon size={16} />
        <h2 className="font-display text-[15px] font-semibold tracking-tightish text-fg transition-colors group-hover:text-accent">
          Funnel
        </h2>
      </Link>
      <div className="grid grid-cols-2 gap-x-3">
        <RailRow label="Leads" value={String(data.funnel.leadsTotal)} />
        <RailRow label="New" value={String(data.funnel.leadsNew)} />
        <RailRow label="Demo calls (7d)" value={String(data.funnel.demoCalls7d)} />
        <RailRow
          label="Call → lead"
          value={data.funnel.callToLeadPct === null ? '—' : `${data.funnel.callToLeadPct}%`}
        />
      </div>
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
  );
}

function MoneyPanel({ data }: { data: BriefingPayload }) {
  return (
    <section className="panel flex flex-col gap-2 p-5">
      <Link href="/clients" className="group -m-1 flex items-center gap-2 rounded-md p-1">
        <CurrencyDollar size={16} />
        <h2 className="font-display text-[15px] font-semibold tracking-tightish text-fg transition-colors group-hover:text-accent">
          Money
        </h2>
        {/* A LABEL, not a warning — running against test keys is the intended state while
            the vendor stack is still being stood up. Turns itself off in live mode. */}
        {data.stripe.mode !== 'live' && (
          <span
            className="rounded-sm border px-1.5 py-0.5 text-2xs font-medium uppercase tracking-wide"
            style={{ borderColor: 'var(--rule)', color: 'var(--fg-3)' }}
            title="Figures below come from Stripe test mode, not live revenue."
          >
            {data.stripe.mode ?? 'no key'}
          </span>
        )}
      </Link>

      {data.stripe.error ? (
        <p className="meta" style={{ color: 'var(--warn)' }}>
          Couldn’t read Stripe ({data.stripe.error}). Revenue is unknown, not zero.
        </p>
      ) : (
        <>
          <RailRow label="MRR" value={money(data.stripe.totalMrrCents)} />
          <RailRow label="Overage billed" value={money(data.money.overageBilledCents)} />
          <p className="meta">
            {money(data.stripe.attributedMrrCents)} tied to a client
            {data.stripe.unattributedCount > 0 && (
              <>
                {' · '}
                <span style={{ color: 'var(--warn)' }}>
                  {money(data.stripe.unattributedCents)} across {data.stripe.unattributedCount} subscription
                  {data.stripe.unattributedCount === 1 ? '' : 's'} matched to no client
                </span>
              </>
            )}
            {data.stripe.truncated && ' · more than 500 active subscriptions — total is partial'}
          </p>
        </>
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
  );
}

function ReconciliationPanel({ data }: { data: BriefingPayload }) {
  if (data.recordsWithoutFolder.length === 0 && data.foldersWithoutRecord.length === 0) return null;
  return (
    <section className="panel flex flex-col gap-2 p-5">
      <h2 className="font-display text-[15px] font-semibold tracking-tightish text-fg">Reconciliation</h2>
      {data.recordsWithoutFolder.length > 0 && (
        <p className="meta">
          {data.recordsWithoutFolder.length} client record
          {data.recordsWithoutFolder.length === 1 ? '' : 's'} with no folder on this machine:{' '}
          {data.recordsWithoutFolder.join(', ')} — provisioned elsewhere, or torn down.
        </p>
      )}
      {data.foldersWithoutRecord.length > 0 && (
        <p className="meta">
          {data.foldersWithoutRecord.length} client
          {data.foldersWithoutRecord.length === 1 ? '' : 's'} with no record, so no lifecycle stage:{' '}
          {data.foldersWithoutRecord.join(', ')} — usually no portal account yet (
          <code className="codechip">npm run link-portal</code>).
        </p>
      )}
    </section>
  );
}
