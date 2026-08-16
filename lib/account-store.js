import { Redis } from '@upstash/redis';
import { accountKey, createAccount, upsertSite, removeSite } from '@jdd/schema';

/**
 * Portal account store (ops side).
 *
 * The client → site(s) mapping lives in KV under `jdd:account:{email}` and is the source
 * of truth for what the portal shows. onboard.js writes provisioned sites here; the
 * agency site reads them. All merge logic comes from @jdd/schema's pure, unit-tested
 * `upsertSite`, so ops and the site can't drift.
 *
 * Accepts either KV_REST_API_* or UPSTASH_REDIS_REST_* naming, matching the console.
 */

let _redis = null;

export function accountStoreConfigured() {
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

/** Every account record in KV, ascending by email. For ops tooling that audits the set. */
export async function listAccounts() {
  const redis = getRedis();
  const keys = await redis.keys('jdd:account:*');
  keys.sort();
  const accounts = [];
  for (const key of keys) {
    const record = await redis.get(key);
    if (record) accounts.push(record);
  }
  return accounts;
}

/** One account by email, or null. */
export async function getAccountRecord(email) {
  const redis = getRedis();
  return (await redis.get(accountKey(email))) ?? null;
}

/**
 * Write a whole account record back.
 *
 * Deliberately takes the full record rather than a patch: callers build the next state
 * with `upsertSite` (so the merge rules stay in one place) and validate before calling.
 */
export async function saveAccountRecord(account) {
  const redis = getRedis();
  await redis.set(accountKey(account.email), account);
  await invalidatePortalAccountCache(account);
  return account;
}

/**
 * Drop the portal's cached copy of this account.
 *
 * The portal caches the resolved account under `portal:acct:v1:{clerkUserId}` for 60s and
 * clears it from its own `saveAccount`. Writes from *this* repo — onboard.js step 10, the
 * console, `repair-portal` — go straight to Redis and never pass through that, so without
 * this an operator fixes a client, refreshes the portal, sees no change, and reasonably
 * concludes the repair failed.
 *
 * Best-effort: the durable write has already succeeded and must not be reported as failed
 * because a cache key wouldn't delete. The TTL bounds the damage either way.
 *
 * Keep the key format in step with `accountCacheKey` in
 * juneau-digital-designs/app/lib/portal-kv.ts.
 */
async function invalidatePortalAccountCache(account) {
  if (!account?.clerkUserId) return;
  try {
    await getRedis().del(`portal:acct:v1:${account.clerkUserId}`);
  } catch (e) {
    console.warn(`[account-store] portal cache invalidation failed: ${e.message}`);
  }
}

/**
 * Add or update one site on the client's account, creating the account if needed.
 * Upsert semantics: every OTHER site on the account is preserved, so provisioning or
 * repairing one site can never wipe a client's other sites.
 */
export async function attachSiteToAccount(email, site) {
  const redis = getRedis();
  const key = accountKey(email);
  const existing = await redis.get(key);
  const account = existing ?? createAccount(email);
  const next = upsertSite(account, site);
  await redis.set(key, next);
  return next;
}

/**
 * Remove one site from an account, leaving the rest intact.
 *
 * Used when re-linking a client to a different email: the sites have to MOVE, not be copied.
 * Leaving them on the old record means whoever controls that address keeps portal access to
 * the client's call log. A no-op when the account doesn't exist.
 */
export async function detachSiteFromAccount(email, slug) {
  const redis = getRedis();
  const key = accountKey(email);
  const existing = await redis.get(key);
  if (!existing) return null;
  const next = removeSite(existing, slug);
  await redis.set(key, next);
  return next;
}
