import { Redis } from '@upstash/redis';
import { accountKey, createAccount, upsertSite } from '@jdd/schema';

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
