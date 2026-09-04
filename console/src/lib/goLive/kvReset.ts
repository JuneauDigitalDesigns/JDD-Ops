import 'server-only';
import { Redis } from '@upstash/redis';
import type { GoLiveResult } from './types';

/**
 * Clear JDD data from the KV instance the console is currently pointed at (whatever
 * KV_REST_API_* / UPSTASH_REDIS_REST_* resolve to in this process). For the clean cutover
 * this clears the OLD/test instance; the fresh prod instance starts empty, so this should
 * never be run against it casually.
 *
 * Destructive, so the route always previews first. The result names the KV host being
 * targeted, because "which instance am I about to wipe" is the one thing worth being sure of.
 */
function getRedisOrNull(): { redis: Redis; host: string } | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  let host = url;
  try {
    host = new URL(url).hostname;
  } catch {
    /* keep raw */
  }
  return { redis: new Redis({ url, token }), host };
}

export async function runKvReset(dryRun: boolean): Promise<GoLiveResult> {
  const conn = getRedisOrNull();
  if (!conn) {
    return { ok: false, dryRun, error: 'No KV creds in this process — set KV_REST_API_URL/TOKEN.' };
  }
  const { redis, host } = conn;

  // Collect every jdd:* key.
  const keys: string[] = [];
  let cursor = 0;
  try {
    do {
      const [next, batch] = await redis.scan(cursor, { match: 'jdd:*', count: 300 });
      cursor = Number(next);
      keys.push(...batch);
    } while (cursor !== 0);
  } catch (err) {
    return { ok: false, dryRun, error: err instanceof Error ? err.message : 'SCAN failed.' };
  }

  keys.sort();
  const preview = keys.slice(0, 60);
  const lines = [
    `target: ${host}`,
    `${keys.length} key${keys.length === 1 ? '' : 's'} matching jdd:*`,
    ...preview,
    ...(keys.length > preview.length ? [`… and ${keys.length - preview.length} more`] : []),
  ];

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      title: 'KV reset — preview',
      summary: keys.length ? 'Confirm to delete these keys.' : 'Nothing to delete — already clean.',
      lines,
    };
  }

  if (keys.length) {
    // Delete in batches so a single huge DEL doesn't exceed request limits.
    for (let i = 0; i < keys.length; i += 200) {
      await redis.del(...keys.slice(i, i + 200));
    }
  }

  return {
    ok: true,
    dryRun: false,
    title: 'KV reset',
    summary: `Deleted ${keys.length} key${keys.length === 1 ? '' : 's'} from ${host}.`,
    lines: [`target: ${host}`, `deleted ${keys.length} keys`],
  };
}
