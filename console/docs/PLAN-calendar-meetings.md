# PLAN — Calendar & Meetings

**Status:** implemented (2026-10-29). Verified by `tsc --noEmit` (clean), `npm test` (399/399, incl.
`test/meeting-time.test.mjs`), and dev-server 200s on `/calendar`, `/api/meetings`, `/leads`. A full
`next build` was blocked only by the running console dev server locking `.next` (EPERM on
`.next/trace`) — restart that dev server or run the build with it stopped to get a clean production
compile; nothing in the code requires it.
**Author:** derived from a 32-question requirements interview (2026-10-29).
**Scope owner:** `console/` only. Nothing in this plan touches the ops root, `onboard.js`, `lib/`, client repos, or `@jdd/schema`.

---

## 0. How to read this document

This is a **drift-proof spec**. Every decision below was made by the user and is **locked**. Where a
detail is not specified, it is specified as "do exactly what `<existing file>` does." Do not invent
alternatives, do not add scope, do not "improve" adjacent code.

**Golden rule:** this feature is a sibling of `/leads`. It mirrors the leads stack's architecture
file-for-file. When in doubt about anything — error handling, optimistic updates, KV access, styling
tokens, loading states — open the named leads file and copy its shape.

**The five anchor files you are mirroring (read them before writing anything):**

| New thing | Mirror exactly |
|---|---|
| `src/lib/meetingTypes.ts` | `src/lib/leadTypes.ts` |
| `src/lib/meeting-meta.ts` | `src/lib/lead-meta.ts` |
| `src/lib/meetingQueue.ts` | `src/lib/leadQueue.ts` |
| `src/app/api/meetings/route.ts` | `src/app/api/leads/route.ts` |
| `src/components/calendar/CalendarView.tsx` | `src/components/leads/LeadsView.tsx` |

**Hard DO-NOTs (violating any of these is a drift failure):**

- DO NOT change the leads board columns, stages, or `LeadStage`. (User: "Only add calendar + button.")
- DO NOT add a meetings list inside `LeadModal`. The only lead-side UI change is one button + one query-read.
- DO NOT implement overlap detection, time math, or the month grid date math anywhere except
  `src/lib/meetingTime.ts`. There is exactly ONE implementation of each; UI and tests import it.
- DO NOT store a timezone, a UTC timestamp, or a `Date` for the meeting's scheduled slot. The slot is
  **wall-clock**: a `day` string + `startMinutes` integer. (See §2, rationale is DST safety.)
- DO NOT add a `⌘K` entry, a permanent nav-bar link, or a week/day view. (All three explicitly declined.)
- DO NOT reach for a new dependency. `@dnd-kit/core`, `@dnd-kit/sortable`, `@upstash/redis`,
  `@phosphor-icons/react` are already installed and are the only libraries this feature uses.

---

## 1. What is being built (one paragraph)

A month-grid calendar at `/calendar` that stores **meetings** in Upstash KV (a new `jdd:meeting:*`
namespace, mirroring the lead queue). A meeting is a standalone record with an optional link to a lead.
You reach the calendar from a new **primary card on the root `/` hub**, or from a new **"Add to calendar"
button in any lead's modal** (which navigates to `/calendar` with a prefilled create form). Meetings
render as thin, time-ordered bars inside each day cell; you can drag a bar to another day to reschedule,
and scroll inside a crowded day to see them all.

---

## 2. The data model — `src/lib/meetingTypes.ts` (NEW, client-safe)

Mirror the split rationale in `leadTypes.ts` (its header comment): **shapes + runtime constant arrays
live here (client-safe); all I/O lives in the `server-only` `meetingQueue.ts`.** The board/grid imports
the `MEETING_KINDS`/`MEETING_STATUSES` arrays as runtime values, so they cannot live in the server file.

```ts
export type MeetingKind = 'call' | 'video';
export type MeetingStatus = 'scheduled' | 'done' | 'cancelled' | 'no-show';

/** Runtime arrays — imported as VALUES by the form and grid (like LEAD_STAGES). */
export const MEETING_KINDS: MeetingKind[] = ['call', 'video'];
export const MEETING_STATUSES: MeetingStatus[] = ['scheduled', 'done', 'cancelled', 'no-show'];

/** The only durations the form offers. Minutes. */
export const MEETING_DURATIONS = [15, 30, 45, 60, 90] as const;
export type MeetingDuration = (typeof MEETING_DURATIONS)[number];

/** Start-time picker granularity, in minutes. */
export const MEETING_TIME_STEP = 15;

export interface Meeting {
  id: string;
  /** Epoch ms the record was created. NOT the scheduled time. */
  createdAt: number;
  /** Epoch ms of the last edit. Absent until first patch. */
  updatedAt?: number;

  // ── The scheduled slot. WALL-CLOCK, never a timestamp. ──
  /** Local calendar day, strictly 'YYYY-MM-DD'. */
  day: string;
  /** Minutes from local midnight, integer 0–1439 (e.g. 2:30pm = 870). */
  startMinutes: number;
  /** Length in minutes; one of MEETING_DURATIONS. */
  durationMinutes: number;

  kind: MeetingKind;
  status: MeetingStatus;

  // ── Identity, SNAPSHOTTED at creation so the bar survives lead loss. ──
  businessName: string;
  contactName?: string;
  trade?: string | null;
  phone?: string;
  notes?: string;

  /** Optional link back to the originating lead (jdd:lead:item:{id}). Absent for ad-hoc meetings. */
  leadId?: string;
}
```

**Why `day` + `startMinutes` and not a `Date`/epoch:** the user chose "single local timezone, implicit."
A wall-clock pair has no timezone and no DST hazard — "2:30pm on Oct 15" is exactly those two values and
renders identically on any machine. A stored epoch would silently shift across DST or across a machine in
another zone. This is non-negotiable; see the DO-NOT in §0.

---

## 3. Pure time & grid math — `src/lib/meetingTime.ts` (NEW, pure, the ONLY place this logic exists)

No React, no dnd-kit, no Redis — exactly like `lib/kanban.ts` is pure. **This is the single source of
truth for all time/overlap/grid math, and it is the unit the focused test (§11) targets.** The UI and the
API import from here; neither reimplements any of it.

```ts
/** Default range bounds (inclusive), 'YYYY-MM' — soft: nav may page beyond, nothing is clamped. */
export const RANGE_START = '2026-10';
export const RANGE_END = '2027-12';

/** 'YYYY-MM-DD' → { y, m (0-based), d }. Pure string parse, no Date. */
export function parseDay(day: string): { y: number; m: number; d: number };

/** Build a 'YYYY-MM-DD' from parts (zero-padded). */
export function toDay(y: number, m0: number, d: number): string;

/** Today as 'YYYY-MM-DD' in the browser's local zone. (Uses Date ONLY to read "now".) */
export function todayDay(): string;

/** '2:30p', '11:00a', '12:15p' — 12-hour, lowercase am/pm as 'a'/'p', no leading zero on hour. */
export function formatTime(startMinutes: number): string;

/** Minutes a meeting ends at (may exceed 1439; callers don't wrap days). */
export function endMinutes(m: Pick<Meeting, 'startMinutes' | 'durationMinutes'>): number;

/** Two meetings clash: SAME day and their [start, start+duration) intervals intersect. */
export function overlaps(a: MeetingSlot, b: MeetingSlot): boolean;
/** Does `candidate` overlap ANY meeting in `others` (excluding one id)? Returns the first clash or null. */
export function firstConflict(candidate: MeetingSlot, others: Meeting[], excludeId?: string): Meeting | null;

/** Sort comparator: earliest startMinutes first; tie-break by createdAt asc for stability. */
export function compareByStart(a: Meeting, b: Meeting): number;

/** Chronological sort key for the KV index score. Monotonic across the whole range.
 *  = Number(day without dashes) * 1440 + startMinutes.  (Max ~2.9e10, well within safe int.) */
export function scoreOf(day: string, startMinutes: number): number;

/** The month grid: 6 weeks × 7 days (Sunday-first), each cell a 'YYYY-MM-DD'.
 *  Leading/trailing cells belong to the prev/next month and are flagged. */
export function monthMatrix(year: number, month0: number): Array<Array<{ day: string; inMonth: boolean }>>;

/** Step a 'YYYY-MM' by ±1 month. Pure. Used by prev/next nav. */
export function shiftMonth(ym: string, delta: number): string;

type MeetingSlot = Pick<Meeting, 'day' | 'startMinutes' | 'durationMinutes'>;
```

**Overlap is "warn but allow" (user choice).** `firstConflict` is advisory only. It is called
**client-side** by the create form and the drag handler to show a warning; it NEVER blocks a save. The
API does not re-run it. One implementation, here.

---

## 4. Server I/O — `src/lib/meetingQueue.ts` (NEW, `server-only`)

Mirror `leadQueue.ts` exactly: the `import 'server-only'`, the lazy `_redis` singleton, the
`loadKvCredentials()` call from `./opsSecrets`, the `meetingQueueConfigured()` gate, and the
self-healing list (prune dangling index members, like `listLeads`).

```ts
import 'server-only';
import { Redis } from '@upstash/redis';
import { loadKvCredentials } from './opsSecrets';
import { scoreOf } from './meetingTime';
export type { Meeting, MeetingKind, MeetingStatus } from './meetingTypes';
import type { Meeting } from './meetingTypes';

const meetingKey = (id: string) => `jdd:meeting:item:${id}`;
const MEETING_INDEX = 'jdd:meeting:index';

export function meetingQueueConfigured(): boolean;   // same KV-cred check as leadQueueConfigured
export async function listMeetings(): Promise<Meeting[]>; // zrange 0..-1 ASC (chronological), self-healing prune
export async function getMeeting(id: string): Promise<Meeting | null>;
export async function createMeeting(rec: Meeting): Promise<void>; // set item + zadd {score: scoreOf(day,start), member:id}
export async function patchMeeting(id: string, patch: MeetingPatch): Promise<Meeting | null>; // read-modify-write; RE-ZADD score
export async function deleteMeeting(id: string): Promise<boolean>; // del + zrem
```

**`patchMeeting` must re-`zadd` the index** whenever `day` or `startMinutes` changes, because the score
encodes chronology (`scoreOf`). `zadd` with the same member updates the score in place — just always
recompute and set it. Set `updatedAt = Date.now()` on every patch, like `patchLead`.

`MeetingPatch` is `Partial<>` of the mutable fields: `day, startMinutes, durationMinutes, kind, status,
businessName, contactName, trade, phone, notes`. Null handling for `trade` follows `patchLead`'s
convention (null → stored as undefined/omitted).

**Re-use the same KV credentials as the lead queue** (`KV_REST_API_URL`/`KV_REST_API_TOKEN` with the
`UPSTASH_*` fallbacks). If `meetingQueueConfigured()` is false, routes degrade exactly like `/api/leads`
(see §5), never throw.

---

## 5. API route — `src/app/api/meetings/route.ts` (NEW)

`export const runtime = 'nodejs'` and `export const dynamic = 'force-dynamic'`, same as `/api/leads`.
Copy the `notConfigured()` helper pattern and the per-method error discipline verbatim (200 with an
`error` field on read failure; 4xx/5xx with `error` on writes).

- **GET** → `{ meetings: Meeting[] }` (or `notConfigured()`). Calls `listMeetings()`.
- **POST** (create) → body is the full create payload (see below). Validate, build the `Meeting` with
  `id: crypto.randomUUID()`, `createdAt: Date.now()`, `status: 'scheduled'`. Call `createMeeting`.
  **If `leadId` is present, best-effort append an activity entry to that lead** by importing
  `patchLead` from `@/lib/leadQueue` and calling
  `patchLead(leadId, { activity: { kind: 'meeting', text: 'Meeting scheduled — <Mon D>, <time> (<kind>)' } })`.
  Wrap in try/catch and log on failure; a missing lead must NOT fail the meeting create. Return
  `{ meeting }`.
- **PATCH** (edit / reschedule / status change) → `{ id, ...fields }`. Validate, `patchMeeting`, return
  `{ meeting }` or 404. This is the endpoint the drag-to-reschedule and status selector both hit.
- **DELETE** → `{ id }`, `deleteMeeting`, `{ ok: true }` / 404.

**Validation (mirror the `/api/leads` PATCH validators):**
- `day`: string matching `/^\d{4}-\d{2}-\d{2}$/`.
- `startMinutes`: integer `0..1439`.
- `durationMinutes`: must be in `MEETING_DURATIONS`.
- `kind`: in `MEETING_KINDS`. `status`: in `MEETING_STATUSES`.
- `businessName`: non-empty string.
- `contactName, trade, phone, notes`: string or null/absent.
- `leadId`: string or absent.

**The API does NOT compute overlaps.** (Warn-but-allow is a client concern; see §3.)

---

## 6. Routing & layout (NEW files, mirror `/leads`)

- `src/app/calendar/layout.tsx` — copy `src/app/leads/layout.tsx` verbatim (the `.onboard-chrome` +
  `dotfield` wrapper) so the calendar reads as the same application surface.
- `src/app/calendar/page.tsx` — copy `src/app/leads/page.tsx` shape: `export const dynamic =
  'force-dynamic'`, render `<CalendarView />`.

---

## 7. The root hub card — `src/components/hub/HubView.tsx` (EDIT)

Add ONE entry to the `CARDS` array, `tier: 'primary'` (user chose the large top row):

```ts
{
  href: '/calendar',
  title: 'Calendar',
  blurb: 'Scheduled meetings — calls and video, by day. Book one straight from a lead.',
  Icon: CalendarBlank,   // import from @phosphor-icons/react
  tier: 'primary',
},
```

Import `CalendarBlank`. The primary row now has **four** cards — change the primary grid from
`md:grid-cols-3` to `md:grid-cols-2 lg:grid-cols-4` so four lay out cleanly. Do not touch the secondary
grid. Place Calendar after Leads in the array (Briefing · Leads · Calendar · Finances reads sensibly).

---

## 8. The lead-side change (the ONLY edits to leads code)

### 8a. `src/components/leads/LeadModal.tsx` (EDIT) — one button

Add an **"Add to calendar"** button to the modal's action row (the `flex flex-wrap items-center gap-2`
block near the top of the left column). Shown for **every lead, any stage** (user choice) — no stage
gating. Use the existing `btn btn-sm` styling and a `CalendarPlus` phosphor icon.

The modal must not own navigation (it already delegates `onConverted` to `LeadsView`). Add a prop
`onAddToCalendar: () => void` to `LeadModal`'s props and call it from the button. **Do not import
`useRouter` into the modal.**

### 8b. `src/components/leads/LeadsView.tsx` (EDIT) — wire the button + support `?open=`

1. Pass `onAddToCalendar` to `<LeadModal>`. It builds the query and navigates:
   ```ts
   onAddToCalendar={() => {
     const p = new URLSearchParams({ create: '1', leadId: openLead.id });
     if (openLead.businessName) p.set('business', openLead.businessName);
     if (openLead.name) p.set('name', openLead.name);
     if (openLead.trade) p.set('trade', openLead.trade);
     if (openLead.phone) p.set('phone', openLead.phone);
     router.push(`/calendar?${p.toString()}`);
   }}
   ```
   (`useRouter` is already imported in `LeadsView`.)

2. **Support opening a specific lead via `?open={id}`** so the meeting→lead back-link works (§9d). On
   mount, read `useSearchParams()`; if `open` is present, `setOpenId(open)` once the leads have loaded.
   Follow the same one-shot/ref-guard discipline the file already uses for `lastSeenRead` so it doesn't
   re-fire on every refresh. This is the only behavioral addition to `LeadsView`.

No other leads files change. **The board, stages, card, and convert flow are untouched.**

---

## 9. Calendar UI components (NEW, under `src/components/calendar/`)

All client components. Reuse the shared chrome used by `LeadsView`: `PageHeader`, `RefreshButton`,
`WarnBanner`, the `panel` / `btn` / `meta` classes, and the CSS tokens `--accent`, `--accent-glow`,
`--rule`, `--surface`, `--surface-2`, `--fg`, `--fg2`, `--fg3`, `--ok`, `--warn`, `--danger`. Time labels
use `@/lib/relativeTime`'s `absoluteTime` only where a full timestamp is wanted; scheduled slots use
`formatTime` from `meetingTime`.

### 9a. `CalendarView.tsx` — top-level, mirrors `LeadsView.tsx`

State and data flow are a direct parallel of `LeadsView`:
- Fetch `GET /api/meetings` in a `load()` callback; `loading`/`error`/`warning`/`refreshing` states.
- **Error discipline identical to `LeadsView`:** a failed refresh NEVER replaces the view — keep
  last-known meetings, show a dismissible `WarnBanner`; hard error only when there is nothing to show.
- `patch(id, next)` — **optimistic**, byte-for-byte the same shape as `LeadsView.patch`: update local
  state first, `PATCH /api/meetings`, take the server copy back, surface `WarnBanner` on failure and let
  the next refresh correct. Used by drag-reschedule and the status selector.
- `createMeeting(payload)` — **not optimistic** (server owns the id, like `LeadsView.createLead`):
  `POST /api/meetings`, prepend the returned meeting, close the form.
- `removeMeeting(id)` — optimistic delete mirroring `LeadsView.removeLead`.
- Month state: `const [ym, setYm] = useState(currentMonthWithinRange())` — defaults to the current month
  (`todayDay().slice(0,7)`), the **soft** range (`RANGE_START`/`RANGE_END`) only drives the nav affordances
  and the month-picker options; nothing is hard-clamped (user chose "soft").
- Read `useSearchParams()` once on mount: if `create === '1'`, open `<MeetingForm>` prefilled from
  `business`/`name`/`trade`/`phone`/`leadId` and default the form's `day` to the currently shown month's
  today (or the month's first day if today is outside it). Use the same ref-guard one-shot pattern.
- Modal/overlay state: `openMeetingId` (detail modal), `formState` (create/edit form). Both are
  `CalendarView`-owned, layered over the grid, exactly as `LeadsView` owns `LeadModal`/`CallScript`.

**No `PageHeader` / no "Calendar" title block** (user request — reclaim the top-left). The month nav
row (§9b) is the only header; the meeting count renders as muted text inside that row. `RefreshButton`
is still rendered (it portals into the nav-bar utility slot, so it costs no page space).

**Full-width (user request):** the content container is `w-full px-6 py-6 md:px-8` with **no max-width**;
the month grid spans the entire horizontal space. Wrap the grid in `overflow-x-auto` with a `min-w`
(~760px) so it scrolls horizontally on a narrow window instead of crushing the seven columns.

### 9b. `MonthNav` (inline in `CalendarView` or a small sibling)

Prev/next month buttons + a month-year `<select>` populated with every month from `RANGE_START` to
`RANGE_END` (user: "prev/next + month-year picker"). Prev/next use `shiftMonth`. Because the range is
soft, prev/next are not disabled at the bounds — but the picker lists the default range. A "Today" button
jumps `ym` back to the current month.

### 9c. `MonthGrid.tsx` — the dnd month grid

- Build cells with `monthMatrix(year, month0)`. Sunday-first, 6×7, with a weekday header row (Sun…Sat).
- One `DndContext` (`@dnd-kit/core`, `PointerSensor` with `activationConstraint: { distance: 5 }`,
  `closestCorners`) wrapping the grid — same sensor config as `LeadBoard`.
- Each **day cell is a `useDroppable`** with `id = 'YYYY-MM-DD'`.
- Each **meeting bar is a draggable** (`useDraggable`). Bars within a cell are **sorted by
  `compareByStart`** (earliest at top). No `SortableContext` / no within-day reordering — ordering is
  pure time (user: "by start time, earliest at top"; drag only moves between days).
- **Drag end:** the `over.id` is the target day string. If it differs from the meeting's `day`, call
  `patch(id, { day: targetDay })` — **time is kept, only the date changes** (user choice). Before
  patching, run `firstConflict({ day: targetDay, startMinutes, durationMinutes }, allMeetings, id)`; if it
  returns a clash, show a **non-blocking** `WarnBanner` line like `"Heads up — overlaps <business> at
  <time>."` and still perform the move. Use a `DragOverlay` showing the bar face, like `LeadBoard`.
- **Day cell styling:** fixed height (e.g. `min-h` + `max-h` with `overflow-y-auto no-scrollbar`) so a
  crowded day **scrolls inside the cell on hover** (user choice) rather than growing the row. The droppable
  highlights with `--accent`/`--accent-glow` on `isOver`, exactly like `LeadBoard`'s `Column`.
- **Today & past (user choice):** the cell whose `day === todayDay()` gets an accent ring
  (`border-[var(--accent)]` or a ring); cells with `day < todayDay()` are dimmed (reduced opacity /
  `--fg3` day number). Out-of-month cells (`inMonth === false`) are muted further.
- **Click an empty part of a day cell** → open `<MeetingForm>` in create mode with `day` prefilled to that
  cell (user: "click a day cell"). Clicking a bar opens the detail modal (§9d) and must `stopPropagation`
  so it doesn't also trigger the cell's create.

### 9d. `MeetingBar.tsx`

A thin, single-line bar: **`formatTime(startMinutes)` · businessName · kind icon** (user chose
"time + name + kind icon"). Colored by kind via `meeting-meta` (§10). Status affects appearance:
`done` → dimmed; `cancelled` → strikethrough + `--fg-3`; `no-show` → `--danger` tint; `scheduled` →
full color. Truncate the name. Export a `MeetingFace` for the `DragOverlay`, mirroring `LeadCard`'s
`LeadFace`.

### 9e. `MeetingForm.tsx` — create & edit

Fields: business name, contact name, trade, phone, notes (auto-resize textarea like `LeadModal`'s notes),
a **day** picker (native `<input type="date">` or a compact day stepper), a **start-time** `<select>` in
`MEETING_TIME_STEP` (15-min) increments rendered with `formatTime`, a **duration** `<select>` over
`MEETING_DURATIONS`, and a **kind** two-button toggle (call / video) styled like `LeadModal`'s `PlanPills`.
Status is NOT set here on create (defaults `scheduled`); it is editable in the detail modal (§9f).

- Live **overlap warning line** under the time picker: run `firstConflict` against loaded meetings for the
  chosen day/time; show a muted warning when it clashes. Non-blocking (Save stays enabled).
- On save in create mode → `CalendarView.createMeeting(payload)`. If the form carries a `leadId` (came from
  a lead), that id rides in the payload so the API writes the lead's activity entry (§5).
- On save in edit mode → `CalendarView.patch(id, changedFields)`.

### 9f. `MeetingModal.tsx` — one meeting, opened

Mirror `LeadModal`'s structure (overlay + `panel`, header with business/contact, close on Escape):
- Show the slot (`<Mon D>, formatTime(start)–formatTime(end)`), kind, trade, phone (with a `tel:` call
  button + copy, reusing `LeadModal`'s copy-phone pattern), and notes (editable → `patch`).
- A **status selector** (scheduled / done / cancelled / no-show) → `patch(id, { status })`.
- An **"Edit"** affordance that opens `<MeetingForm>` in edit mode.
- A **"Delete"** affordance with the same confirm-then-delete pattern as `LeadModal`.
- **If `leadId` is set, a "View lead" link** → `router.push('/leads?open=' + leadId)` (back-link half of
  the bidirectional link; the forward half is the activity entry written in §5). If the lead no longer
  exists the link still navigates; `/leads` simply won't find it and shows the board — acceptable.

---

## 10. `src/lib/meeting-meta.ts` (NEW, mirror `lead-meta.ts`)

One source for how a kind/status is named and colored. No JSX (icon *names* resolved in components, like
`lead-meta` keeps Phosphor out). 

```ts
export const KIND_LABEL: Record<MeetingKind, string> = { call: 'Phone call', video: 'Video meeting' };
export const KIND_COLOR: Record<MeetingKind, string> = { call: 'var(--accent)', video: 'var(--ok)' };
export const STATUS_LABEL: Record<MeetingStatus, string> =
  { scheduled: 'Scheduled', done: 'Done', cancelled: 'Cancelled', 'no-show': 'No-show' };
// Status → visual treatment constants (opacity / color token) consumed by MeetingBar.
```

Icon mapping (resolved in the component, not here): `call → Phone`, `video → VideoCamera`.

---

## 11. Verification (user choice: build green + a focused test)

1. `cd console && npm run build` — must pass with zero type errors. Fix everything it reports.
2. **Focused hermetic test:** `console/test/meeting-time.test.mjs`, following the exact conventions of
   `console/test/tax-estimate.test.mjs`: `node:test` + `node:assert/strict`, imported via the existing
   `npm test` script (`node --import tsx --test`), importing the real `../src/lib/meetingTime.ts` (note the
   explicit `.ts`). **Import the real implementation; never mock.** It targets `meetingTime.ts` because
   that is the one place that "silently produces a plausible wrong answer." Cover:
   - `overlaps` / `firstConflict`: back-to-back (2:00–2:30 vs 2:30–3:00) do **not** overlap; a
     2:15 start inside a 2:00–3:00 meeting **does**; different days never overlap; `excludeId` excludes
     self.
   - `compareByStart`: earliest first; stable tie-break by `createdAt`.
   - `scoreOf`: strictly increasing across day boundaries and within a day
     (`scoreOf('2026-10-15', 870) < scoreOf('2026-10-16', 0)`), and across the year boundary
     (`'2026-12-31' 23:45` < `'2027-01-01' 00:00`).
   - `monthMatrix`: 6×7 shape; Oct 2026 (a known month) places the 1st in the correct Sunday-first column
     and flags leading/trailing days `inMonth: false`; verify a hand-worked cell count.
   - `formatTime`: `0 → '12:00a'`, `870 → '2:30p'`, `720 → '12:00p'`, `1439 → '11:59p'`.
   - `shiftMonth`: `shiftMonth('2026-12', 1) === '2027-01'`; `shiftMonth('2026-10', -1) === '2026-09'`.

   Before trusting the test, break one branch of `overlaps` and confirm it goes red (per the repo's
   "a regression test that cannot fail is decoration" rule).

The root suite (`npm test` at the ops root) and the console **phase contract** are unaffected — this
feature adds no `log()` calls to `onboard.js` and touches nothing the phase contract parses. Do not edit
`PHASE_MAP`/`expectedPhases`.

---

## 12. File manifest (complete — nothing outside this list changes)

**New:**
- `console/src/lib/meetingTypes.ts`
- `console/src/lib/meetingTime.ts`
- `console/src/lib/meeting-meta.ts`
- `console/src/lib/meetingQueue.ts`
- `console/src/app/api/meetings/route.ts`
- `console/src/app/calendar/layout.tsx`
- `console/src/app/calendar/page.tsx`
- `console/src/components/calendar/CalendarView.tsx`
- `console/src/components/calendar/MonthGrid.tsx`
- `console/src/components/calendar/DayCell.tsx` (optional — may be inlined in `MonthGrid`)
- `console/src/components/calendar/MeetingBar.tsx`
- `console/src/components/calendar/MeetingForm.tsx`
- `console/src/components/calendar/MeetingModal.tsx`
- `console/test/meeting-time.test.mjs`

**Edited (minimally, as specified):**
- `console/src/components/hub/HubView.tsx` — one card + primary grid cols.
- `console/src/components/leads/LeadModal.tsx` — one button + one prop.
- `console/src/components/leads/LeadsView.tsx` — wire the button + read `?open=`.

---

## 13. Decision log (the 32 answers, locked)

Storage: Upstash KV, new `jdd:meeting:*` namespace · standalone record linked by `leadId` · survives lead
deletion/conversion via name snapshot · lead-less (ad-hoc) meetings allowed. Fields: business + contact
name, trade, phone, notes. Duration: start time + duration. Status: scheduled/done/cancelled/no-show.
Kind: call / video, color-coded. Granularity: 15-min. Timezone: single local, implicit wall-clock.
Conflicts: warn but allow. Time entry: pick day on grid, then time in form. View: month grid only. Nav:
prev/next + month-year picker. Range: soft default Oct 2026–Dec 2027. Week: Sunday start, 7 days. Bar:
time + name + kind icon. Ordering: by start time, earliest at top. Overflow: scroll inside day cell on
hover. Today/past: highlight today + dim past. DnD: drag a meeting to another day. Time on move: keep
time, warn on conflict. Create gesture: click a day cell. Persistence: optimistic PATCH mirroring the lead
board. Add-to-calendar button: every lead, any stage. Flow: navigate to `/calendar` with prefilled create
form. Prefill: name/business/trade/phone; choose day/time/kind. Link-back: activity entry on lead +
link to lead from meeting. Root card: primary (large top row). Bar presence: root card + lead button only
(no ⌘K, no nav link). Scope: only add calendar + button (no board rework, no in-modal meetings list).
Verification: build green + a focused hermetic test on the pure time/grid math.
