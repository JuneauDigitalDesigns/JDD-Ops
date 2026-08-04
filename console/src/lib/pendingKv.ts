import 'server-only';
import { cache } from 'react';
import { Redis } from '@upstash/redis';
import type { ClientContext, Plan } from './types';

/**
 * Console-side reader for the pending-onboarding index written by the agency site's
 * Stripe webhook. This is the only way the console learns about clients who paid but
 * haven't had their wizard submitted — they have no disk folder yet.
 *
 * Keys:
 *   jdd:pending-onboard:{slug}  — individual record (30-day TTL)
 *   jdd:pending-onboard:index   — sorted set, score=createdAt, member=slug
 */

let _redis: Redis | null = null;

function getRedis(): Redis {
  if (!_redis) {
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      throw new Error(
        'KV not configured — set KV_REST_API_URL and KV_REST_API_TOKEN in console/.env.local.',
      );
    }
    _redis = new Redis({ url, token });
  }
  return _redis;
}

export function pendingKvConfigured(): boolean {
  return Boolean(
    (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) &&
      (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN),
  );
}

const PENDING_KEY = (slug: string) => `jdd:pending-onboard:${slug}`;
const INDEX_KEY = 'jdd:pending-onboard:index';

export interface PendingOnboardRecord {
  slug: string;
  signerEmail: string;
  signerName: string;
  sessionId: string;
  plan: string;
  name: string;
  createdAt: number;
}

/**
 * Per-request memo, the same treatment getClientCached gets in clients.ts.
 *
 * Three layers of the /c/{slug} shell now ask this question on a single page load — the
 * client layout, the manage layout, and the section page — and they're each resolving the
 * SAME slug for the same request. Without the memo that's three Redis round-trips before
 * anything renders.
 */
export const getPendingOnboardRecord = cache(
  async (slug: string): Promise<PendingOnboardRecord | null> =>
    getRedis().get<PendingOnboardRecord>(PENDING_KEY(slug)),
);

export async function listPendingOnboardRecords(): Promise<PendingOnboardRecord[]> {
  const redis = getRedis();
  // Newest first.
  const slugs = await redis.zrange<string[]>(INDEX_KEY, 0, -1, { rev: true });
  if (!slugs.length) return [];
  const items = await Promise.all(slugs.map((s) => redis.get<PendingOnboardRecord>(PENDING_KEY(s))));
  const out: PendingOnboardRecord[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item) {
      await redis.zrem(INDEX_KEY, slugs[i]).catch(() => {});
      continue;
    }
    out.push(item);
  }
  return out;
}

/** Build a synthetic ClientContext from a pending KV record for the manage layout. */
export function buildPendingClientContext(rec: PendingOnboardRecord): ClientContext {
  const plan = (['starter', 'growth', 'enterprise'] as Plan[]).includes(rec.plan as Plan)
    ? (rec.plan as Plan)
    : ('starter' as Plan);

  return {
    slug: rec.slug,
    plan,
    brandName: rec.name || rec.slug,
    isEnterprise: false,
    repoBuilt: false,
    detectedStatus: 'needs-build',
    schemaPath: `clients/${rec.slug}/site.ts`,
    hasIntake: false,
    sites: [
      {
        slug: rec.slug,
        brandName: rec.name || rec.slug,
        brandShort: null,
        canonical: null,
        repoBuilt: false,
        env: {},
        missingFields: [],
        accent: null,
      },
    ],
    pendingOnboarding: {
      signerEmail: rec.signerEmail,
      signerName: rec.signerName,
      sessionId: rec.sessionId,
      plan: rec.plan,
      name: rec.name,
      createdAt: rec.createdAt,
    },
  };
}
