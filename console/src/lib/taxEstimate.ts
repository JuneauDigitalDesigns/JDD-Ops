/**
 * The tax math. Pure functions, integer cents, no I/O.
 *
 * Deliberately importable from anywhere — no `server-only`, no Redis, no Stripe. Everything it
 * needs arrives as arguments, which is what makes it testable against the worked figures in
 * scripts/test-tax-estimate.ts without standing up KV or a Stripe key.
 *
 * ── What this models ────────────────────────────────────────────────────────────────────────
 *
 * A sole proprietor filing single in Florida. Two federal taxes apply and one state tax does not:
 *
 *   1. Self-employment tax — 15.3% on 92.35% of net profit. At small incomes this DOMINATES,
 *      because the standard deduction erases most income tax but does nothing for SE tax. On
 *      $24k of net profit it is roughly $3,391 of SE tax against $496 of income tax.
 *   2. Federal income tax — ordinary brackets on what survives the half-SE deduction, the
 *      standard deduction, and the §199A QBI deduction.
 *   3. Florida levies no individual income tax, so the state rate is 0. It is still a named
 *      setting rather than a hardcoded zero, so relocating is a settings change, not a rewrite.
 *
 * ── What this deliberately does NOT model ───────────────────────────────────────────────────
 *
 * Owner's draws and tax-reserve transfers. Neither is a deductible expense (see financeTypes.ts),
 * and there is intentionally no parameter here one could be passed through — the separation is
 * enforced by the signature, not by a comment asking callers to be careful.
 *
 * Also unmodelled: the §199A SSTB and W-2-wage limitations that phase in above the QBI
 * threshold. Rather than silently under-taxing someone who crosses it, the result carries
 * `qbiLimitsApply` so the UI can warn.
 *
 * Every rate and threshold comes from FinanceSettings, which the owner can correct from the
 * Settings tab. Constants that drive what someone sends the IRS should not need a code deploy
 * to fix, and they change every single tax year.
 */

import type { Cents, FinanceSettings, TaxEstimate } from './financeTypes';

/** Round to whole cents. Money is integers here; this is the only place fractions are resolved. */
function r(n: number): Cents {
  return Math.round(n);
}

/**
 * Federal income tax from a bracket table in the IRS's base-plus-excess form.
 *
 * Walks down to the last row whose lower edge the income clears, rather than accumulating each
 * band, so the arithmetic mirrors the published table one row at a time and a mistyped bracket
 * shows up as a wrong answer in exactly one band instead of smearing across all of them.
 */
export function applyBrackets(taxableCents: Cents, brackets: FinanceSettings['brackets']): Cents {
  if (taxableCents <= 0 || brackets.length === 0) return 0;

  let row = brackets[0];
  for (const b of brackets) {
    if (taxableCents > b.overCents) row = b;
    else break;
  }
  return r(row.baseCents + (taxableCents - row.overCents) * row.rate);
}

export interface TaxInputs {
  /** Gross revenue — Stripe charges less refunds, before Stripe's cut. */
  grossCents: Cents;
  /** Hand-logged business expenses for the period. */
  expensesCents: Cents;
  /** Stripe's fees for the period. A real deductible cost, so it joins the expense side. */
  stripeFeesCents: Cents;
}

/**
 * The whole estimate for one period.
 *
 * Note the deduction ordering, which is not arbitrary: the deductible half of SE tax comes off
 * before the standard deduction and before QBI, and QBI is capped by taxable income computed
 * *before* QBI itself. Getting that order wrong inflates the deduction and understates the tax.
 */
export function estimateTax(inputs: TaxInputs, s: FinanceSettings): TaxEstimate {
  const grossCents = Math.max(0, inputs.grossCents);
  const expensesCents = Math.max(0, inputs.expensesCents) + Math.max(0, inputs.stripeFeesCents);
  const netCents = Math.max(0, grossCents - expensesCents);

  // ── Self-employment tax ──────────────────────────────────────────────────────────────────
  // Only 92.35% of net profit is subject to SE tax — the statutory stand-in for the employer's
  // half, which an employee would never have had in their wage base to begin with.
  const seBaseCents = r(netCents * s.seBaseMultiplier);

  // Social Security stops at the wage base; Medicare never does.
  const socialSecurityCents = r(
    Math.min(seBaseCents, s.ssWageBaseCents) * s.seSocialSecurityRate,
  );
  const medicareCents = r(seBaseCents * s.seMedicareRate);
  const additionalMedicareCents = r(
    Math.max(0, seBaseCents - s.additionalMedicareThresholdCents) * s.additionalMedicareRate,
  );

  const seTaxCents = socialSecurityCents + medicareCents + additionalMedicareCents;
  const halfSeCents = r(seTaxCents / 2);

  // ── QBI (§199A) ──────────────────────────────────────────────────────────────────────────
  // QBI is net business income reduced by the deductible half of SE tax, and the deduction is
  // capped at 20% of taxable income computed before it.
  const qbiBaseCents = Math.max(0, netCents - halfSeCents);
  const preQbiTaxableCents = Math.max(0, netCents - halfSeCents - s.standardDeductionCents);

  let qbiDeductionCents: Cents;
  if (qbiBaseCents < s.qbiEligibilityFloorCents) {
    // The OBBBA gates the deduction behind a minimum amount of qualified business income.
    // Below it there is no deduction at all — importantly, NOT a reduced one and NOT the $400
    // floor, which only applies once you are eligible.
    qbiDeductionCents = 0;
  } else {
    qbiDeductionCents = r(Math.min(qbiBaseCents * s.qbiRate, preQbiTaxableCents * s.qbiRate));
    qbiDeductionCents = Math.max(qbiDeductionCents, s.qbiMinimumCents);
    // The floor can exceed what is left to deduct against; never create negative taxable income.
    qbiDeductionCents = Math.min(qbiDeductionCents, preQbiTaxableCents);
  }

  // ── Income tax ───────────────────────────────────────────────────────────────────────────
  const taxableIncomeCents = Math.max(0, preQbiTaxableCents - qbiDeductionCents);
  const incomeTaxCents = applyBrackets(taxableIncomeCents, s.brackets);
  const stateTaxCents = r(taxableIncomeCents * s.stateIncomeTaxRate);

  const setAsideCents = seTaxCents + incomeTaxCents + stateTaxCents;

  return {
    grossCents,
    expensesCents,
    netCents,
    seBaseCents,
    socialSecurityCents,
    medicareCents,
    additionalMedicareCents,
    seTaxCents,
    halfSeCents,
    qbiDeductionCents,
    taxableIncomeCents,
    incomeTaxCents,
    stateTaxCents,
    setAsideCents,
    setAsidePctOfNet: netCents > 0 ? setAsideCents / netCents : 0,
    setAsidePctOfGross: grossCents > 0 ? setAsideCents / grossCents : 0,
    qbiLimitsApply: preQbiTaxableCents > s.qbiThresholdCents,
  };
}

/* ────────────────────────────────────────────────────────────────────────────────────────────
 * Quarterly estimated payments
 * ──────────────────────────────────────────────────────────────────────────────────────────── */

export interface QuarterDue {
  quarter: 1 | 2 | 3 | 4;
  /** ISO date the payment is due, already shifted off weekends. */
  dueDate: string;
  amountCents: Cents;
  /** True once the due date has passed. */
  past: boolean;
}

/**
 * Nudge a date off Saturday/Sunday to the following Monday.
 *
 * The IRS rule also covers federal holidays, which this does not enumerate — a holiday table
 * would need maintaining every year and would rot silently. Weekends cover the common case and
 * are always correct when they fire; the Quarterly tab tells the owner to confirm against the
 * IRS calendar, which is the honest division of labour for a planning tool.
 */
function nextBusinessDay(y: number, m: number, d: number): string {
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay();
  if (day === 6) dt.setUTCDate(dt.getUTCDate() + 2);
  else if (day === 0) dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
}

/**
 * The four federal estimated-payment deadlines for a tax year, with the annual set-aside split
 * evenly across them.
 *
 * Q4 falls in January of the FOLLOWING calendar year — a detail worth stating because it is the
 * one people miss when they think of the tax year as self-contained.
 *
 * The even split is deliberate and is what a planning tool should do: it is the steady monthly
 * habit this page exists to support. It is not the annualized-income method, which can lower
 * what is actually owed for a quarter when income is lumpy.
 */
export function quarterlyDueDates(taxYear: number, annualSetAsideCents: Cents): QuarterDue[] {
  const per = Math.round(annualSetAsideCents / 4);
  const today = new Date().toISOString().slice(0, 10);

  const spec: Array<{ q: 1 | 2 | 3 | 4; y: number; m: number; d: number }> = [
    { q: 1, y: taxYear, m: 4, d: 15 },
    { q: 2, y: taxYear, m: 6, d: 15 },
    { q: 3, y: taxYear, m: 9, d: 15 },
    { q: 4, y: taxYear + 1, m: 1, d: 15 },
  ];

  return spec.map(({ q, y, m, d }) => {
    const dueDate = nextBusinessDay(y, m, d);
    return { quarter: q, dueDate, amountCents: per, past: dueDate < today };
  });
}

/* ────────────────────────────────────────────────────────────────────────────────────────────
 * Reserve tracking — informational only, never an input to the tax math
 * ──────────────────────────────────────────────────────────────────────────────────────────── */

export type ReserveState = 'ahead' | 'on-track' | 'behind';

export interface ReserveStatus {
  reservedCents: Cents;
  owedCents: Cents;
  /** Positive = ahead, negative = short. */
  differenceCents: Cents;
  state: ReserveState;
}

/**
 * How the tax-savings account compares to what has actually been earned so far.
 *
 * Within a dollar either way counts as on track — a cents-level gap is noise, and a page that
 * says "behind" over $0.004 trains you to ignore it.
 */
export function reserveStatus(reservedCents: Cents, owedCents: Cents): ReserveStatus {
  const differenceCents = reservedCents - owedCents;
  const state: ReserveState =
    Math.abs(differenceCents) <= 100 ? 'on-track' : differenceCents > 0 ? 'ahead' : 'behind';
  return { reservedCents, owedCents, differenceCents, state };
}

/**
 * What is genuinely free to pay yourself: profit, less the tax you must still hold back, less
 * what you have already drawn.
 *
 * Reserve transfers are intentionally absent. Money moved to the tax account is already spoken
 * for by `setAsideCents`; subtracting it again would double-count the same obligation and make
 * the figure drift further negative with every transfer.
 */
export function availableToDraw(
  estimate: Pick<TaxEstimate, 'netCents' | 'setAsideCents'>,
  drawsTakenCents: Cents,
): Cents {
  return estimate.netCents - estimate.setAsideCents - drawsTakenCents;
}
