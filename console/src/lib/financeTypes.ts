/**
 * The finance wire shapes — expenses, owner's draws, tax-reserve transfers, and the tax settings.
 *
 * Split out of financeStore.ts for the same reason leadTypes.ts is split out of leadQueue.ts:
 * that file is `server-only` because it holds the Redis client, and several of the values here
 * (DEFAULT_CATEGORIES, the TY2026 settings) are runtime VALUES the client components need.
 * Types alone would erase; the arrays and objects do not.
 *
 * ── The one rule that governs this whole feature ────────────────────────────────────────────
 *
 * An **expense** reduces taxable profit. A **draw** and a **reserve transfer** do not.
 *
 * A sole proprietor is taxed on net profit whether or not they take the money out, so paying
 * yourself is not a deductible cost — it is the owner moving their own money. The same goes for
 * parking cash in a tax-savings account. Letting either leak into the expense total would
 * understate tax owed, which is the one failure mode this page exists to prevent.
 *
 * That is why `Expense` is the only ledger shape carrying a category, and why `taxEstimate()`
 * accepts income and expenses but has no parameter a draw could be passed through.
 */

/** Money is integer cents everywhere in this feature. Format to dollars only at the render edge. */
export type Cents = number;

/** The three ledgers. Only expenses affect tax; see the module note above. */
export type LedgerKind = 'expense' | 'draw' | 'reserve';

export const LEDGER_KINDS: LedgerKind[] = ['expense', 'draw', 'reserve'];

export interface LedgerEntry {
  id: string;
  /** ISO date (YYYY-MM-DD) of the EVENT — the tax-relevant date, not when it was typed in. */
  date: string;
  amountCents: Cents;
  note?: string;
  /** Expenses only. Validated against settings.categories. */
  category?: string;
  /** ISO timestamp, when the row was logged. */
  createdAt: string;
}

export const DEFAULT_CATEGORIES: string[] = [
  'software',
  'hosting',
  'hardware',
  'contractors',
  'fees',
  'marketing',
  'office',
  'other',
];

/**
 * One bracket row, in the IRS's own base-plus-excess form so it can be checked line-for-line
 * against the Revenue Procedure's rate table rather than re-derived.
 *
 *   "Over $12,400 but not over $50,400 — $1,240 plus 12% of the excess over $12,400"
 *      → { overCents: 1_240_000, baseCents: 124_000, rate: 0.12 }
 *
 * `overCents` is the lower edge, so the first row is always `overCents: 0, baseCents: 0`.
 */
export interface TaxBracket {
  overCents: Cents;
  baseCents: Cents;
  rate: number;
}

/**
 * Every constant the estimate depends on, editable from the Settings tab.
 *
 * These live in KV rather than as module constants because they change every single tax year,
 * and a number that drives what you send the IRS should be correctable without a code deploy.
 */
export interface FinanceSettings {
  taxYear: number;

  // Deductions and thresholds
  standardDeductionCents: Cents;
  ssWageBaseCents: Cents;
  qbiThresholdCents: Cents;
  qbiMinimumCents: Cents;
  qbiEligibilityFloorCents: Cents;
  additionalMedicareThresholdCents: Cents;

  // Rates
  brackets: TaxBracket[];
  seBaseMultiplier: number;
  seSocialSecurityRate: number;
  seMedicareRate: number;
  additionalMedicareRate: number;
  qbiRate: number;
  stateIncomeTaxRate: number;

  categories: string[];
}

/**
 * Tax-year 2026, single filer, Florida.
 *
 * ⚠️ Verified against primary sources — do not "correct" these from memory:
 *   • Standard deduction $16,100 ............. Rev. Proc. 2025-32 §4.14(1)
 *   • Bracket table .......................... Rev. Proc. 2025-32 §4.01, TABLE 3
 *                                              (Unmarried Individuals other than Surviving
 *                                               Spouses and Heads of Households)
 *   • QBI threshold $201,750 ................. Rev. Proc. 2025-32 §4.26 ("All Other Returns")
 *   • QBI $400 minimum / $1,000 eligibility .. Rev. Proc. 2025-32 §2.12 (OBBBA §70105 → §199A(i));
 *                                              both inflation-adjust only AFTER 2026
 *   • SS wage base $184,500 .................. SSA 2026 COLA fact sheet
 *   • Additional Medicare 0.9% over $200,000 . SSA 2026 COLA fact sheet
 *   • Florida has no individual income tax ... rate 0
 *
 * Review annually. When the tax year rolls over, these need re-checking against that year's
 * Revenue Procedure — the Settings tab says so on screen.
 */
export const TY2026_SETTINGS: FinanceSettings = {
  taxYear: 2026,

  standardDeductionCents: 1_610_000, //  $16,100
  ssWageBaseCents: 18_450_000, // $184,500
  qbiThresholdCents: 20_175_000, // $201,750
  qbiMinimumCents: 40_000, //     $400
  qbiEligibilityFloorCents: 100_000, //   $1,000
  additionalMedicareThresholdCents: 20_000_000, // $200,000

  // Rev. Proc. 2025-32 §4.01 TABLE 3 — 2026, unmarried individuals.
  brackets: [
    { overCents: 0, baseCents: 0, rate: 0.1 },
    { overCents: 1_240_000, baseCents: 124_000, rate: 0.12 }, //      $12,400 → $1,240 + 12%
    { overCents: 5_040_000, baseCents: 580_000, rate: 0.22 }, //      $50,400 → $5,800 + 22%
    { overCents: 10_570_000, baseCents: 1_796_600, rate: 0.24 }, //  $105,700 → $17,966 + 24%
    { overCents: 20_177_500, baseCents: 4_102_400, rate: 0.32 }, //  $201,775 → $41,024 + 32%
    { overCents: 25_622_500, baseCents: 5_844_800, rate: 0.35 }, //  $256,225 → $58,448 + 35%
    { overCents: 64_060_000, baseCents: 19_297_925, rate: 0.37 }, // $640,600 → $192,979.25 + 37%
  ],

  seBaseMultiplier: 0.9235,
  seSocialSecurityRate: 0.124,
  seMedicareRate: 0.029,
  additionalMedicareRate: 0.009,
  qbiRate: 0.2,
  stateIncomeTaxRate: 0, // Florida

  categories: [...DEFAULT_CATEGORIES],
};

/** One calendar month of income, as aggregated from Stripe. */
export interface MonthIncome {
  /** YYYY-MM */
  month: string;
  /** Gross charges less refunds, BEFORE Stripe's cut. This is the reportable revenue figure. */
  grossCents: Cents;
  /** Stripe's fees for the month — a deductible business expense, computed not stored. */
  feesCents: Cents;
}

export interface IncomeSnapshot {
  taxYear: number;
  months: MonthIncome[];
  /** Epoch ms the underlying Stripe read happened — drives the "as of" stamp. */
  fetchedAt: number;
  /** True when a restricted (read-only) Stripe key served this. Surfaced in Settings. */
  restricted: boolean;
}

/** What `estimateTax` returns. Every field is cents unless named a rate/pct. */
export interface TaxEstimate {
  grossCents: Cents;
  expensesCents: Cents;
  netCents: Cents;

  seBaseCents: Cents;
  socialSecurityCents: Cents;
  medicareCents: Cents;
  additionalMedicareCents: Cents;
  seTaxCents: Cents;
  halfSeCents: Cents;

  qbiDeductionCents: Cents;
  taxableIncomeCents: Cents;
  incomeTaxCents: Cents;
  stateTaxCents: Cents;

  setAsideCents: Cents;
  /**
   * PRIMARY percentage: set-aside over NET PROFIT. This is what the "~20% rule of thumb" means.
   * Against gross revenue the same dollars read about 3 points lower, which is why both exist
   * and why neither is ever rendered as a bare "16%" without saying of what.
   */
  setAsidePctOfNet: number;
  setAsidePctOfGross: number;
  /** True when taxable income cleared the QBI threshold and the SSTB/W-2 limits would apply. */
  qbiLimitsApply: boolean;
}
