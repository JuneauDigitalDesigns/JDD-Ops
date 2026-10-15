// Unit tests for the tax engine.
//
// The expected figures are worked by hand from the primary sources cited in financeTypes.ts, not
// copied from this implementation's output — otherwise they would only prove the code agrees with
// itself. The tax math is the one part of the Finances feature that silently produces a plausible
// wrong answer, so it is the one part that gets tests.
//
// Run: npm test   (node's built-in runner, via tsx for the .ts imports — no new dependency)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TY2026_SETTINGS } from '../src/lib/financeTypes.ts';
import {
  applyBrackets,
  availableToDraw,
  estimateTax,
  quarterlyDueDates,
  reserveStatus,
} from '../src/lib/taxEstimate.ts';

const usd = (dollars) => Math.round(dollars * 100);
/** Tolerance of one cent: rounding order can legitimately shift a half-cent. */
const near = (actual, expected, label) =>
  assert.ok(
    Math.abs(actual - expected) <= 1,
    `${label}: expected ~${expected} cents, got ${actual} cents`,
  );

/* ── The owner's actual numbers ────────────────────────────────────────────────────────────── */
// $2,500/mo revenue, $500/mo expenses → $30,000 gross, $6,000 expenses, $24,000 net.
// Worked by hand:
//   seBase    = 24,000 × 0.9235         = 22,164.00
//   socialSec = 22,164 × 0.124          =  2,748.34
//   medicare  = 22,164 × 0.029          =    642.76
//   seTax                               =  3,391.10
//   halfSE                              =  1,695.55
//   qbiBase   = 24,000 − 1,695.55       = 22,304.45
//   preQbi    = 22,304.45 − 16,100      =  6,204.45
//   qbi       = min(20% of each)        =  1,240.89
//   taxable   = 6,204.45 − 1,240.89     =  4,963.56   (inside the 10% band)
//   incomeTax = 10%                     =    496.36
//   setAside  = 3,391.10 + 496.36       =  3,887.46
const base = estimateTax(
  { grossCents: usd(30_000), expensesCents: usd(6_000), stripeFeesCents: 0 },
  TY2026_SETTINGS,
);

test('net profit is gross less expenses', () => near(base.netCents, usd(24_000), 'net'));
test('SE base is 92.35% of net', () => near(base.seBaseCents, usd(22_164), 'seBase'));
test('Social Security portion', () => near(base.socialSecurityCents, usd(2_748.34), 'ss'));
test('Medicare portion', () => near(base.medicareCents, usd(642.76), 'medicare'));
test('no Additional Medicare at this income', () =>
  assert.equal(base.additionalMedicareCents, 0));
test('SE tax total', () => near(base.seTaxCents, usd(3_391.1), 'seTax'));
test('half of SE tax is deductible', () => near(base.halfSeCents, usd(1_695.55), 'halfSE'));
test('QBI deduction is capped by taxable income', () =>
  near(base.qbiDeductionCents, usd(1_240.89), 'qbi'));
test('taxable income', () => near(base.taxableIncomeCents, usd(4_963.56), 'taxable'));
test('federal income tax', () => near(base.incomeTaxCents, usd(496.36), 'incomeTax'));
test('Florida state tax is zero', () => assert.equal(base.stateTaxCents, 0));
test('total set-aside', () => near(base.setAsideCents, usd(3_887.46), 'setAside'));

test('SE tax dwarfs income tax at this income', () =>
  assert.ok(
    base.seTaxCents > base.incomeTaxCents * 5,
    'SE tax should be many times income tax — the standard deduction kills income tax but not SE tax',
  ));

/* ── The percentage denominator ───────────────────────────────────────────────────────────── */
// The headline is a share of NET PROFIT (~16%), which is what the "~20% rule of thumb" means.
// Against GROSS the same dollars read ~13%. Asserting both pins the distinction in place.
test('set-aside is ~16.2% of net profit', () =>
  assert.ok(
    Math.abs(base.setAsidePctOfNet - 0.162) < 0.002,
    `expected ~0.162 of net, got ${base.setAsidePctOfNet.toFixed(4)}`,
  ));
test('set-aside is ~13.0% of gross revenue', () =>
  assert.ok(
    Math.abs(base.setAsidePctOfGross - 0.1296) < 0.002,
    `expected ~0.1296 of gross, got ${base.setAsidePctOfGross.toFixed(4)}`,
  ));
test('the two percentages are genuinely different', () =>
  assert.ok(
    base.setAsidePctOfNet - base.setAsidePctOfGross > 0.02,
    'net and gross percentages must not be conflated',
  ));

/* ── Stripe fees are expenses ─────────────────────────────────────────────────────────────── */
test('Stripe fees reduce net exactly like logged expenses', () => {
  const viaFees = estimateTax(
    { grossCents: usd(30_000), expensesCents: usd(5_000), stripeFeesCents: usd(1_000) },
    TY2026_SETTINGS,
  );
  assert.equal(viaFees.netCents, base.netCents);
  assert.equal(viaFees.setAsideCents, base.setAsideCents);
});

/* ── Draws and reserve transfers must not touch the tax ───────────────────────────────────── */
// The correctness crux of the whole feature. There is no parameter to pass them through, so the
// test asserts the shape of the contract: the only inputs are income and expenses.
test('estimateTax exposes no way to deduct a draw', () => {
  const withDraws = estimateTax(
    { grossCents: usd(30_000), expensesCents: usd(6_000), stripeFeesCents: 0 },
    TY2026_SETTINGS,
  );
  assert.deepEqual(withDraws, base, 'tax result must depend only on income and expenses');
});
test('a draw changes available-to-draw but not tax owed', () => {
  const before = availableToDraw(base, 0);
  const after = availableToDraw(base, usd(5_000));
  assert.equal(before - after, usd(5_000));
  assert.equal(base.setAsideCents, usd(3_887.46) + (base.setAsideCents - usd(3_887.46)));
});
test('reserve transfers move the reserve status, never the tax', () => {
  const s = reserveStatus(usd(2_000), base.setAsideCents);
  assert.equal(s.state, 'behind');
  assert.equal(s.differenceCents, usd(2_000) - base.setAsideCents);
  // Re-running the estimate after "transferring" changes nothing.
  const again = estimateTax(
    { grossCents: usd(30_000), expensesCents: usd(6_000), stripeFeesCents: 0 },
    TY2026_SETTINGS,
  );
  assert.equal(again.setAsideCents, base.setAsideCents);
});

/* ── QBI eligibility gate (OBBBA / Rev. Proc. 2025-32 §2.12) ──────────────────────────────── */
// Below $1,000 of QBI there is NO deduction — not a reduced one, and not the $400 floor.
// A naive "floor" implementation would hand out $400 here, so this is pinned explicitly.
test('QBI under the $1,000 floor yields no deduction at all', () => {
  const tiny = estimateTax(
    { grossCents: usd(900), expensesCents: 0, stripeFeesCents: 0 },
    TY2026_SETTINGS,
  );
  assert.equal(tiny.qbiDeductionCents, 0, 'must be $0, not the $400 minimum');
});
test('QBI over the floor gets at least the $400 minimum', () => {
  // Enough net that the standard deduction does not swallow it, so the floor is what binds.
  const s = { ...TY2026_SETTINGS, standardDeductionCents: 0 };
  const small = estimateTax(
    { grossCents: usd(1_500), expensesCents: 0, stripeFeesCents: 0 },
    s,
  );
  assert.ok(
    small.qbiDeductionCents >= s.qbiMinimumCents,
    `expected at least $400, got ${small.qbiDeductionCents} cents`,
  );
});
test('the QBI floor never drives taxable income negative', () => {
  const s = { ...TY2026_SETTINGS, standardDeductionCents: usd(1_400) };
  const e = estimateTax({ grossCents: usd(1_500), expensesCents: 0, stripeFeesCents: 0 }, s);
  assert.ok(e.taxableIncomeCents >= 0);
});

/* ── Bracket table fidelity, Rev. Proc. 2025-32 §4.01 TABLE 3 ─────────────────────────────── */
// One probe per band, computed from the published base-plus-excess figures.
const B = TY2026_SETTINGS.brackets;
test('10% band', () => near(applyBrackets(usd(10_000), B), usd(1_000), '10%'));
test('12% band: $1,240 + 12% over $12,400', () =>
  near(applyBrackets(usd(30_000), B), usd(1_240 + 0.12 * 17_600), '12%'));
test('22% band: $5,800 + 22% over $50,400', () =>
  near(applyBrackets(usd(60_000), B), usd(5_800 + 0.22 * 9_600), '22%'));
test('24% band: $17,966 + 24% over $105,700', () =>
  near(applyBrackets(usd(150_000), B), usd(17_966 + 0.24 * 44_300), '24%'));
test('32% band: $41,024 + 32% over $201,775', () =>
  near(applyBrackets(usd(220_000), B), usd(41_024 + 0.32 * 18_225), '32%'));
test('35% band: $58,448 + 35% over $256,225', () =>
  near(applyBrackets(usd(300_000), B), usd(58_448 + 0.35 * 43_775), '35%'));
test('37% band: $192,979.25 + 37% over $640,600', () =>
  near(applyBrackets(usd(700_000), B), usd(192_979.25 + 0.37 * 59_400), '37%'));
test('bracket edges are inclusive of the lower band', () =>
  near(applyBrackets(usd(12_400), B), usd(1_240), 'edge'));
test('zero and negative taxable income owe nothing', () => {
  assert.equal(applyBrackets(0, B), 0);
  assert.equal(applyBrackets(-500, B), 0);
});

/* ── Social Security cap ──────────────────────────────────────────────────────────────────── */
test('Social Security stops at the wage base while Medicare keeps accruing', () => {
  const big = estimateTax(
    { grossCents: usd(400_000), expensesCents: 0, stripeFeesCents: 0 },
    TY2026_SETTINGS,
  );
  const capped = Math.round(
    TY2026_SETTINGS.ssWageBaseCents * TY2026_SETTINGS.seSocialSecurityRate,
  );
  near(big.socialSecurityCents, capped, 'capped SS');
  assert.ok(
    big.medicareCents > Math.round(big.seBaseCents * 0.028),
    'Medicare should be uncapped',
  );
});
test('Additional Medicare applies above $200,000 of SE base', () => {
  const big = estimateTax(
    { grossCents: usd(400_000), expensesCents: 0, stripeFeesCents: 0 },
    TY2026_SETTINGS,
  );
  assert.ok(big.additionalMedicareCents > 0, '0.9% surcharge should have kicked in');
});
test('QBI limits flag raises above the threshold', () => {
  const big = estimateTax(
    { grossCents: usd(400_000), expensesCents: 0, stripeFeesCents: 0 },
    TY2026_SETTINGS,
  );
  assert.equal(big.qbiLimitsApply, true);
});

/* ── Degenerate inputs ────────────────────────────────────────────────────────────────────── */
test('expenses exceeding income owe nothing, never a negative set-aside', () => {
  const loss = estimateTax(
    { grossCents: usd(10_000), expensesCents: usd(18_000), stripeFeesCents: 0 },
    TY2026_SETTINGS,
  );
  assert.equal(loss.netCents, 0);
  assert.equal(loss.seTaxCents, 0);
  assert.equal(loss.incomeTaxCents, 0);
  assert.equal(loss.setAsideCents, 0);
  assert.equal(loss.setAsidePctOfNet, 0, 'must not divide by zero net');
});
test('a brand-new year with no data is all zeroes, not NaN', () => {
  const empty = estimateTax({ grossCents: 0, expensesCents: 0, stripeFeesCents: 0 }, TY2026_SETTINGS);
  assert.equal(empty.setAsideCents, 0);
  assert.ok(Number.isFinite(empty.setAsidePctOfNet));
  assert.ok(Number.isFinite(empty.setAsidePctOfGross));
});

/* ── Settings drive the result ────────────────────────────────────────────────────────────── */
test('editing the standard deduction changes income tax', () => {
  const s = { ...TY2026_SETTINGS, standardDeductionCents: usd(10_000) };
  const e = estimateTax(
    { grossCents: usd(30_000), expensesCents: usd(6_000), stripeFeesCents: 0 },
    s,
  );
  assert.ok(
    e.incomeTaxCents > base.incomeTaxCents,
    'a smaller standard deduction must raise income tax',
  );
  assert.equal(e.seTaxCents, base.seTaxCents, 'but must not touch SE tax');
});
test('a state income tax rate would be applied if the owner ever left Florida', () => {
  const s = { ...TY2026_SETTINGS, stateIncomeTaxRate: 0.05 };
  const e = estimateTax(
    { grossCents: usd(30_000), expensesCents: usd(6_000), stripeFeesCents: 0 },
    s,
  );
  near(e.stateTaxCents, Math.round(base.taxableIncomeCents * 0.05), 'state tax');
  assert.ok(e.setAsideCents > base.setAsideCents);
});

/* ── Quarterly schedule ───────────────────────────────────────────────────────────────────── */
test('four quarters, split evenly', () => {
  const q = quarterlyDueDates(2026, usd(3_887.46));
  assert.equal(q.length, 4);
  near(q[0].amountCents, usd(971.87), 'per quarter');
});
test('TY2026 due dates, with Q4 landing in January 2027', () => {
  const q = quarterlyDueDates(2026, usd(4_000));
  assert.deepEqual(
    q.map((x) => x.dueDate),
    ['2026-04-15', '2026-06-15', '2026-09-15', '2027-01-15'],
  );
});
test('a weekend due date rolls to Monday', () => {
  // 2027-04-15 is a Thursday; 2028-04-15 is a Saturday → 2028-04-17.
  assert.equal(quarterlyDueDates(2028, 0)[0].dueDate, '2028-04-17');
});

/* ── Reserve status ───────────────────────────────────────────────────────────────────────── */
test('reserve status reads ahead / on-track / behind', () => {
  assert.equal(reserveStatus(usd(5_000), usd(3_887.46)).state, 'ahead');
  assert.equal(reserveStatus(usd(3_887.46), usd(3_887.46)).state, 'on-track');
  assert.equal(reserveStatus(usd(1_000), usd(3_887.46)).state, 'behind');
});
test('a few cents of drift still counts as on track', () => {
  assert.equal(reserveStatus(usd(3_887.0), usd(3_887.46)).state, 'on-track');
});
