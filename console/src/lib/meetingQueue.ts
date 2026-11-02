import 'server-only';
import { Redis } from '@upstash/redis';
import { loadKvCredentials } from './opsSecrets';
import { scoreOf } from './meetingTime';

/**
 * Meeting store (the /calendar feature's server-only I/O half).
 *
 * Deliberately a line-for-line sibling of leadQueue.ts — same lazy Redis singleton, the same KV
 * credentials (so meetings live in the same Upstash instance as leads), the same self-healing list
 * that prunes dangling index members rather than returning holes. The shapes live in
 * meetingTypes.ts (client-safe); this is the I/O.
 *
 * A meeting is a standalone record (jdd:meeting:item:{id}) indexed in one sorted set
 * (jdd:meeting:index) scored by scoreOf(day, startMinutes) — a chronological key, so a plain
 * ascending zrange returns meetings in true time order. An optional `leadId` links it back to a
 * lead; identity fields are snapshotted on the record so a bar survives the lead being deleted or
 * converted.
 */

export type { Meeting, MeetingKind, MeetingStatus, MeetingSlot } from './meetingTypes';
export { MEETING_KINDS, MEETING_STATUSES, MEETING_DURATIONS } from './meetingTypes';

import type { Meeting, MeetingKind, MeetingStatus } from './meetingTypes';

let _redis: Redis | null = null;

/** True when KV creds are present; lets routes degrade gracefully instead of throwing. */
export function meetingQueueConfigured(): boolean {
  loadKvCredentials();
  return Boolean(
    (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) &&
      (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN),
  );
}

function getRedis(): Redis {
  loadKvCredentials();
  if (!_redis) {
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      throw new Error(
        'Meeting store not configured — set KV_REST_API_URL and KV_REST_API_TOKEN in jdd-ops/.env ' +
          '(the same pair the lead queue uses).',
      );
    }
    _redis = new Redis({ url, token });
  }
  return _redis;
}

const meetingKey = (id: string) => `jdd:meeting:item:${id}`;
const MEETING_INDEX = 'jdd:meeting:index';

/**
 * All meetings, in chronological order (earliest first).
 *
 * The index is scored chronologically, so an ascending zrange is already time-sorted. Prunes
 * index entries whose item is gone rather than returning holes — the same self-healing read as
 * listLeads, and for the same reason: a dangling member would otherwise cost a lookup forever.
 */
export async function listMeetings(): Promise<Meeting[]> {
  const redis = getRedis();
  const ids = await redis.zrange<string[]>(MEETING_INDEX, 0, -1);
  if (!ids.length) return [];
  const items = await Promise.all(ids.map((id) => redis.get<Meeting>(meetingKey(id))));

  const out: Meeting[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item) {
      await redis.zrem(MEETING_INDEX, ids[i]).catch(() => {});
      continue;
    }
    out.push(item);
  }
  return out;
}

export async function getMeeting(id: string): Promise<Meeting | null> {
  return getRedis().get<Meeting>(meetingKey(id));
}

/** Write a new meeting and index it with its chronological score. */
export async function createMeeting(rec: Meeting): Promise<void> {
  const redis = getRedis();
  await redis.set(meetingKey(rec.id), rec);
  await redis.zadd(MEETING_INDEX, { score: scoreOf(rec.day, rec.startMinutes), member: rec.id });
}

export interface MeetingPatch {
  day?: string;
  startMinutes?: number;
  durationMinutes?: number;
  kind?: MeetingKind;
  status?: MeetingStatus;
  businessName?: string;
  contactName?: string | null;
  trade?: string | null;
  phone?: string | null;
  notes?: string | null;
}

/**
 * Merge an update for one meeting and persist. Returns the new record, or null if it's gone.
 *
 * Read-modify-write, like patchLead — no locking, which is fine for a single-operator local
 * console. ALWAYS re-zadds the index afterwards: the score encodes chronology, so a day/time move
 * must update it (zadd with the same member replaces the score in place). Recomputing it even on a
 * non-time edit is cheap and keeps the index unconditionally correct.
 */
export async function patchMeeting(id: string, patch: MeetingPatch): Promise<Meeting | null> {
  const redis = getRedis();
  const prev = await redis.get<Meeting>(meetingKey(id));
  if (!prev) return null;

  const next: Meeting = { ...prev, updatedAt: Date.now() };

  if (patch.day !== undefined) next.day = patch.day;
  if (patch.startMinutes !== undefined) next.startMinutes = patch.startMinutes;
  if (patch.durationMinutes !== undefined) next.durationMinutes = patch.durationMinutes;
  if (patch.kind !== undefined) next.kind = patch.kind;
  if (patch.status !== undefined) next.status = patch.status;
  if (patch.businessName !== undefined) next.businessName = patch.businessName;
  // Nullable optionals follow patchLead's convention: null clears to undefined/omitted.
  if (patch.contactName !== undefined) next.contactName = patch.contactName === null ? undefined : patch.contactName;
  if (patch.trade !== undefined) next.trade = patch.trade === null ? undefined : patch.trade;
  if (patch.phone !== undefined) next.phone = patch.phone === null ? undefined : patch.phone;
  if (patch.notes !== undefined) next.notes = patch.notes === null ? undefined : patch.notes;

  await redis.set(meetingKey(id), next);
  await redis.zadd(MEETING_INDEX, { score: scoreOf(next.day, next.startMinutes), member: id });
  return next;
}

/** Hard-delete one meeting: removes the item key and the index entry. Returns false if not found. */
export async function deleteMeeting(id: string): Promise<boolean> {
  const redis = getRedis();
  const count = await redis.del(meetingKey(id));
  if (count > 0) await redis.zrem(MEETING_INDEX, id).catch(() => {});
  return count > 0;
}
