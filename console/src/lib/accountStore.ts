import 'server-only';
import { Redis } from '@upstash/redis';
import {
  accountKey,
  accountByUserKey,
  createAccount,
  upsertSite,
  removeSite,
  zPortalAccount,
  type PortalAccount,
  type PortalSite,
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
 * Resolve the account email for a Clerk user id via the `jdd:account-by-user:` index.
 * Lets tools that only know a client's CLERK_USER_ID (written into their .env.local)
 * find the account record without asking the operator to retype the email.
 */
export async function getAccountEmailByUserId(clerkUserId: string): Promise<string | null> {
  const email = await getRedis().get<string>(accountByUserKey(clerkUserId));
  return email ?? null;
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

export type PatchResult =
  | { ok: true; before: PortalSite; after: PortalSite; written: boolean }
  | { ok: false; error: string };

/**
 * Set specific fields on one site of an account.
 *
 * Distinct from `attachSiteToAccount`, which rebuilds an entry from a client's disk state.
 * This is the repair path: an operator naming exactly which fields to change and what to
 * change them to, for the cases disk can't answer — a `vercelProjectId` the console isn't
 * credentialed to look up, or a Stripe id that only exists in Stripe.
 *
 * **`undefined` and `null` mean different things and the caller must mean them.** Omitting
 * a key preserves whatever is stored; passing `null` asserts "I looked, there is nothing".
 * `upsertSite`'s merge honours that distinction, and conflating the two is precisely the
 * bug that silently disconnected a client's Call Log — so this function never invents a
 * value for a field the caller didn't mention.
 *
 * Validates the whole resulting record before writing. `link-portal` has no such guard;
 * a free-form field editor needs one, because a bad `status` here is a record the portal
 * can't read at all.
 */
export async function patchSite(
  email: string,
  slug: string,
  fields: Partial<PortalSite>,
  { dryRun = false }: { dryRun?: boolean } = {},
): Promise<PatchResult> {
  const key = accountKey(email);
  const account = await getRedis().get<PortalAccount>(key);
  if (!account) return { ok: false, error: `No portal account for ${email}.` };

  const before = account.sites.find((s) => s.slug === slug);
  if (!before) {
    return {
      ok: false,
      error: `Account ${email} has no site "${slug}" (has: ${account.sites.map((s) => s.slug).join(', ') || 'none'}).`,
    };
  }

  const next = upsertSite(account, { ...fields, slug });
  const after = next.sites.find((s) => s.slug === slug)!;

  const parsed = zPortalAccount.safeParse(next);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    return { ok: false, error: `Refusing to write — invalid record (${issues}).` };
  }

  if (!dryRun) await getRedis().set(key, next);
  return { ok: true, before, after, written: !dryRun };
}

/**
 * Remove one site from an account, leaving every other site intact.
 *
 * Mirrors lib/account-store.js's detachSiteFromAccount, which onboard.js already uses when
 * re-linking a client to a different email — same reasoning applies to teardown: the site
 * is going away, and a portal record left pointing at a deleted Vercel project is a worse
 * artifact than removing it while the site briefly still exists.
 *
 * A no-op returning `null` when the account doesn't exist — that is success, not failure,
 * for a teardown's purposes.
 */
export async function detachSiteFromAccount(email: string, slug: string): Promise<PortalAccount | null> {
  const key = accountKey(email);
  const existing = await getRedis().get<PortalAccount>(key);
  if (!existing) return null;
  const next = removeSite(existing, slug);
  await getRedis().set(key, next);
  return next;
}
