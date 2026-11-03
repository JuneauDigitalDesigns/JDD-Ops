// @ts-check
/**
 * A2P registration state — two Redis records, both durable (no TTL):
 *
 *   `jdd:a2p-registration:{slug}`  the chain's SIDs, statuses and evaluations. Console-owned.
 *   `jdd:a2p-intake:{slug}`        the client's business-register fields. Written by the agency
 *                                  wizard, read and corrected by the operator here.
 *
 * `{slug}` is the client's base slug — the `clients/{slug}` folder, which is also the portal
 * site slug for a single-site client. One record per CLIENT, not per site: an Enterprise
 * client is one business with one brand and one campaign, and its 2–3 numbers all join that
 * one campaign (`numbers` below is keyed by site slug for exactly that reason).
 *
 * **Why Redis and not `.env.local`** — `HANDOFF-a2p-sid-store-correction.md`: about ten SIDs
 * arriving at ten different gates, plus structured evaluation results, are state with a shape,
 * not flat config, and none of them is read by a deployed site.
 *
 * **What must never be in here.** The EIN, the representative's name, email or phone, the
 * sole proprietor's mobile. Those are consumed by one request each and reach no store at all.
 * Two guards, both on every write:
 *   - `assertNoTaxId` — value-shape, so it survives any renamed key;
 *   - a fixed key schema — a write naming a key this module does not know is refused, so
 *     "just stash `repEmail` here for the retry" cannot happen quietly. A new key is a change
 *     to `REGISTRATION_KEYS`, which is a reviewable line in this file.
 *
 * Plain ESM, injectable client: the tests drive the real write path with a spy.
 */

import { Redis } from "@upstash/redis";
import { findTaxIdPaths } from "./a2p-identity.js";

/** @typedef {{ set: (key: string, value: unknown) => Promise<unknown>; get: <T>(key: string) => Promise<T | null>; del?: (key: string) => Promise<unknown> }} A2pRedisLike */

/** @type {A2pRedisLike | null} */
let _redis = null;

/** @returns {A2pRedisLike} */
function defaultRedis() {
  if (!_redis) {
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      throw new Error("KV not configured — set KV_REST_API_URL and KV_REST_API_TOKEN in jdd-ops/.env.");
    }
    _redis = /** @type {A2pRedisLike} */ (/** @type {unknown} */ (new Redis({ url, token })));
  }
  return _redis;
}

/** @param {string} slug */
export const a2pRegistrationKey = (slug) => `jdd:a2p-registration:${slug}`;
/** @param {string} slug */
export const a2pIntakeKey = (slug) => `jdd:a2p-intake:${slug}`;

/**
 * @typedef {object} StoredEvaluation
 * @property {"compliant" | "noncompliant" | "unknown"} status
 * @property {string} sid
 * @property {Array<{ requirement: string, objectType: string, field: string, reason: string }>} failures
 * @property {string} at ISO.
 */

/**
 * @typedef {object} A2pRegistrationRecord
 * @property {1} version
 * @property {string} slug
 * @property {import("./a2p-identity.js").A2pRegistrationPath} registrationPath
 * @property {boolean} mock `Mock=true` on the brand. Set at brand registration; a mock brand cannot send.
 * @property {string} [profileSid] `BU…` secondary (standard) or starter (sole-prop) customer profile.
 * @property {string} [businessEndUserSid] `IT…` standard path only.
 * @property {string} [repEndUserSid] `IT…` authorized rep (standard) / starter info (sole-prop).
 * @property {string} [addressSid] `AD…`
 * @property {string} [addressDocSid] `RD…`
 * @property {Record<string, string>} [profileAssignments] object SID → assignment SID (`BV…`).
 * @property {StoredEvaluation} [lastEvaluation] The profile's newest evaluation.
 * @property {string} [profileChangedAt] ISO. Any profile-side create/attach after this makes `lastEvaluation` stale.
 * @property {string} [trustProductSid] `BU…`
 * @property {string} [trustEndUserSid] `IT…`
 * @property {Record<string, string>} [trustAssignments]
 * @property {StoredEvaluation} [lastTrustEvaluation]
 * @property {string} [trustChangedAt]
 * @property {string} [brandSid] `BN…`
 * @property {string} [brandType] `STANDARD` | `SOLE_PROPRIETOR`
 * @property {string} [messagingServiceSid] `MG…` the client's own service. Read by §6 item 5.
 * @property {string} [campaignSid] `QE…`
 * @property {Record<string, { e164: string, phoneNumberSid: string, attachedAt?: string, inService?: boolean, checkedAt?: string }>} [numbers] keyed by site slug.
 * @property {{ profile?: string, trustProduct?: string, brand?: string, brandIdentity?: string, campaign?: string, refreshedAt?: string }} [statuses]
 * @property {{ brand?: string[], campaign?: string[] }} [errors] Scrubbed vendor reasons.
 * @property {Record<string, string>} [gates] step id → ISO time the operator ran it.
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/** The only keys a registration record may carry. See the header for why this is a list. */
export const REGISTRATION_KEYS = Object.freeze([
  "version", "slug", "registrationPath", "mock",
  "profileSid", "businessEndUserSid", "repEndUserSid", "addressSid", "addressDocSid",
  "profileAssignments", "lastEvaluation", "profileChangedAt",
  "trustProductSid", "trustEndUserSid", "trustAssignments", "lastTrustEvaluation", "trustChangedAt",
  "brandSid", "brandType", "messagingServiceSid", "campaignSid", "numbers",
  "statuses", "errors", "gates", "createdAt", "updatedAt",
]);

/** Keys whose values are objects merged one level deep, so a patch adds rather than replaces. */
const MERGED = new Set(["profileAssignments", "trustAssignments", "numbers", "statuses", "errors", "gates"]);

/**
 * Refuse to write anything tax-ID-shaped. A value-shape check, not a key denylist: one rename
 * defeats a denylist; a shape check holds through every future refactor of the step above it.
 * Throws rather than stripping — a silent strip would leave a half-written record and nobody
 * would know the invariant had broken.
 *
 * @param {unknown} value
 * @param {string} where Label for the message. Never a value.
 */
export function assertNoTaxId(value, where) {
  const paths = findTaxIdPaths(value);
  if (paths.length) {
    throw new Error(`${where}: refused to persist a tax-ID-shaped value at ${paths.join(", ")}`);
  }
}

/**
 * @param {object} args
 * @param {string} args.slug
 * @param {A2pRedisLike} [args.redis]
 * @returns {Promise<A2pRegistrationRecord | null>}
 */
export async function readRegistration({ slug, redis = defaultRedis() }) {
  const raw = await redis.get(a2pRegistrationKey(slug));
  return /** @type {A2pRegistrationRecord | null} */ (raw ?? null);
}

/**
 * Merge a step's patch into the record and write it. Creates the record on first write.
 *
 * The SID is written the instant the vendor returns it — the step function returns its patch
 * and the console calls this before doing anything else. That is the resume guarantee the
 * runbook asks for: a chain that dies after a create never loses the SID of what it created,
 * because TrustHub has no "find my half-built bundle" query.
 *
 * @param {object} args
 * @param {string} args.slug
 * @param {Partial<A2pRegistrationRecord>} args.patch
 * @param {A2pRegistrationRecord | null} [args.current] Pass when already read, to skip a GET.
 * @param {A2pRedisLike} [args.redis]
 * @param {() => Date} [args.now]
 * @returns {Promise<A2pRegistrationRecord>}
 */
export async function writeRegistration({ slug, patch, current, redis = defaultRedis(), now = () => new Date() }) {
  const unknown = Object.keys(patch).filter((k) => !REGISTRATION_KEYS.includes(k));
  if (unknown.length) {
    throw new Error(`a2p-registration-store: refused unknown key(s) ${unknown.join(", ")} — the record schema is fixed`);
  }
  assertNoTaxId(patch, "a2p-registration-store");

  const base = current === undefined ? await readRegistration({ slug, redis }) : current;
  const at = now().toISOString();
  /** @type {Record<string, any>} */
  const next = {
    version: 1,
    slug,
    registrationPath: "standard",
    mock: false,
    createdAt: at,
    ...(base ?? {}),
  };
  for (const [key, value] of Object.entries(patch)) {
    if (MERGED.has(key) && value && typeof value === "object") {
      next[key] = { ...(next[key] ?? {}), ...value };
    } else {
      next[key] = value;
    }
  }
  next.slug = slug;
  next.updatedAt = at;

  assertNoTaxId(next, "a2p-registration-store");
  await redis.set(a2pRegistrationKey(slug), next);
  return /** @type {A2pRegistrationRecord} */ (next);
}

/**
 * @typedef {object} A2pIntakeRecord
 * @property {string} legalBusinessName
 * @property {string} businessType
 * @property {string} websiteUrl
 * @property {{ street: string, city: string, region: string, postalCode: string, country: string }} address
 * @property {string} [submittedAt]
 * @property {string} [updatedAt]
 * @property {"client" | "operator"} [updatedBy]
 */

/** Intake keys. No industry (decision 9 — the console picks it), no EIN, no rep. */
export const INTAKE_KEYS = Object.freeze([
  "legalBusinessName", "businessType", "websiteUrl", "address", "submittedAt", "updatedAt", "updatedBy",
]);

/**
 * @param {object} args
 * @param {string} args.slug
 * @param {A2pRedisLike} [args.redis]
 * @returns {Promise<A2pIntakeRecord | null>}
 */
export async function readIntake({ slug, redis = defaultRedis() }) {
  const raw = await redis.get(a2pIntakeKey(slug));
  return /** @type {A2pIntakeRecord | null} */ (raw ?? null);
}

/**
 * Save the operator's corrections back to the intake record, so a client typo fixed here is
 * the value the next read shows. Same two guards as the registration record.
 *
 * @param {object} args
 * @param {string} args.slug
 * @param {Partial<A2pIntakeRecord>} args.patch
 * @param {A2pRedisLike} [args.redis]
 * @param {() => Date} [args.now]
 * @returns {Promise<A2pIntakeRecord>}
 */
export async function writeIntake({ slug, patch, redis = defaultRedis(), now = () => new Date() }) {
  const unknown = Object.keys(patch).filter((k) => !INTAKE_KEYS.includes(k));
  if (unknown.length) throw new Error(`a2p-intake: refused unknown key(s) ${unknown.join(", ")}`);
  assertNoTaxId(patch, "a2p-intake");
  const current = (await readIntake({ slug, redis })) ?? {};
  const next = {
    ...current,
    ...patch,
    address: { ...(/** @type {any} */ (current).address ?? {}), ...(patch.address ?? {}) },
    updatedAt: now().toISOString(),
    updatedBy: /** @type {const} */ ("operator"),
  };
  assertNoTaxId(next, "a2p-intake");
  await redis.set(a2pIntakeKey(slug), next);
  return /** @type {A2pIntakeRecord} */ (next);
}
