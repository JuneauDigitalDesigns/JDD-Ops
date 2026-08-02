import 'server-only';
import { Redis } from '@upstash/redis';

/**
 * Lead queue (consumer side).
 *
 * The agency site (juneau-digital-designs) writes two things into KV: leads, from the
 * hero interest form and from calls to the demo agent; and a record of every demo call,
 * including the anonymous ones that never became leads. This console reads both and
 * renders them at /leads.
 *
 * The shapes live in leadTypes.ts (client-safe); this file is the server-only I/O half.
 */

export type {
  LeadStage, LeadSource, PlanInterest, LeadActivity, QueuedLead, DemoCall,
} from './leadTypes';
export { LEAD_STAGES } from './leadTypes';

import type { DemoCall, LeadStage, QueuedLead } from './leadTypes';

let _redis: Redis | null = null;

/** True when KV creds are present; lets routes degrade gracefully instead of throwing. */
export function leadQueueConfigured(): boolean {
  return Boolean(
    (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) &&
      (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN),
  );
}

function getRedis(): Redis {
  if (!_redis) {
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      throw new Error(
        'Lead queue not configured — set KV_REST_API_URL and KV_REST_API_TOKEN in console/.env.local ' +
          '(the same pair the intake queue uses).',
      );
    }
    _redis = new Redis({ url, token });
  }
  return _redis;
}

const leadKey = (id: string) => `jdd:lead:item:${id}`;
const LEAD_INDEX = 'jdd:lead:index';
const callKey = (callId: string) => `jdd:democall:item:${callId}`;
const CALL_INDEX = 'jdd:democall:index';

/**
 * Newest-first list of leads.
 *
 * Prunes index entries whose item is gone rather than returning holes — same
 * self-healing read as intakeQueue.listPendingIntakes, and for the same reason: a
 * dangling member would otherwise keep costing a lookup on every single page load.
 */
export async function listLeads(): Promise<QueuedLead[]> {
  const redis = getRedis();
  const ids = await redis.zrange<string[]>(LEAD_INDEX, 0, -1, { rev: true });
  if (!ids.length) return [];
  const items = await Promise.all(ids.map((id) => redis.get<QueuedLead>(leadKey(id))));

  const out: QueuedLead[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item) {
      await redis.zrem(LEAD_INDEX, ids[i]).catch(() => {});
      continue;
    }
    // Records written before `activity` existed would crash the modal's trail render.
    out.push({ ...item, activity: Array.isArray(item.activity) ? item.activity : [] });
  }
  return out;
}

export async function getLead(id: string): Promise<QueuedLead | null> {
  return getRedis().get<QueuedLead>(leadKey(id));
}

export interface LeadPatch {
  stage?: LeadStage;
  order?: number;
  notes?: string;
  lostReason?: string;
  convertedSlug?: string;
  /** Appended to the trail. Callers describe the change; this file timestamps it. */
  activity?: { kind: string; text: string };
}

/**
 * Merge an update for one lead and persist. Returns the new record, or null if it's gone.
 *
 * Read-modify-write, like patchClientState. There is no locking, which is fine for a
 * single-operator local console and would not be if this were ever multi-user.
 */
export async function patchLead(id: string, patch: LeadPatch): Promise<QueuedLead | null> {
  const redis = getRedis();
  const prev = await redis.get<QueuedLead>(leadKey(id));
  if (!prev) return null;

  const now = Date.now();
  const next: QueuedLead = {
    ...prev,
    activity: Array.isArray(prev.activity) ? [...prev.activity] : [],
    updatedAt: now,
  };

  if (patch.stage !== undefined) next.stage = patch.stage;
  if (patch.order !== undefined) next.order = patch.order;
  if (patch.notes !== undefined) next.notes = patch.notes;
  if (patch.lostReason !== undefined) next.lostReason = patch.lostReason;
  if (patch.convertedSlug !== undefined) next.convertedSlug = patch.convertedSlug;
  if (patch.activity) {
    next.activity.push({ at: now, kind: patch.activity.kind, text: patch.activity.text });
  }

  await redis.set(leadKey(id), next);
  return next;
}

/** Newest-first demo calls, for the Calls tab. Same self-healing prune as listLeads. */
export async function listDemoCalls(limit = 200): Promise<DemoCall[]> {
  const redis = getRedis();
  const ids = await redis.zrange<string[]>(CALL_INDEX, 0, limit - 1, { rev: true });
  if (!ids.length) return [];
  const items = await Promise.all(ids.map((id) => redis.get<DemoCall>(callKey(id))));

  const out: DemoCall[] = [];
  for (let i = 0; i < items.length; i++) {
    if (!items[i]) {
      await redis.zrem(CALL_INDEX, ids[i]).catch(() => {});
      continue;
    }
    out.push(items[i] as DemoCall);
  }
  return out;
}
