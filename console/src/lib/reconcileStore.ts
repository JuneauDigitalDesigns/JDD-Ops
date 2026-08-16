import 'server-only';
import { Redis } from '@upstash/redis';
import {
  diffFindings,
  countBreakages,
  type Finding,
  type FindingTransition,
  type ReconcileResult,
} from '@jdd/schema';

/**
 * Where sweep results live.
 *
 *   jdd:reconcile:{slug}          latest snapshot — "what is wrong now"
 *   jdd:reconcile:history:{slug}  capped list of transitions — "has this been wrong before"
 *   jdd:reconcile:lock:{scope}    short-lived lock so two sweeps can't overlap
 *
 * The snapshot alone cannot answer the second question, and the `at-risk` stage rule
 * ("two or more infra breakages in 30 days") is unanswerable without it. A site that goes
 * down, recovers, and goes down again looks identical to a healthy one in a snapshot.
 *
 * ── The cache holds no secrets ──────────────────────────────────────────────
 *
 * It inherits the audit log's rule: key names and states, never values. A probe result may
 * legitimately contain a webhook URL or an agent id, which are identifiers; it must never
 * carry an API key, a token, or an env var's value. `assertNoSecrets` enforces the shape
 * that matters — nothing under a key that looks like a credential — because this store is
 * the one place a careless future probe could quietly persist one.
 */

let _redis: Redis | null = null;

export function reconcileStoreConfigured(): boolean {
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
        'Reconcile store not configured — set KV_REST_API_URL and KV_REST_API_TOKEN in ' +
          'console/.env.local.',
      );
    }
    _redis = new Redis({ url, token });
  }
  return _redis;
}

const snapshotKey = (slug: string) => `jdd:reconcile:${slug}`;
const historyKey = (slug: string) => `jdd:reconcile:history:${slug}`;
const lockKey = (scope: string) => `jdd:reconcile:lock:${scope}`;

/**
 * Transitions kept per client. At a handful of clients and a sweep per console launch this
 * is generous; the 30-day window the stage rule reads is far shorter than the cap, so the
 * cap can only ever discard history nothing consults.
 */
const HISTORY_CAP = 500;

/** Rolling window for the `at-risk` breakage rule. */
export const BREAKAGE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/** Key names that must never appear anywhere in a persisted probe result. */
const SECRET_KEY_PATTERN = /(api[-_]?key|secret|token|password|auth[-_]?token|bearer)/i;

/**
 * Throw if a result carries anything shaped like a credential.
 *
 * Deliberately a hard failure rather than a redaction: silently stripping would let a probe
 * keep collecting a secret it should never have read, and the next reader of this file
 * would have no idea. Failing makes the offending probe the thing that gets fixed.
 */
function assertNoSecrets(value: unknown, path = 'result'): void {
  if (value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertNoSecrets(v, `${path}[${i}]`));
    return;
  }
  for (const [k, v] of Object.entries(value)) {
    if (SECRET_KEY_PATTERN.test(k)) {
      throw new Error(
        `Refusing to cache a reconcile result: "${path}.${k}" looks like a credential. ` +
          `The reconcile cache holds names and states, never values.`,
      );
    }
    assertNoSecrets(v, `${path}.${k}`);
  }
}

// ── Snapshot ────────────────────────────────────────────────────────────────

export async function getReconcileResult(slug: string): Promise<ReconcileResult | null> {
  return (await getRedis().get<ReconcileResult>(snapshotKey(slug))) ?? null;
}

/** Latest snapshots for many clients in one pass, for the roster and the briefing. */
export async function getReconcileResults(
  slugs: string[],
): Promise<Record<string, ReconcileResult>> {
  if (!slugs.length) return {};
  const redis = getRedis();
  const values = await Promise.all(slugs.map((s) => redis.get<ReconcileResult>(snapshotKey(s))));
  const out: Record<string, ReconcileResult> = {};
  slugs.forEach((slug, i) => {
    const v = values[i];
    if (v) out[slug] = v;
  });
  return out;
}

/**
 * Persist a sweep and append whatever changed since the last one.
 *
 * Returns the transitions so the caller can report "3 new problems, 1 resolved" rather than
 * a bare count of what is currently wrong — the change is the news.
 */
export async function saveReconcileResult(
  result: ReconcileResult,
): Promise<FindingTransition[]> {
  assertNoSecrets(result);

  const redis = getRedis();
  const previous = await redis.get<ReconcileResult>(snapshotKey(result.slug));
  const transitions = diffFindings(previous?.findings ?? [], result.findings, result.checkedAt);

  await redis.set(snapshotKey(result.slug), result);

  if (transitions.length) {
    // Newest first, then trim. lpush + ltrim keeps the cap without a read-modify-write.
    await redis.lpush(historyKey(result.slug), ...transitions.map((t) => JSON.stringify(t)));
    await redis.ltrim(historyKey(result.slug), 0, HISTORY_CAP - 1);
  }

  return transitions;
}

// ── History ─────────────────────────────────────────────────────────────────

/**
 * Transition history, newest first.
 *
 * Upstash may hand back either parsed objects or raw strings depending on how a value was
 * written, so both are tolerated. A row that won't parse is skipped rather than thrown on —
 * one malformed entry must not make a client's whole history unreadable.
 */
export async function getFindingHistory(
  slug: string,
  limit = HISTORY_CAP,
): Promise<FindingTransition[]> {
  const raw = await getRedis().lrange<unknown>(historyKey(slug), 0, limit - 1);
  const out: FindingTransition[] = [];
  for (const entry of raw ?? []) {
    if (typeof entry === 'string') {
      try {
        out.push(JSON.parse(entry) as FindingTransition);
      } catch {
        continue;
      }
    } else if (entry && typeof entry === 'object') {
      out.push(entry as FindingTransition);
    }
  }
  return out;
}

/** Red breakages opened inside the rolling window — the input to the at-risk stage rule. */
export async function getBreakageCount(slug: string, now = Date.now()): Promise<number> {
  const history = await getFindingHistory(slug);
  return countBreakages(history, now - BREAKAGE_WINDOW_MS);
}

// ── Lock ────────────────────────────────────────────────────────────────────

/**
 * Claim the right to sweep, or report that someone already has it.
 *
 * The console sweeps on launch AND offers a manual "Check now", so a double-fire is the
 * normal case rather than an exotic one: open the app, immediately press the button. Two
 * concurrent sweeps would double the vendor API spend and race each other into the
 * snapshot, producing transitions that describe interleaving rather than reality.
 *
 * SET NX EX with a short TTL — a crashed sweep frees the lock by expiry rather than
 * stranding it, which matters because nothing here runs a cleanup pass.
 */
export async function acquireSweepLock(scope: string, ttlSeconds = 120): Promise<boolean> {
  const res = await getRedis().set(lockKey(scope), Date.now(), { nx: true, ex: ttlSeconds });
  return res === 'OK';
}

export async function releaseSweepLock(scope: string): Promise<void> {
  await getRedis().del(lockKey(scope)).catch(() => {});
}

/** Drop everything a client's sweep left behind. Called by teardown. */
export async function clearReconcileState(slug: string): Promise<void> {
  const redis = getRedis();
  await redis.del(snapshotKey(slug)).catch(() => {});
  await redis.del(historyKey(slug)).catch(() => {});
}

export type { Finding, FindingTransition, ReconcileResult };
