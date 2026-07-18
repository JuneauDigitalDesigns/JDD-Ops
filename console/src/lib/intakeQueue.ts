import 'server-only';
import { Redis } from '@upstash/redis';
import type { QueuedIntake, IntakeSummary } from '@jdd/schema';

export type { QueuedIntake, IntakeSummary };

/**
 * Intake queue (consumer side).
 *
 * The agency site (juneau-digital-designs) pushes each signup's Intake envelope onto
 * a KV queue namespaced under `jdd:intake:*`. This local-only console pulls that queue
 * over HTTPS REST to claim new clients in the Build wizard's Step 1.
 *
 * The QueuedIntake / IntakeSummary shapes and the producer's enqueue side both live in
 * the shared @jdd/schema package — there is no longer a hand-synced mirror to maintain.
 */

let _redis: Redis | null = null;

/** True when KV creds are present; lets routes degrade gracefully instead of throwing. */
export function intakeQueueConfigured(): boolean {
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
        'Intake queue not configured — set KV_REST_API_URL and KV_REST_API_TOKEN in console/.env.local ' +
          '(copy them from the agency site / Upstash dashboard).',
      );
    }
    _redis = new Redis({ url, token });
  }
  return _redis;
}

const itemKey = (id: string) => `jdd:intake:item:${id}`;
const INDEX_KEY = 'jdd:intake:index';

function missingCount(item: QueuedIntake): number {
  const sites = item.intake?.sites;
  if (!Array.isArray(sites)) return 0;
  return sites.reduce<number>((sum, s) => {
    const mf = (s as { _meta?: { missing_fields?: unknown[] } })?._meta?.missing_fields;
    return sum + (Array.isArray(mf) ? mf.length : 0);
  }, 0);
}

/** Newest-first list of pending intakes, resolved to compact summaries. */
export async function listPendingIntakes(): Promise<IntakeSummary[]> {
  const redis = getRedis();
  // Highest score (most recent) first.
  const ids = await redis.zrange<string[]>(INDEX_KEY, 0, -1, { rev: true });
  if (!ids.length) return [];
  const items = await Promise.all(ids.map((id) => redis.get<QueuedIntake>(itemKey(id))));
  const out: IntakeSummary[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item) {
      // Item expired/evicted but index entry lingered — clean it up.
      await redis.zrem(INDEX_KEY, ids[i]).catch(() => {});
      continue;
    }
    if (item.status !== 'pending') continue;
    out.push({
      id: item.id,
      brandName: item.brandName,
      plan: item.plan,
      slugGuess: item.slugGuess,
      receivedAt: item.receivedAt,
      missingFieldsCount: missingCount(item),
    });
  }
  return out;
}

/** Fetch a single queued intake by id (full payload). */
export async function getIntake(id: string): Promise<QueuedIntake | null> {
  return getRedis().get<QueuedIntake>(itemKey(id));
}

/** Mark an intake imported and drop it from the pending index. Idempotent. */
export async function markIntakeImported(id: string): Promise<void> {
  const redis = getRedis();
  const item = await redis.get<QueuedIntake>(itemKey(id));
  if (item) {
    await redis.set(itemKey(id), { ...item, status: 'imported' }, { keepTtl: true });
  }
  await redis.zrem(INDEX_KEY, id);
}
