import FinancesView from '@/components/finances/FinancesView';
import { getFinanceSettings, financeSettingsConfigured } from '@/lib/financeSettings';
import { financeStoreConfigured, listEntries } from '@/lib/financeStore';
import {
  StripeNotConfiguredError,
  StripeScopeError,
  getIncomeSnapshot,
} from '@/lib/stripeIncome';
import { TY2026_SETTINGS, type IncomeSnapshot, type LedgerEntry } from '@/lib/financeTypes';
import { loadStripeKey } from '@/lib/opsSecrets';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Finances — JDD Console',
};

/**
 * Server-rendered first paint for /finances.
 *
 * Everything is loaded here rather than fetched from the client on mount so the headline figure
 * is correct in the first frame — a tax number that flashes $0 and then corrects itself is worse
 * than a slightly slower page.
 *
 * Every source degrades independently. Stripe being unreachable must not cost the operator
 * access to their expense ledger, and KV being unconfigured must not hide the income chart. Each
 * failure contributes a message to `errors` and its own empty value, and the page renders.
 */
export default async function FinancesPage() {
  const taxYear = new Date().getFullYear();
  const errors: string[] = [];

  const settings = financeSettingsConfigured()
    ? await getFinanceSettings().catch((e) => {
        console.error('[finances] settings read failed', e);
        errors.push('Could not read settings; showing the built-in TY2026 defaults.');
        return TY2026_SETTINGS;
      })
    : TY2026_SETTINGS;

  let expenses: LedgerEntry[] = [];
  let draws: LedgerEntry[] = [];
  let reserve: LedgerEntry[] = [];

  if (financeStoreConfigured()) {
    const [e, d, r] = await Promise.all([
      listEntries('expense').catch(() => null),
      listEntries('draw').catch(() => null),
      listEntries('reserve').catch(() => null),
    ]);
    if (e === null || d === null || r === null) {
      errors.push('Could not read one or more ledgers from storage. Check the server log.');
    }
    expenses = e ?? [];
    draws = d ?? [];
    reserve = r ?? [];
  } else {
    errors.push(
      'Finances storage not configured — set KV_REST_API_URL and KV_REST_API_TOKEN in ' +
        'console/.env.local (the same pair the lead queue uses). Expenses, draws and reserve ' +
        'transfers cannot be saved until then.',
    );
  }

  const { key, restricted } = loadStripeKey();

  let income: IncomeSnapshot = {
    taxYear,
    months: Array.from({ length: 12 }, (_, i) => ({
      month: `${taxYear}-${String(i + 1).padStart(2, '0')}`,
      grossCents: 0,
      feesCents: 0,
    })),
    fetchedAt: 0,
    restricted,
  };

  try {
    income = await getIncomeSnapshot(taxYear);
  } catch (e) {
    if (e instanceof StripeScopeError || e instanceof StripeNotConfiguredError) {
      errors.push(e.message);
    } else {
      console.error('[finances] income read failed', e);
      errors.push('Could not read income from Stripe. Check the server log.');
    }
  }

  return (
    <FinancesView
      initialSettings={settings}
      initialIncome={income}
      initialExpenses={expenses}
      initialDraws={draws}
      initialReserve={reserve}
      initialErrors={errors}
      stripeConfigured={Boolean(key)}
      stripeRestricted={restricted}
    />
  );
}
