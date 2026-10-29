// Unit tests for the calendar's pure time/overlap/grid maths.
//
// meetingTime.ts is the one part of the /calendar feature that can silently produce a
// plausible-but-wrong answer — a mis-ordered day, a missed overlap, a grid that drops a week —
// so it is the one part that gets tests. The UI and the API both import these functions and never
// reimplement them, so proving them here proves them everywhere.
//
// Expected values are worked by hand (Oct 1 2026 is a Thursday), not copied from the
// implementation's output, so the test can actually contradict the code.
//
// Run: npm test   (node's built-in runner, via tsx for the .ts imports — no new dependency)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  compareByStart,
  dayLabel,
  endMinutes,
  firstConflict,
  formatTime,
  monthLabel,
  monthMatrix,
  monthsInRange,
  overlaps,
  scoreOf,
  shiftMonth,
  RANGE_START,
  RANGE_END,
} from '../src/lib/meetingTime.ts';

/** Minimal Meeting for the slot/sort helpers. */
const mk = (id, day, startMinutes, durationMinutes, createdAt = 0) => ({
  id,
  createdAt,
  day,
  startMinutes,
  durationMinutes,
  kind: 'call',
  status: 'scheduled',
  businessName: id,
});

test('formatTime — 12-hour, lowercase a/p, no leading zero', () => {
  assert.equal(formatTime(0), '12:00a');
  assert.equal(formatTime(540), '9:00a');
  assert.equal(formatTime(720), '12:00p');
  assert.equal(formatTime(870), '2:30p');
  assert.equal(formatTime(1439), '11:59p');
});

test('endMinutes — start plus duration, no day-wrap', () => {
  assert.equal(endMinutes({ startMinutes: 870, durationMinutes: 30 }), 900);
});

test('overlaps — back-to-back do NOT clash', () => {
  // 2:00–2:30 and 2:30–3:00 touch but do not intersect (half-open intervals).
  assert.equal(overlaps(mk('a', '2026-10-15', 840, 30), mk('b', '2026-10-15', 870, 30)), false);
});

test('overlaps — a start inside another meeting DOES clash', () => {
  // 2:15 falls inside 2:00–3:00.
  assert.equal(overlaps(mk('a', '2026-10-15', 840, 60), mk('b', '2026-10-15', 855, 30)), true);
});

test('overlaps — different days never clash', () => {
  assert.equal(overlaps(mk('a', '2026-10-15', 840, 60), mk('b', '2026-10-16', 840, 60)), false);
});

test('firstConflict — finds a clash and honours excludeId', () => {
  const others = [mk('x', '2026-10-15', 840, 60), mk('y', '2026-10-15', 600, 30)];
  const candidate = { day: '2026-10-15', startMinutes: 850, durationMinutes: 15 };
  assert.equal(firstConflict(candidate, others)?.id, 'x');
  // Excluding the only clash it would hit (itself, when editing) → no conflict.
  assert.equal(firstConflict(candidate, others, 'x'), null);
});

test('compareByStart — earliest first, stable tie-break by createdAt', () => {
  const later = mk('later', '2026-10-15', 900, 30, 100);
  const earlier = mk('earlier', '2026-10-15', 600, 30, 200);
  const sameTimeOlder = mk('older', '2026-10-15', 600, 30, 50);
  const sorted = [later, earlier, sameTimeOlder].sort(compareByStart);
  assert.deepEqual(sorted.map((m) => m.id), ['older', 'earlier', 'later']);
});

test('scoreOf — strictly increasing within a day, across days, across the year', () => {
  assert.ok(scoreOf('2026-10-15', 540) < scoreOf('2026-10-15', 870));
  assert.ok(scoreOf('2026-10-15', 870) < scoreOf('2026-10-16', 0));
  assert.ok(scoreOf('2026-12-31', 1425) < scoreOf('2027-01-01', 0));
  assert.ok(scoreOf('2026-10-15', 870) <= Number.MAX_SAFE_INTEGER);
});

test('monthMatrix — October 2026 (Oct 1 is a Thursday), Sunday-first 6×7', () => {
  const weeks = monthMatrix(2026, 9); // month is 0-based: 9 = October
  assert.equal(weeks.length, 6);
  for (const w of weeks) assert.equal(w.length, 7);

  // First cell is the Sunday before Oct 1 → Sep 27, out of month.
  assert.equal(weeks[0][0].day, '2026-09-27');
  assert.equal(weeks[0][0].inMonth, false);

  // Oct 1 sits in the Thursday column (index 4) of the first row, in month.
  assert.equal(weeks[0][4].day, '2026-10-01');
  assert.equal(weeks[0][4].inMonth, true);

  // Oct 29 (today's date in the fixture) is row 4, Thursday column.
  assert.equal(weeks[4][4].day, '2026-10-29');
  assert.equal(weeks[4][4].inMonth, true);

  // Exactly 31 in-month cells for October.
  const inMonth = weeks.flat().filter((c) => c.inMonth).length;
  assert.equal(inMonth, 31);
});

test('shiftMonth — steps and wraps the year', () => {
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
  assert.equal(shiftMonth('2026-10', -1), '2026-09');
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
});

test('monthsInRange — spans RANGE_START..RANGE_END inclusive', () => {
  const months = monthsInRange();
  assert.equal(months[0], RANGE_START);
  assert.equal(months[months.length - 1], RANGE_END);
  // Oct 2026 → Dec 2027 inclusive = 15 months.
  assert.equal(months.length, 15);
});

test('labels', () => {
  assert.equal(monthLabel('2026-10'), 'October 2026');
  assert.equal(dayLabel('2026-10-29'), 'Thursday, Oct 29 2026');
});
