/**
 * Display helpers for the Finances screen. Client-safe — no `server-only`, no I/O.
 *
 * Money lives as integer cents everywhere else in this feature; this module is the render edge
 * where it finally becomes a string, and the only place that is allowed to divide by 100.
 */

/** "$1,234.56" — full precision, for ledger rows and anywhere a figure must reconcile. */
export function money(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * "$1,235" — whole dollars, for the big headline figures.
 *
 * Cents on a 42px number are noise: the set-aside is an estimate, and rendering it to the penny
 * implies a precision the underlying tax assumptions do not have.
 */
export function moneyRound(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/** "16.2%" from a fraction. */
export function pct(fraction: number, digits = 1): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

/** Parse a typed dollar amount into integer cents. Returns null if it isn't a usable number. */
export function parseDollarsToCents(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, '');
  if (!cleaned || !/^\d*\.?\d*$/.test(cleaned)) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  // toFixed before rounding: 19.99 * 100 is 1998.9999999999998 in binary floating point, and
  // Math.round alone would be right here but wrong often enough elsewhere to not rely on.
  return Math.round(Number(n.toFixed(2)) * 100);
}

/** "2026-03" → "March 2026". */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m) return month;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** "2026-03" → "Mar", for chart axes. */
export function monthShort(month: string): string {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m) return month;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', {
    month: 'short',
    timeZone: 'UTC',
  });
}

/** "2026-03-09" → "Mar 9". */
export function dateLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** Today in the local timezone as YYYY-MM-DD — the default date for a new ledger row. */
export function todayIso(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/** The current YYYY-MM, in local time. */
export function currentMonth(): string {
  return todayIso().slice(0, 7);
}

/** The YYYY-MM before the given one. */
export function previousMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return d.toISOString().slice(0, 7);
}

/** "as of 2:14 PM" for the Stripe refresh stamp. */
export function asOf(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
