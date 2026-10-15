'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowClockwise, Copy, Warning } from '@phosphor-icons/react';
import type {
  FinanceSettings,
  IncomeSnapshot,
  LedgerEntry,
  LedgerKind,
} from '@/lib/financeTypes';
import {
  availableToDraw,
  estimateTax,
  quarterlyDueDates,
  reserveStatus,
} from '@/lib/taxEstimate';
import {
  asOf,
  currentMonth,
  money,
  moneyRound,
  monthLabel,
  pct,
  previousMonth,
} from '@/lib/financeFormat';
import LedgerTable from './LedgerTable';
import MonthlyChart, { type ChartPoint } from './MonthlyChart';
import QuarterlyTable from './QuarterlyTable';
import SettingsTab from './SettingsTab';

/**
 * The Finances screen.
 *
 * Four tabs because the page carries four genuinely different jobs — a summary you read, two
 * ledgers you type into, and a configuration surface you touch once a year. One scroll would put
 * the tax constants a thousand pixels below the number that matters.
 *
 * The Overview is scoped to THIS MONTH, with the year as secondary context, because the question
 * the page exists to answer is "what do I move into the tax account now?". The year-to-date
 * figures sit underneath for the "how's the year going" read.
 */

type Tab = 'overview' | 'expenses' | 'draws' | 'settings';

interface Props {
  initialSettings: FinanceSettings;
  initialIncome: IncomeSnapshot;
  initialExpenses: LedgerEntry[];
  initialDraws: LedgerEntry[];
  initialReserve: LedgerEntry[];
  initialErrors: string[];
  stripeConfigured: boolean;
  stripeRestricted: boolean;
}

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'draws', label: 'Draws & Reserve' },
  { id: 'settings', label: 'Settings' },
];

export default function FinancesView(props: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const [settings, setSettings] = useState(props.initialSettings);
  const [income, setIncome] = useState(props.initialIncome);
  const [expenses, setExpenses] = useState(props.initialExpenses);
  const [draws, setDraws] = useState(props.initialDraws);
  const [reserve, setReserve] = useState(props.initialReserve);
  const [filterMonth, setFilterMonth] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>(props.initialErrors);

  const taxYear = income.taxYear;
  const thisMonth = currentMonth();

  /* ── Derived figures ──────────────────────────────────────────────────────────────────── */

  const expensesByMonth = useMemo(() => sumByMonth(expenses), [expenses]);

  /** Per-month rows for the chart: Stripe income against logged expenses plus Stripe's fees. */
  const chartData: ChartPoint[] = useMemo(
    () =>
      income.months.map((m) => {
        const expensesCents = (expensesByMonth.get(m.month) ?? 0) + m.feesCents;
        return {
          month: m.month,
          grossCents: m.grossCents,
          expensesCents,
          netCents: Math.max(0, m.grossCents - expensesCents),
        };
      }),
    [income.months, expensesByMonth],
  );

  /** This month, the headline scope. */
  const monthRow = chartData.find((c) => c.month === thisMonth);
  const monthFees = income.months.find((m) => m.month === thisMonth)?.feesCents ?? 0;
  const monthEstimate = useMemo(
    () =>
      estimateTax(
        {
          grossCents: monthRow?.grossCents ?? 0,
          expensesCents: expensesByMonth.get(thisMonth) ?? 0,
          stripeFeesCents: monthFees,
        },
        settings,
      ),
    [monthRow, expensesByMonth, thisMonth, monthFees, settings],
  );

  /** Year to date — drives the quarterly schedule and the reserve comparison. */
  const ytdEstimate = useMemo(() => {
    const grossCents = income.months.reduce((s, m) => s + m.grossCents, 0);
    const feesCents = income.months.reduce((s, m) => s + m.feesCents, 0);
    const loggedCents = expenses.reduce((s, e) => s + e.amountCents, 0);
    return estimateTax(
      { grossCents, expensesCents: loggedCents, stripeFeesCents: feesCents },
      settings,
    );
  }, [income.months, expenses, settings]);

  const reservedYtd = useMemo(() => reserve.reduce((s, r) => s + r.amountCents, 0), [reserve]);
  const drawnYtd = useMemo(() => draws.reduce((s, d) => s + d.amountCents, 0), [draws]);
  const status = reserveStatus(reservedYtd, ytdEstimate.setAsideCents);
  const available = availableToDraw(ytdEstimate, drawnYtd);
  const quarters = quarterlyDueDates(taxYear, ytdEstimate.setAsideCents);

  /* ── Mutations ────────────────────────────────────────────────────────────────────────── */

  const setFor = (kind: LedgerKind) =>
    kind === 'expense' ? setExpenses : kind === 'draw' ? setDraws : setReserve;

  const endpoint = (kind: LedgerKind) =>
    `/api/finances/${kind === 'expense' ? 'expenses' : kind === 'draw' ? 'draws' : 'reserve'}`;

  const create = useCallback(
    async (kind: LedgerKind, draft: Record<string, unknown>) => {
      const res = await fetch(endpoint(kind), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Could not save that entry.');
      setFor(kind)((prev) => sortEntries([json.entry as LedgerEntry, ...prev]));
    },
    [],
  );

  const patch = useCallback(
    async (kind: LedgerKind, id: string, p: Record<string, unknown>) => {
      const res = await fetch(endpoint(kind), {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, ...p }),
      });
      const json = await res.json();
      if (!res.ok) {
        setNotice(json.error ?? 'Could not save that change.');
        return;
      }
      setFor(kind)((prev) =>
        sortEntries(prev.map((e) => (e.id === id ? (json.entry as LedgerEntry) : e))),
      );
    },
    [],
  );

  const remove = useCallback(async (kind: LedgerKind, id: string) => {
    const res = await fetch(endpoint(kind), {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setNotice(json.error ?? 'Could not delete that entry.');
      return;
    }
    setFor(kind)((prev) => prev.filter((e) => e.id !== id));
  }, []);

  /** Re-pull Stripe, bypassing the cache. */
  const refresh = useCallback(async () => {
    setRefreshing(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/finances/income?year=${taxYear}&refresh=1`);
      const json = await res.json();
      if (json.snapshot) setIncome(json.snapshot as IncomeSnapshot);
      setErrors(json.error ? [json.error as string] : []);
    } catch {
      setNotice('Could not reach Stripe.');
    } finally {
      setRefreshing(false);
    }
  }, [taxYear]);

  /** Duplicate last month's expenses into this one. Confirmed first — it is not idempotent. */
  const copyLastMonth = useCallback(async () => {
    const from = previousMonth(thisMonth);
    const count = expenses.filter((e) => e.date.startsWith(from)).length;
    if (count === 0) {
      setNotice(`Nothing logged in ${monthLabel(from)} to copy.`);
      return;
    }
    if (
      !window.confirm(
        `Copy ${count} ${count === 1 ? 'expense' : 'expenses'} from ${monthLabel(from)} into ${monthLabel(thisMonth)}?`,
      )
    ) {
      return;
    }
    const res = await fetch('/api/finances/income', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'copy-month', fromMonth: from, toMonth: thisMonth }),
    });
    const json = await res.json();
    if (!res.ok) {
      setNotice(json.error ?? 'Could not copy those expenses.');
      return;
    }
    setExpenses((prev) => sortEntries([...(json.created as LedgerEntry[]), ...prev]));
    setNotice(`Copied ${json.count} into ${monthLabel(thisMonth)}.`);
  }, [expenses, thisMonth]);

  // A month filter set from the chart only makes sense on the ledger tabs; clear it when the
  // operator lands somewhere it has no visible effect, so it can't silently hide rows later.
  useEffect(() => {
    if (tab === 'settings') setFilterMonth(null);
  }, [tab]);

  /* ── Render ───────────────────────────────────────────────────────────────────────────── */

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
      <header className="mb-6">
        <p className="kicker text-fg3">Juneau Digital Designs</p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-display text-3xl tracking-tight">Finances</h1>
          <div className="flex items-center gap-2">
            <span className="meta text-fg3">
              {income.fetchedAt ? `as of ${asOf(income.fetchedAt)}` : 'not loaded'}
            </span>
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              className="btn btn-sm flex items-center gap-1.5 disabled:opacity-50"
              title="Re-read income from Stripe"
            >
              <ArrowClockwise size={13} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Refreshing' : 'Refresh'}
            </button>
          </div>
        </div>
      </header>

      {errors.map((e) => (
        <Banner key={e} tone="warn">
          {e}
        </Banner>
      ))}
      {notice && (
        <Banner tone="info" onDismiss={() => setNotice(null)}>
          {notice}
        </Banner>
      )}

      <nav className="mb-7 flex gap-1 border-b border-rule" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
              tab === t.id
                ? 'border-[var(--accent)] font-medium text-fg'
                : 'border-transparent text-fg3 hover:text-fg2'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'overview' && (
        <Overview
          thisMonth={thisMonth}
          monthEstimate={monthEstimate}
          ytdEstimate={ytdEstimate}
          status={status}
          chartData={chartData}
          filterMonth={filterMonth}
          onSelectMonth={(m) => {
            setFilterMonth(m);
            if (m) setTab('expenses');
          }}
          quarters={quarters}
          taxYear={taxYear}
        />
      )}

      {tab === 'expenses' && (
        <Section
          title="Expenses"
          subtitle="What it costs to run the business. These reduce your taxable profit."
          action={
            <button
              type="button"
              onClick={copyLastMonth}
              className="btn btn-sm flex items-center gap-1.5"
              title={`Duplicate ${monthLabel(previousMonth(thisMonth))} into ${monthLabel(thisMonth)}`}
            >
              <Copy size={13} />
              Copy last month
            </button>
          }
          filterMonth={filterMonth}
          onClearFilter={() => setFilterMonth(null)}
        >
          <LedgerTable
            kind="expense"
            entries={expenses}
            categories={settings.categories}
            stripeFeesCents={
              filterMonth
                ? (income.months.find((m) => m.month === filterMonth)?.feesCents ?? 0)
                : income.months.reduce((s, m) => s + m.feesCents, 0)
            }
            filterMonth={filterMonth}
            onCreate={(d) => create('expense', d)}
            onPatch={(id, p) => patch('expense', id, p)}
            onDelete={(id) => remove('expense', id)}
            emptyHint="No expenses logged yet. Add one above — software, hosting, contractors, anything the business pays for."
          />
        </Section>
      )}

      {tab === 'draws' && (
        <DrawsAndReserve
          draws={draws}
          reserve={reserve}
          status={status}
          available={available}
          drawnYtd={drawnYtd}
          filterMonth={filterMonth}
          onClearFilter={() => setFilterMonth(null)}
          onCreate={create}
          onPatch={patch}
          onDelete={remove}
        />
      )}

      {tab === 'settings' && (
        <SettingsTab
          settings={settings}
          onSaved={setSettings}
          stripeConfigured={props.stripeConfigured}
          stripeRestricted={props.stripeRestricted}
        />
      )}
    </div>
  );
}

/* ── Overview ───────────────────────────────────────────────────────────────────────────── */

function Overview({
  thisMonth,
  monthEstimate,
  ytdEstimate,
  status,
  chartData,
  filterMonth,
  onSelectMonth,
  quarters,
  taxYear,
}: {
  thisMonth: string;
  monthEstimate: ReturnType<typeof estimateTax>;
  ytdEstimate: ReturnType<typeof estimateTax>;
  status: ReturnType<typeof reserveStatus>;
  chartData: ChartPoint[];
  filterMonth: string | null;
  onSelectMonth: (m: string | null) => void;
  quarters: ReturnType<typeof quarterlyDueDates>;
  taxYear: number;
}) {
  return (
    <div className="space-y-10">
      {/* The headline. Net profit first — how the business is doing — with the obligation
          immediately beneath it, because that's the number that prompts an action. */}
      <section>
        <p className="kicker mb-1 text-fg3">{monthLabel(thisMonth)}</p>
        <p className="font-display text-5xl tracking-tight tabular-nums">
          {moneyRound(monthEstimate.netCents)}
        </p>
        <p className="mt-1 text-sm text-fg2">net profit this month</p>

        <div className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-rule pt-5">
          <span className="font-display text-3xl tabular-nums">
            {moneyRound(monthEstimate.setAsideCents)}
          </span>
          <span className="text-sm text-fg2">to set aside for taxes</span>
          {monthEstimate.netCents > 0 && (
            <span className="meta rounded border border-rule px-1.5 py-0.5 text-fg3">
              {pct(monthEstimate.setAsidePctOfNet)} of net profit
            </span>
          )}
        </div>
        <p className="meta mt-2 text-fg3">
          Rule of thumb is ~20% of net profit. Estimate for planning only — not tax advice.
          Confirm with a CPA.
        </p>

        <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-3 border-t border-rule pt-5 sm:grid-cols-4">
          <Stat label="Income" value={money(monthEstimate.grossCents)} />
          <Stat label="Expenses" value={money(monthEstimate.expensesCents)} />
          <Stat label="Self-employment tax" value={money(monthEstimate.seTaxCents)} />
          <Stat label="Federal income tax" value={money(monthEstimate.incomeTaxCents)} />
        </dl>
      </section>

      {/* Reserve status — the point of tracking actual transfers. */}
      <section>
        <h2 className="mb-3 text-xl">Tax reserve</h2>
        <div className="panel p-5">
          <p className="text-2xl tabular-nums">
            {money(status.reservedCents)}{' '}
            <span className="text-sm text-fg2">
              of {money(status.owedCents)} owed year to date
            </span>
          </p>
          <p
            className={`mt-2 text-sm ${
              status.state === 'behind'
                ? 'text-danger'
                : status.state === 'ahead'
                  ? 'text-ok'
                  : 'text-fg2'
            }`}
          >
            {status.state === 'behind'
              ? `${money(-status.differenceCents)} short`
              : status.state === 'ahead'
                ? `${money(status.differenceCents)} ahead`
                : 'On track'}
          </p>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-xl">Income and expenses</h2>
          {filterMonth && (
            <button
              type="button"
              onClick={() => onSelectMonth(null)}
              className="meta text-fg3 underline underline-offset-2 hover:text-fg"
            >
              showing {monthLabel(filterMonth)} ×
            </button>
          )}
        </div>
        <MonthlyChart
          data={chartData}
          selectedMonth={filterMonth}
          onSelectMonth={onSelectMonth}
        />
      </section>

      <section>
        <h2 className="mb-3 text-xl">Quarterly estimated payments</h2>
        <QuarterlyTable quarters={quarters} taxYear={taxYear} />
      </section>

      <section>
        <h2 className="mb-3 text-xl">Year to date</h2>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3 border-t border-rule pt-5 sm:grid-cols-4">
          <Stat label="Gross income" value={money(ytdEstimate.grossCents)} />
          <Stat label="Expenses" value={money(ytdEstimate.expensesCents)} />
          <Stat label="Net profit" value={money(ytdEstimate.netCents)} />
          <Stat label="Tax owed" value={money(ytdEstimate.setAsideCents)} />
        </dl>
        {ytdEstimate.qbiLimitsApply && (
          <Banner tone="warn">
            Taxable income has passed the §199A threshold, where the QBI deduction starts to be
            limited by business type and W-2 wages. This page does not model those limits, so the
            estimate may be low. Worth a CPA conversation.
          </Banner>
        )}
      </section>
    </div>
  );
}

/* ── Draws & Reserve ────────────────────────────────────────────────────────────────────── */

function DrawsAndReserve({
  draws,
  reserve,
  status,
  available,
  drawnYtd,
  filterMonth,
  onClearFilter,
  onCreate,
  onPatch,
  onDelete,
}: {
  draws: LedgerEntry[];
  reserve: LedgerEntry[];
  status: ReturnType<typeof reserveStatus>;
  available: number;
  drawnYtd: number;
  filterMonth: string | null;
  onClearFilter: () => void;
  onCreate: (k: LedgerKind, d: Record<string, unknown>) => Promise<void>;
  onPatch: (k: LedgerKind, id: string, p: Record<string, unknown>) => Promise<void>;
  onDelete: (k: LedgerKind, id: string) => Promise<void>;
}) {
  return (
    <div className="space-y-10">
      {/* Stated up front, because it is the one thing about this page that is easy to get wrong
          and expensive to get wrong. */}
      <Banner tone="info">
        Draws and reserve transfers are <strong>not business expenses</strong>. Moving money to
        yourself or into savings doesn&rsquo;t reduce your taxable profit — a sole proprietor is
        taxed on profit whether or not it&rsquo;s withdrawn. They&rsquo;re tracked here for your
        own records and never enter the tax calculation.
      </Banner>

      <section>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
          <Stat label="Drawn year to date" value={money(drawnYtd)} />
          <Stat label="Reserved for taxes" value={money(status.reservedCents)} />
          <Stat
            label="Available to draw"
            value={money(Math.max(0, available))}
            hint={available < 0 ? 'over-drawn against profit' : undefined}
          />
        </dl>
      </section>

      <Section
        title="Owner's draws"
        subtitle="Money you've paid yourself out of the business."
        filterMonth={filterMonth}
        onClearFilter={onClearFilter}
      >
        <LedgerTable
          kind="draw"
          entries={draws}
          categories={[]}
          filterMonth={filterMonth}
          onCreate={(d) => onCreate('draw', d)}
          onPatch={(id, p) => onPatch('draw', id, p)}
          onDelete={(id) => onDelete('draw', id)}
          emptyHint="No draws logged yet."
        />
      </Section>

      <Section
        title="Tax reserve transfers"
        subtitle="Money moved into your tax savings account."
        filterMonth={filterMonth}
        onClearFilter={onClearFilter}
      >
        <LedgerTable
          kind="reserve"
          entries={reserve}
          categories={[]}
          filterMonth={filterMonth}
          onCreate={(d) => onCreate('reserve', d)}
          onPatch={(id, p) => onPatch('reserve', id, p)}
          onDelete={(id) => onDelete('reserve', id)}
          emptyHint="No transfers logged yet."
        />
      </Section>
    </div>
  );
}

/* ── Shared bits ────────────────────────────────────────────────────────────────────────── */

function Section({
  title,
  subtitle,
  action,
  filterMonth,
  onClearFilter,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  filterMonth?: string | null;
  onClearFilter?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-fg3">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {filterMonth && onClearFilter && (
            <button
              type="button"
              onClick={onClearFilter}
              className="meta rounded border border-rule px-2 py-1 text-fg3 hover:text-fg"
            >
              showing {monthLabel(filterMonth)} ×
            </button>
          )}
          {action}
        </div>
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt className="meta uppercase tracking-wide text-fg3">{label}</dt>
      <dd className="mt-0.5 text-lg tabular-nums">{value}</dd>
      {hint && <p className="meta mt-0.5 text-danger">{hint}</p>}
    </div>
  );
}

function Banner({
  tone,
  children,
  onDismiss,
}: {
  tone: 'warn' | 'info';
  children: React.ReactNode;
  onDismiss?: () => void;
}) {
  return (
    <div
      className={`mb-4 flex items-start gap-2.5 rounded-[10px] border px-4 py-3 text-xs leading-relaxed ${
        tone === 'warn'
          ? 'border-[var(--warn)] bg-[var(--surface-2)] text-fg'
          : 'border-rule bg-[var(--surface-2)] text-fg2'
      }`}
    >
      {tone === 'warn' && <Warning size={15} className="mt-0.5 shrink-0" />}
      <div className="flex-1">{children}</div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-fg3 hover:text-fg"
          aria-label="Dismiss"
        >
          ×
        </button>
      )}
    </div>
  );
}

/* ── helpers ────────────────────────────────────────────────────────────────────────────── */

function sumByMonth(entries: LedgerEntry[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of entries) {
    const m = e.date.slice(0, 7);
    out.set(m, (out.get(m) ?? 0) + e.amountCents);
  }
  return out;
}

/** Newest first, matching the server's index order so optimistic inserts don't jump around. */
function sortEntries(entries: LedgerEntry[]): LedgerEntry[] {
  return [...entries].sort((a, b) => b.date.localeCompare(a.date));
}
