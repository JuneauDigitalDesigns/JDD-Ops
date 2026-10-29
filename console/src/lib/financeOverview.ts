import 'server-only';
import { getIncomeSnapshot } from './stripeIncome';
import { getFinanceSettings, financeSettingsConfigured } from './financeSettings';
import { financeStoreConfigured, listEntries } from './financeStore';
import { estimateTax, reserveStatus, type ReserveState } from './taxEstimate';
import { TY2026_SETTINGS, type LedgerEntry } from './financeTypes';

/**
 * The /finances headline figures, assembled for the briefing's Money panel.
 *
 * This exists so the briefing shows the SAME numbers /finances leads with, rather than a
 * second, hand-rolled derivation free to drift from it. The month/YTD/reserve math mirrors
 * `FinancesView`'s `monthEstimate` / `ytdEstimate` / `reserveStatus` derivations exactly —
 * same inputs (Stripe income + the KV ledgers + settings), same pure functions from
 * `taxEstimate`.
 *
 * Every source degrades independently, the same posture as `finances/page.tsx`: a Stripe
 * outage or an unconfigured KV must never break the console's front door. When nothing is
 * available at all, `configured` is false and the panel says so instead of showing a
 * confident $0.
 */
export interface FinanceOverview {
  /** False only when neither Stripe income nor the ledger store is available. */
  configured: boolean;
  /** "YYYY-MM" — the month the headline figures are scoped to. */
  month: string;
  /** Net profit this month (monthEstimate.netCents). */
  netThisMonthCents: number;
  /** Tax to set aside this month (monthEstimate.setAsideCents). */
  setAsideThisMonthCents: number;
  /** Net profit year to date (ytdEstimate.netCents). */
  netYtdCents: number;
  reserve: { reservedCents: number; owedCents: number; state: ReserveState };
}

function sumAmounts(entries: LedgerEntry[]): number {
  return entries.reduce((s, e) => s + e.amountCents, 0);
}

export async function getFinanceOverview(): Promise<FinanceOverview> {
  const taxYear = new Date().getFullYear();
  const month = new Date().toISOString().slice(0, 7);

  const empty: FinanceOverview = {
    configured: false,
    month,
    netThisMonthCents: 0,
    setAsideThisMonthCents: 0,
    netYtdCents: 0,
    reserve: { reservedCents: 0, owedCents: 0, state: 'on-track' },
  };

  // Settings always resolve — fall back to the built-in defaults like the finances page does.
  const settings = financeSettingsConfigured()
    ? await getFinanceSettings().catch(() => TY2026_SETTINGS)
    : TY2026_SETTINGS;

  // Income (Stripe) and the ledgers (KV) each degrade on their own. `null` means "source
  // unavailable", distinct from an empty-but-reachable source.
  const income = await getIncomeSnapshot(taxYear).catch(() => null);

  const storeOk = financeStoreConfigured();
  const [expenses, reserve] = storeOk
    ? await Promise.all([
        listEntries('expense').catch(() => [] as LedgerEntry[]),
        listEntries('reserve').catch(() => [] as LedgerEntry[]),
      ])
    : [[] as LedgerEntry[], [] as LedgerEntry[]];

  if (!income && !storeOk) return empty;

  const months = income?.months ?? [];
  const monthFeesCents = months.find((m) => m.month === month)?.feesCents ?? 0;
  const monthGrossCents = months.find((m) => m.month === month)?.grossCents ?? 0;
  const monthExpensesCents = expenses
    .filter((e) => e.date.startsWith(month))
    .reduce((s, e) => s + e.amountCents, 0);

  const monthEstimate = estimateTax(
    { grossCents: monthGrossCents, expensesCents: monthExpensesCents, stripeFeesCents: monthFeesCents },
    settings,
  );

  const ytdGrossCents = months.reduce((s, m) => s + m.grossCents, 0);
  const ytdFeesCents = months.reduce((s, m) => s + m.feesCents, 0);
  const ytdEstimate = estimateTax(
    { grossCents: ytdGrossCents, expensesCents: sumAmounts(expenses), stripeFeesCents: ytdFeesCents },
    settings,
  );

  const status = reserveStatus(sumAmounts(reserve), ytdEstimate.setAsideCents);

  return {
    configured: true,
    month,
    netThisMonthCents: monthEstimate.netCents,
    setAsideThisMonthCents: monthEstimate.setAsideCents,
    netYtdCents: ytdEstimate.netCents,
    reserve: { reservedCents: status.reservedCents, owedCents: status.owedCents, state: status.state },
  };
}
