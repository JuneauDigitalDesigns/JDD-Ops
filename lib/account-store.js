import { createHash } from 'node:crypto';
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

/**
 * The portal's account scope for an email.
 *
 * **This must stay byte-identical to `accountScope()` in the agency site's
 * `app/lib/portal-kv.ts:82`.** Every portal namespace is keyed by it, so a mismatch here does not
 * error — it writes a token record under a scope the portal never reads, and every lead 401s with
 * nothing wrong on either side. Two copies because neither repo can import the other, same
 * deliberate exception the ring window and `toE164` already carry.
 *
 * sha256 of the lowercased, trimmed email, first 16 hex chars.
 */
export function accountScope(email) {
  return createHash('sha256').update(String(email).trim().toLowerCase()).digest('hex').slice(0, 16);
}

/**
 * Point a client site's lead-ingest token at the account + site it may write leads to.
 *
 * ── Why the token is the key ────────────────────────────────────────────────
 * `/api/ingest/lead` resolves the account and slug FROM this record, never from the request
 * body. A client site that could name its own slug could post leads into another client's portal,
 * so possession of the token is the whole authorisation and the mapping has to be server-side.
 * Mirrors `portal-leads.ts#registerIngestToken`.
 *
 * No TTL. The token lives as long as the client does; revocation is teardown's job. A token that
 * silently expired would take lead capture down weeks later, and the only symptom the client
 * would see is "the form stopped working".
 */
/**
 * The KV key a lead-ingest token is stored under. Shape owned by the agency's portal-leads.ts
 * (`leadTokenKey`), which resolves every incoming lead through it. Exported so teardown deletes
 * the same key this registers, rather than restating the template.
 */
export const leadIngestTokenKey = (token) => `portal:lead:token:v1:${token}`;

export async function registerLeadIngestToken({ token, email, slug }) {
  if (!token || !email || !slug) {
    throw new Error('registerLeadIngestToken needs token, email and slug');
  }
  await getRedis().set(leadIngestTokenKey(token), {
    acctScope: accountScope(email),
    slug,
  });
}

/**
 * Drop a token mapping — a live credential pointing at a dead client is a hole.
 *
 * Note this was never called. The comment above says revocation is teardown's job, and until
 * 2026-11-02 teardown did not do it: every torn-down site left its token live in KV. Teardown
 * now revokes through teardown-ops.js#purgePortalSiteData, which takes its KV credentials as
 * arguments (this reads them from process.env via getRedis, which a Next route cannot rely on).
 */
export async function revokeLeadIngestToken(token) {
  if (!token) return;
  await getRedis().del(leadIngestTokenKey(token));
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

/**
 * The KV key a pool Turnstile widget's secret is stored under. Shape owned by the agency's
 * `lead-admit.ts` (`widgetSecretKey`), which reads it to verify that widget's tokens.
 */
export const turnstileWidgetSecretKey = (siteKey) => `portal:gate:v1:widget-secret:${siteKey}`;

/**
 * Keep a pool widget's secret where the agency verifies with it, and nowhere else. Cloudflare
 * shows it once, when lib/turnstile-pool.js creates the widget. No TTL: it lives as long as the
 * widget. Never logged by this function or its callers.
 */
export async function storeTurnstileWidgetSecret(siteKey, secret) {
  if (!siteKey || !secret) throw new Error('storeTurnstileWidgetSecret needs a site key and a secret');
  await getRedis().set(turnstileWidgetSecretKey(siteKey), secret);
}
