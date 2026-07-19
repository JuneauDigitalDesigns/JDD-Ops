import 'server-only';
import { Redis } from '@upstash/redis';
import {
  accountKey,
  createAccount,
  upsertSite,
  type PortalAccount,
  type PortalSiteInput,
} from '@jdd/schema';

/**
 * Portal account store (console side).
 *
 * The `/manage` repair tool writes client → site mappings directly here, rather than
 * shelling out to onboard.js to poke Clerk. Merge logic comes from @jdd/schema's pure,
 * unit-tested `upsertSite`, so the console, onboard.js, and the agency site can't drift.
 *
 * Accepts either KV_REST_API_* or UPSTASH_REDIS_REST_* naming, matching intakeQueue.ts.
 */

let _redis: Redis | null = null;

/** True when KV creds are present; lets routes degrade gracefully instead of throwing. */
export function accountStoreConfigured(): boolean {
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
      throw new Error('KV not configured — set KV_REST_API_URL and KV_REST_API_TOKEN.');
    }
    _redis = new Redis({ url, token });
  }
  return _redis;
}

export async function getAccount(email: string): Promise<PortalAccount | null> {
  const raw = await getRedis().get<PortalAccount>(accountKey(email));
  return raw ?? null;
}

/**
 * Add or update one site on an account, creating the account if needed.
 * Every OTHER site on the account is preserved — repairing site B never drops site A.
 */
export async function attachSiteToAccount(
  email: string,
  site: PortalSiteInput,
): Promise<PortalAccount> {
  const key = accountKey(email);
  const existing = await getRedis().get<PortalAccount>(key);
  const account = existing ?? createAccount(email);
  const next = upsertSite(account, site);
  await getRedis().set(key, next);
  return next;
}
