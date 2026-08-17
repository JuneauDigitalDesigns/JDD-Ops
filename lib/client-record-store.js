import { randomUUID } from 'node:crypto';
import { Redis } from '@upstash/redis';
import {
  clientKey,
  clientBySlugKey,
  clientByEmailKey,
  createClientRecord,
  attachSlug,
  zClientRecord,
  CLIENT_INDEX_KEY,
} from '@jdd/schema';

/**
 * Client record store (ops side).
 *
 * Mirrors lib/account-store.js: same Redis bootstrap, same dual env naming, same reliance
 * on @jdd/schema for every pure operation so ops, the console, and the agency site cannot
 * drift. The console has its own thin wrapper (console/src/lib/clientRecord.ts) because it
 * is TypeScript and `server-only`; both call the same schema functions and write the same
 * four keys.
 *
 * Writers here: onboard.js (at provision) and scripts/backfill-client-records.js.
 */

let _redis = null;

export function clientRecordsConfigured() {
  return Boolean(
    (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) &&
      (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN),
  );
}

function getRedis() {
  if (!_redis) {
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      throw new Error(
        'KV not configured — set KV_REST_API_URL and KV_REST_API_TOKEN in jdd-ops/.env ' +
          '(same Upstash instance the agency site uses).',
      );
    }
    _redis = new Redis({ url, token });
  }
  return _redis;
}

export async function getClientRecord(id) {
  return (await getRedis().get(clientKey(id))) ?? null;
}

/** Resolve by slug, clearing a pointer whose record is gone rather than returning a hole. */
export async function getClientRecordBySlug(slug) {
  const redis = getRedis();
  const id = await redis.get(clientBySlugKey(slug));
  if (!id) return null;
  const rec = await redis.get(clientKey(id));
  if (!rec) {
    await redis.del(clientBySlugKey(slug)).catch(() => {});
    return null;
  }
  return rec;
}

export async function getClientRecordByEmail(email) {
  const redis = getRedis();
  const id = await redis.get(clientByEmailKey(email));
  if (!id) return null;
  const rec = await redis.get(clientKey(id));
  if (!rec) {
    await redis.del(clientByEmailKey(email)).catch(() => {});
    return null;
  }
  return rec;
}

/** Every record. For ops tooling that audits the set, matching listAccounts(). */
export async function listClientRecords() {
  const redis = getRedis();
  const ids = await redis.zrange(CLIENT_INDEX_KEY, 0, -1, { rev: true });
  if (!ids?.length) return [];
  const out = [];
  for (const id of ids) {
    const rec = await redis.get(clientKey(id));
    if (rec) out.push(rec);
  }
  return out;
}

/** Persist a record and all three indexes, validating first. */
export async function saveClientRecord(record) {
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

/**
 * Get the record for this client, creating it if absent.
 *
 * Resolves by slug before email, because slug is the stronger claim: an operator can
 * retype an email, and one email can legitimately own several businesses. Matching on
 * email first would merge separate relationships into one.
 *
 * Idempotent — onboard.js calls it on every run, including re-runs over an already
 * provisioned client, and must not produce a second record.
 */
export async function ensureClientRecord({ email, slug = null, siteSlugs, leadId = null, stage }) {
  /**
   * A SLUG identifies a client. An EMAIL does not.
   *
   * `xanderjuneau@gmail.com` owns arthur-s-plumbing, _e2e_test_growth and _e2e-starter, and
   * `jdd:client:by-email:` can only hold one id — so the email index resolves to whichever
   * of them was written last. Falling back to it when a slug lookup missed therefore
   * returned a DIFFERENT client's record and reported it as this client's, which is how the
   * fixtures silently never got records: the backfill saw "already present" three times for
   * one id and created nothing.
   *
   * So the fallback only applies when there is no slug at all — a converted lead that has
   * no folder yet, which is the one case where the email is all we have.
   */
  const existing = slug
    ? await getClientRecordBySlug(slug)
    : await getClientRecordByEmail(email);

  if (existing) {
    let next = existing;
    if (slug && !existing.slug) next = attachSlug(next, slug, siteSlugs);
    else if (siteSlugs?.length && existing.siteSlugs?.length !== siteSlugs.length) {
      next = { ...next, siteSlugs, updatedAt: Date.now() };
    }
    if (leadId && !existing.leadId) next = { ...next, leadId };
    return next === existing ? existing : saveClientRecord(next);
  }

  return saveClientRecord(
    createClientRecord({
      id: `c_${randomUUID().replace(/-/g, '').slice(0, 20)}`,
      email,
      slug,
      siteSlugs,
      leadId,
      stage,
    }),
  );
}

/** Drop a record and its indexes. Used by teardown. */
export async function deleteClientRecord(id) {
  const redis = getRedis();
  const rec = await redis.get(clientKey(id));
  if (!rec) return false;
  await redis.del(clientKey(id));
  await redis.zrem(CLIENT_INDEX_KEY, id).catch(() => {});
  await redis.del(clientByEmailKey(rec.email)).catch(() => {});
  if (rec.slug) await redis.del(clientBySlugKey(rec.slug)).catch(() => {});
  return true;
}
