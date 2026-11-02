// Time, overlap, and month-grid maths for the /calendar feature.
//
// Deliberately pure — no React, no dnd-kit, no Redis — exactly like lib/kanban.ts is pure, so the
// rules can be read and reasoned about on their own. THIS IS THE SINGLE SOURCE OF TRUTH for all
// time/overlap/grid logic: the UI and the API import from here and neither reimplements any of it.
// It is also the one unit the focused test (test/meeting-time.test.mjs) targets, because it is the
// one part of this feature that can silently produce a plausible-but-wrong answer.
//
// The scheduled slot is WALL-CLOCK: a `day` string ('YYYY-MM-DD') plus `startMinutes` (0–1439).
// There is no timezone and no stored timestamp, so "2:30pm on Oct 15" renders identically on any
// machine and never shifts across DST. `Date` is used ONLY to read "now" (todayDay).

import type { Meeting, MeetingSlot } from './meetingTypes';

/** Default range bounds (inclusive), 'YYYY-MM'. Soft — nav may page beyond; nothing is clamped. */
export const RANGE_START = '2026-10';
export const RANGE_END = '2027-12';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** True for a well-formed 'YYYY-MM-DD'. */
export function isDay(day: string): boolean {
  return DAY_RE.test(day);
}

/** 'YYYY-MM-DD' → { y, m (0-based), d }. Pure string parse, no Date. */
export function parseDay(day: string): { y: number; m: number; d: number } {
  const [y, m, d] = day.split('-').map(Number);
  return { y, m: m - 1, d };
}

/** Build a 'YYYY-MM-DD' from parts (month 0-based, zero-padded). */
export function toDay(y: number, m0: number, d: number): string {
  const mm = String(m0 + 1).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

/** Today as 'YYYY-MM-DD' in the browser's local zone. Uses Date ONLY to read "now". */
export function todayDay(): string {
  const now = new Date();
  return toDay(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Days in a given month (month 0-based). */
export function daysInMonth(y: number, m0: number): number {
  return new Date(y, m0 + 1, 0).getDate();
}

/**
 * '2:30p', '11:00a', '12:15p' — 12-hour, lowercase 'a'/'p', no leading zero on the hour.
 * Midnight is '12:00a', noon is '12:00p'.
 */
export function formatTime(startMinutes: number): string {
  const h24 = Math.floor(startMinutes / 60);
  const min = startMinutes % 60;
  const ap = h24 < 12 ? 'a' : 'p';
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${String(min).padStart(2, '0')}${ap}`;
}

/** Minutes a meeting ends at (may exceed 1439; callers don't wrap across days). */
export function endMinutes(m: Pick<Meeting, 'startMinutes' | 'durationMinutes'>): number {
  return m.startMinutes + m.durationMinutes;
}

/** Two meetings clash: SAME day and their [start, start+duration) intervals intersect. */
export function overlaps(a: MeetingSlot, b: MeetingSlot): boolean {
  if (a.day !== b.day) return false;
  const aEnd = a.startMinutes + a.durationMinutes;
  const bEnd = b.startMinutes + b.durationMinutes;
  return a.startMinutes < bEnd && b.startMinutes < aEnd;
}

/**
 * The first meeting in `others` that `candidate` overlaps, or null. `excludeId` skips a record
 * against itself (used when moving/editing an existing meeting). Advisory only — the caller warns
 * but never blocks on the result.
 */
export function firstConflict(
  candidate: MeetingSlot,
  others: Meeting[],
  excludeId?: string,
): Meeting | null {
  for (const m of others) {
    if (excludeId && m.id === excludeId) continue;
    if (overlaps(candidate, m)) return m;
  }
  return null;
}

/** Sort comparator: earliest startMinutes first; tie-break by createdAt asc for stability. */
export function compareByStart(a: Meeting, b: Meeting): number {
  if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
  return a.createdAt - b.createdAt;
}

/**
 * Chronological sort key for the KV index score. Monotonic across the whole range:
 * = Number(day without dashes) * 1440 + startMinutes.
 *
 * Max ~ 20271231 * 1440 + 1439 ≈ 2.9e10, well within Number.MAX_SAFE_INTEGER. Because the day
 * part dominates (×1440 > any startMinutes), the key is strictly increasing across day and year
 * boundaries, so a plain ascending zrange reads meetings in true chronological order.
 */
export function scoreOf(day: string, startMinutes: number): number {
  return Number(day.replace(/-/g, '')) * 1440 + startMinutes;
}

/**
 * The month grid: 6 weeks × 7 days, Sunday-first. Each cell is a 'YYYY-MM-DD' with an `inMonth`
 * flag (false for the leading/trailing days that belong to the prev/next month). Always 6 rows so
 * the grid height is stable as you page between months.
 */
export function monthMatrix(
  year: number,
  month0: number,
): Array<Array<{ day: string; inMonth: boolean }>> {
  const firstDow = new Date(year, month0, 1).getDay(); // 0 = Sunday
  const gridStart = new Date(year, month0, 1 - firstDow); // first Sunday cell

  const weeks: Array<Array<{ day: string; inMonth: boolean }>> = [];
  for (let w = 0; w < 6; w++) {
    const row: Array<{ day: string; inMonth: boolean }> = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + w * 7 + i);
      row.push({
        day: toDay(d.getFullYear(), d.getMonth(), d.getDate()),
        inMonth: d.getMonth() === month0 && d.getFullYear() === year,
      });
    }
    weeks.push(row);
  }
  return weeks;
}

/** Step a 'YYYY-MM' by ±N months. Pure; wraps the year. */
export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const total = y * 12 + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = total % 12;
  return `${ny}-${String(nm + 1).padStart(2, '0')}`;
}

/** Every 'YYYY-MM' from RANGE_START to RANGE_END inclusive, for the month-year picker. */
export function monthsInRange(): string[] {
  const out: string[] = [];
  let cur = RANGE_START;
  // Guard against an inverted range; RANGE_END is inclusive.
  for (let i = 0; i < 240 && cur <= RANGE_END; i++) {
    out.push(cur);
    cur = shiftMonth(cur, 1);
  }
  return out;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** 'October 2026' from a 'YYYY-MM'. */
export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

/** 'Thursday, Oct 29 2026' from a 'YYYY-MM-DD'. */
export function dayLabel(day: string): string {
  const { y, m, d } = parseDay(day);
  const dt = new Date(y, m, d);
  const wd = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dt.getDay()];
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m];
  return `${wd}, ${mon} ${d} ${y}`;
}
