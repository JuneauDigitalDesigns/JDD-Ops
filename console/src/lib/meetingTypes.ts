/**
 * Meeting shapes + the runtime constant arrays, for the /calendar feature.
 *
 * Split out of meetingQueue.ts for the same reason leadTypes.ts is split out of leadQueue.ts:
 * that file is `server-only` because it holds the Redis client, and the board/form need
 * MEETING_KINDS / MEETING_STATUSES / MEETING_DURATIONS as runtime VALUES. Importing them from
 * the server file would drag `server-only` into the client bundle and 500 the route. Types
 * erase; the arrays do not.
 *
 * So: shapes and constants here (client-safe), I/O in meetingQueue.ts (server-only).
 */

export type MeetingKind = 'call' | 'video';
export type MeetingStatus = 'scheduled' | 'done' | 'cancelled' | 'no-show';

/** Runtime arrays — imported as VALUES by the form and the grid (like LEAD_STAGES). */
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

/** The subset of a meeting the overlap/time math cares about. */
export type MeetingSlot = Pick<Meeting, 'day' | 'startMinutes' | 'durationMinutes'>;
