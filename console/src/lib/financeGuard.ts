import 'server-only';
import { NextResponse } from 'next/server';

/**
 * The loopback guard every /api/finances/* route runs first.
 *
 * Shared rather than copied per route on purpose. `stripe-lookup` carries its own copy and makes
 * the case for it well: CLAUDE.md records a "localhost-only assumption" for /api/manage/env/reveal
 * with no code enforcing it, and an assumption is not a control. With five finance routes, five
 * copies means five chances to omit one — and the routes here read and write the owner's full
 * revenue and expense history.
 *
 * Host is attacker-controllable in general, but that cuts the safe way: a forged Host can only
 * ever cause a REJECTION, never acceptance of a genuinely remote request that arrived with a
 * loopback Host. If the console is ever exposed, the operator's own browser sends the public
 * hostname and gets a 403 — which is the intent.
 */
function isLoopback(req: Request): boolean {
  const host = (req.headers.get('host') ?? '').toLowerCase();
  const hostname = host.startsWith('[')
    ? host.slice(0, host.indexOf(']') + 1) // bracketed IPv6
    : host.split(':')[0];
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname === '::1' ||
    hostname.endsWith('.localhost')
  );
}

/** Returns a 403 to send when the caller isn't local, or null to continue. */
export function guardLocal(req: Request): NextResponse | null {
  if (isLoopback(req)) return null;
  return NextResponse.json(
    { error: 'Finances is available on localhost only.' },
    { status: 403 },
  );
}

/* ── Shared request validation ──────────────────────────────────────────────────────────────
 *
 * These exist because money and dates are the two things this feature cannot afford to get
 * loosely right. A string where cents were expected, or a half-parsed date, would be stored and
 * then silently summed into a tax figure.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar date in YYYY-MM-DD. Rejects 2026-02-31 as well as malformed input. */
export function isValidDate(v: unknown): v is string {
  if (typeof v !== 'string' || !ISO_DATE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** YYYY-MM. */
export function isValidMonth(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}

/**
 * A usable money amount in integer cents.
 *
 * Rejects non-integers rather than rounding them: a fractional cent means the caller did
 * floating-point dollar math somewhere upstream, and silently rounding would hide that bug while
 * letting its error accumulate across a year of rows. Zero is rejected too — a zero-amount ledger
 * row is never meaningful and is always a mis-submit.
 */
export function isValidAmountCents(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v > 0 && v < 1_000_000_000_00;
}

/** Trim an optional free-text note, or undefined. Caps length so one row can't bloat the doc. */
export function cleanNote(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t ? t.slice(0, 500) : undefined;
}
