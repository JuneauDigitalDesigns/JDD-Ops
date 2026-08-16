import 'server-only';
import { cache } from 'react';
import { Redis } from '@upstash/redis';

/**
 * Console-side reader for the cancel-request and featured-request indexes written
 * by the portal. Mirrors the pendingKv pattern: lazy Redis client, configured()
 * guard, per-request memo via react.cache.
 *
 * Cancel:
 *   jdd:cancel-request:{slug}   — CancelRequestRecord (no TTL)
 *   jdd:cancel-request:index    — sorted set, score=requestedAt, member=slug
 *
 * Featured requests:
 *   jdd:featured-request:{slug} — FeaturedRequestRecord (no TTL)
 *   jdd:featured-request:index  — sorted set, score=optedInAt, member=slug
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

export function cancelKvConfigured(): boolean {
  return Boolean(
    (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) &&
      (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN),
  );
}

// ── Cancel requests ──────────────────────────────────────────────────────────

const CANCEL_KEY = (slug: string) => `jdd:cancel-request:${slug}`;
const CANCEL_INDEX = 'jdd:cancel-request:index';

export interface CancelRequestRecord {
  slug: string;
  siteName: string;
  plan: string;
  accountEmail: string;
  requestedAt: number;
  effectiveAt: number;
  stripeSubscriptionId: string;
}

export const getCancelRequestRecord = cache(
  async (slug: string): Promise<CancelRequestRecord | null> =>
    getRedis().get<CancelRequestRecord>(CANCEL_KEY(slug)),
);

export async function listCancelRequestRecords(): Promise<CancelRequestRecord[]> {
  const redis = getRedis();
  const slugs = await redis.zrange<string[]>(CANCEL_INDEX, 0, -1, { rev: true });
  if (!slugs.length) return [];
  const items = await Promise.all(slugs.map((s) => redis.get<CancelRequestRecord>(CANCEL_KEY(s))));
  const out: CancelRequestRecord[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item) {
      await redis.zrem(CANCEL_INDEX, slugs[i]).catch(() => {});
      continue;
    }
    out.push(item);
  }
  return out;
}

/** Call after teardown to remove the signal. */
export async function deleteCancelRequestRecord(slug: string): Promise<void> {
  const redis = getRedis();
  await Promise.all([
    redis.del(CANCEL_KEY(slug)),
    redis.zrem(CANCEL_INDEX, slug),
  ]);
}

// ── Featured requests ────────────────────────────────────────────────────────

const FEATURED_REQ_KEY = (slug: string) => `jdd:featured-request:${slug}`;
const FEATURED_REQ_INDEX = 'jdd:featured-request:index';

export interface FeaturedRequestRecord {
  slug: string;
  siteName: string;
  siteUrl?: string;
  accountEmail: string;
  optedInAt: number;
  quote?: string;
  showName: boolean;
  showLink: boolean;
}

export const getFeaturedRequestRecord = cache(
  async (slug: string): Promise<FeaturedRequestRecord | null> =>
    getRedis().get<FeaturedRequestRecord>(FEATURED_REQ_KEY(slug)),
);

export async function listFeaturedRequestRecords(): Promise<FeaturedRequestRecord[]> {
  const redis = getRedis();
  const slugs = await redis.zrange<string[]>(FEATURED_REQ_INDEX, 0, -1, { rev: true });
  if (!slugs.length) return [];
  const items = await Promise.all(slugs.map((s) => redis.get<FeaturedRequestRecord>(FEATURED_REQ_KEY(s))));
  const out: FeaturedRequestRecord[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item) {
      await redis.zrem(FEATURED_REQ_INDEX, slugs[i]).catch(() => {});
      continue;
    }
    out.push(item);
  }
  return out;
}

// ── Published featured sites ─────────────────────────────────────────────────

const FEATURED_PUB_INDEX = 'jdd:featured:published';
const FEATURED_PUB_KEY = (slug: string) => `jdd:featured:published:${slug}`;

export interface PublishedFeaturedSite {
  slug: string;
  businessName: string;
  trade: string;
  url: string;
  image: string;
}

/** Publish a site to the homepage. Xander calls this after capturing the screenshot. */
export async function publishFeaturedSite(site: PublishedFeaturedSite): Promise<void> {
  const redis = getRedis();
  const now = Date.now();
  await Promise.all([
    redis.set(FEATURED_PUB_KEY(site.slug), site),
    redis.zadd(FEATURED_PUB_INDEX, { score: now, member: site.slug }),
  ]);
}

/** Un-publish (called by the teardown flow or after the client opts out and is live). */
export async function unpublishFeaturedSite(slug: string): Promise<void> {
  const redis = getRedis();
  await Promise.all([
    redis.del(FEATURED_PUB_KEY(slug)),
    redis.zrem(FEATURED_PUB_INDEX, slug),
  ]);
}

/** Also write the sub→slug reverse index so the Stripe webhook can auto-hide on cancel. */
export async function writeSubToSlug(subscriptionId: string, slug: string): Promise<void> {
  await getRedis().set(`jdd:sub-to-slug:${subscriptionId}`, slug);
}
