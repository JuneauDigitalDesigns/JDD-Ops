import 'server-only';
import { Redis } from '@upstash/redis';
import { randomUUID } from 'node:crypto';
import {
  clientKey,
  clientBySlugKey,
  clientByEmailKey,
  createClientRecord,
  attachSlug,
  applyStage,
  deriveStage,
  zClientRecord,
  CLIENT_INDEX_KEY,
  type ClientRecord,
  type StageEvidence,
  type StageResult,
  type Stage,
} from '@jdd/schema';

/**
 * Client record store (console side).
 *
 * The record itself and every rule over it are pure and live in @jdd/schema, unit tested
 * there. This file is only the I/O half — the same split leadQueue.ts/leadTypes.ts uses,
 * and for the same reason: the stage rules are the part worth testing, and they should not
 * need Redis to run.
 *
 * Three indexes are maintained alongside the record, and all three are written on every
 * mutation that could move them. A stale by-slug pointer is worse than a missing one: it
 * silently resolves the wrong client.
 */

let _redis: Redis | null = null;

/** True when KV creds are present; lets routes degrade instead of throwing. */
export function clientRecordsConfigured(): boolean {
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
        'Client records not configured — set KV_REST_API_URL and KV_REST_API_TOKEN in ' +
          'console/.env.local (the same pair the lead queue uses).',
      );
    }
    _redis = new Redis({ url, token });
  }
  return _redis;
}

// ── Reads ───────────────────────────────────────────────────────────────────

export async function getClientRecord(id: string): Promise<ClientRecord | null> {
  return (await getRedis().get<ClientRecord>(clientKey(id))) ?? null;
}

/**
 * Resolve by slug, self-healing a dangling pointer.
 *
 * The index can outlive its record — a teardown removes the record, and a crash between
 * the two deletes would leave the pointer behind. Returning null *and* clearing it means
 * the next lookup doesn't pay for the same dead hop.
 */
export async function getClientRecordBySlug(slug: string): Promise<ClientRecord | null> {
  const redis = getRedis();
  const id = await redis.get<string>(clientBySlugKey(slug));
  if (!id) return null;
  const rec = await redis.get<ClientRecord>(clientKey(id));
  if (!rec) {
    await redis.del(clientBySlugKey(slug)).catch(() => {});
    return null;
  }
  return rec;
}

export async function getClientRecordByEmail(email: string): Promise<ClientRecord | null> {
  const redis = getRedis();
  const id = await redis.get<string>(clientByEmailKey(email));
  if (!id) return null;
  const rec = await redis.get<ClientRecord>(clientKey(id));
  if (!rec) {
    await redis.del(clientByEmailKey(email)).catch(() => {});
    return null;
  }
  return rec;
}

/** Every record, newest first. Prunes index members whose record is gone, like listLeads. */
export async function listClientRecords(): Promise<ClientRecord[]> {
  const redis = getRedis();
  const ids = await redis.zrange<string[]>(CLIENT_INDEX_KEY, 0, -1, { rev: true });
  if (!ids.length) return [];
  const items = await Promise.all(ids.map((id) => redis.get<ClientRecord>(clientKey(id))));

  const out: ClientRecord[] = [];
  for (let i = 0; i < items.length; i++) {
    if (!items[i]) {
      await redis.zrem(CLIENT_INDEX_KEY, ids[i]).catch(() => {});
      continue;
    }
    out.push(items[i] as ClientRecord);
  }
  return out;
}

// ── Writes ──────────────────────────────────────────────────────────────────

/**
 * Persist a record and every index that points at it.
 *
 * Validates before writing. `link-portal` has no such guard and that was tolerable for a
 * shape onboard.js owned end to end; this record is written by a backfill, by onboard.js,
 * and by hand from the lead board, so a malformed one is a question of when.
 */
async function save(record: ClientRecord): Promise<ClientRecord> {
  const parsed = zClientRecord.safeParse(record);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Refusing to write an invalid client record (${issues}).`);
  }

  const redis = getRedis();
  await redis.set(clientKey(record.id), record);
  await redis.zadd(CLIENT_INDEX_KEY, { score: record.createdAt, member: record.id });
  await redis.set(clientByEmailKey(record.email), record.id);
  if (record.slug) await redis.set(clientBySlugKey(record.slug), record.id);
  return record;
}

export interface EnsureClientRecordInput {
  email: string;
  slug?: string | null;
  siteSlugs?: string[];
  leadId?: string | null;
  stage?: Stage;
}

/**
 * Get the record for this client, creating it if there isn't one.
 *
 * Resolution order is slug first, then email, because slug is the stronger claim: an
 * operator can retype an email, and two clients can share one (an agency running sites for
 * several businesses). Matching on email first would merge them into one relationship.
 *
 * Idempotent by design — the backfill, onboard.js, and the Convert action all call this,
 * and re-running any of them must not produce a duplicate.
 */
export async function ensureClientRecord(
  input: EnsureClientRecordInput,
): Promise<ClientRecord> {
  /**
   * A SLUG identifies a client. An EMAIL does not — one account can own several, and
   * `jdd:client:by-email:` holds a single id, so it resolves to whichever was written last.
   * Using it as a fallback when the slug missed returned another client's record and
   * reported it as this one's. It applies only when there is no slug: a converted lead with
   * no folder yet, where the email is genuinely all we have.
   */
  const existing = input.slug
    ? await getClientRecordBySlug(input.slug)
    : await getClientRecordByEmail(input.email);

  if (existing) {
    // Fill in anything the caller knows that the record doesn't, without clobbering.
    let next = existing;
    if (input.slug && !existing.slug) next = attachSlug(next, input.slug, input.siteSlugs);
    else if (input.siteSlugs?.length && existing.siteSlugs.length !== input.siteSlugs.length) {
      next = { ...next, siteSlugs: input.siteSlugs, updatedAt: Date.now() };
    }
    if (input.leadId && !existing.leadId) next = { ...next, leadId: input.leadId };
    return next === existing ? existing : save(next);
  }

  return save(
    createClientRecord({
      id: `c_${randomUUID().replace(/-/g, '').slice(0, 20)}`,
      email: input.email,
      slug: input.slug ?? null,
      siteSlugs: input.siteSlugs,
      leadId: input.leadId ?? null,
      stage: input.stage,
    }),
  );
}

/**
 * Re-derive and persist the stage from fresh evidence.
 *
 * Writes only when the stage actually moved — `applyStage` returns the same object
 * otherwise — so a sweep over a settled roster costs zero KV writes, the same property
 * `reconcileWon` was built with.
 */
export async function refreshStage(
  record: ClientRecord,
  evidence: StageEvidence,
): Promise<{ record: ClientRecord; result: StageResult; changed: boolean }> {
  const result = deriveStage({ ...evidence, stageOverride: record.stageOverride });
  const next = applyStage(record, result);
  if (next === record) return { record, result, changed: false };
  return { record: await save(next), result, changed: true };
}

/** Persist an already-computed record (override changes, ledger writes, link edits). */
export async function saveClientRecord(record: ClientRecord): Promise<ClientRecord> {
  return save({ ...record, updatedAt: Date.now() });
}

/**
 * Drop a record and its indexes. Called by teardown, so the archive isn't shadowed by a
 * live-looking record pointing at infrastructure that no longer exists.
 */
export async function deleteClientRecord(id: string): Promise<boolean> {
  const redis = getRedis();
  const rec = await redis.get<ClientRecord>(clientKey(id));
  if (!rec) return false;
  await redis.del(clientKey(id));
  await redis.zrem(CLIENT_INDEX_KEY, id).catch(() => {});
  await redis.del(clientByEmailKey(rec.email)).catch(() => {});
  if (rec.slug) await redis.del(clientBySlugKey(rec.slug)).catch(() => {});
  return true;
}
