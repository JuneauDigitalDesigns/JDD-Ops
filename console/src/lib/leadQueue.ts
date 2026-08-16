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

import type { DemoCall, LeadStage, PlanInterest, QueuedLead } from './leadTypes';

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

/**
 * Write a new lead and index it — the manual counterpart to the agency site's enqueueLead.
 *
 * Same two keys, same score, same absence of a TTL, because a lead the console created must be
 * indistinguishable from one the site produced everywhere downstream. The one omission is the
 * jdd:lead:by-call reverse key: that exists so the demo-call reconcile cron can tell a call it
 * has already ingested from a new one, and a hand-typed lead has no call to point back at.
 */
export async function createLead(rec: QueuedLead): Promise<void> {
  const redis = getRedis();
  await redis.set(leadKey(rec.id), rec);
  await redis.zadd(LEAD_INDEX, { score: rec.receivedAt, member: rec.id });
}

export interface LeadPatch {
  stage?: LeadStage;
  order?: number;
  notes?: string;
  lostReason?: string;
  convertedSlug?: string;
  name?: string;
  businessName?: string;
  phone?: string;
  email?: string | null;
  trade?: string | null;
  planInterest?: PlanInterest | null;
  /** Appended to the trail. Callers describe the change; this file timestamps it. Accepts one or many. */
  activity?: { kind: string; text: string } | { kind: string; text: string }[];
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
  if (patch.name !== undefined) next.name = patch.name;
  if (patch.businessName !== undefined) next.businessName = patch.businessName;
  if (patch.phone !== undefined) next.phone = patch.phone;
  if (patch.email !== undefined) next.email = patch.email === null ? undefined : patch.email;
  if (patch.trade !== undefined) next.trade = patch.trade === null ? undefined : patch.trade;
  if (patch.planInterest !== undefined) next.planInterest = patch.planInterest;
  if (patch.activity) {
    const entries = Array.isArray(patch.activity) ? patch.activity : [patch.activity];
    for (const a of entries) {
      next.activity.push({ at: now, kind: a.kind, text: a.text });
    }
  }

  await redis.set(leadKey(id), next);
  return next;
}

/** Hard-delete one lead: removes the item key and the index entry. Returns false if not found. */
export async function deleteLead(id: string): Promise<boolean> {
  const redis = getRedis();
  const count = await redis.del(leadKey(id));
  if (count > 0) await redis.zrem(LEAD_INDEX, id).catch(() => {});
  return count > 0;
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
