import 'server-only';
import { cache } from 'react';
import { Redis } from '@upstash/redis';
import { loadKvCredentials } from './opsSecrets';

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
  loadKvCredentials();
  if (!_redis) {
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      throw new Error(
        'KV not configured — set KV_REST_API_URL and KV_REST_API_TOKEN in jdd-ops/.env.',
      );
    }
    _redis = new Redis({ url, token });
  }
  return _redis;
}

export function cancelKvConfigured(): boolean {
  loadKvCredentials();
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
  /**
   * The candidate showcase image set at opt-in — the client's own upload, or an
   * auto-captured screenshot of `siteUrl`. Absent when auto-capture failed or hasn't run.
   * Immutable on the portal side after the opt-in that set it (see the agency repo's mirror
   * of this interface); the publish route can still recapture or accept an operator upload.
   */
  image?: string;
  /** How the client chose to source `image` — absent on records predating this field. */
  imageMode?: 'upload' | 'auto';
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

/**
 * What the homepage actually renders. Consent is baked in here rather than left to the
 * homepage to honor: `businessName` and `url` are present only for a credited listing — an
 * anonymous one has neither, by construction, so there is nothing for the render to leak.
 * `trade` is gone; the approved card design dropped the industry eyebrow entirely.
 *
 * Mirrors app/lib/cancel-kv.ts's `PublishedFeaturedSite` in the agency site repo. Keep the
 * two in sync — they read and write the same KV keys.
 */
export interface PublishedFeaturedSite {
  slug: string;
  image: string; // Vercel Blob URL (public.blob.vercel-storage.com) — a runtime CDN asset, not a /public file
  businessName?: string; // present iff credited
  url?: string; // present iff credited — name and link move together
  quote?: string;
}

/**
 * Publish a site to the homepage. `optedInAt` is the sort score — the same value the
 * agency site's `getPublishedFeaturedSites()` reads back `rev` (newest first) — so a
 * republish (e.g. a new screenshot) doesn't reshuffle the row by bumping it to "now".
 */
export async function publishFeaturedSite(
  site: PublishedFeaturedSite,
  optedInAt: number,
): Promise<void> {
  const redis = getRedis();
  await Promise.all([
    redis.set(FEATURED_PUB_KEY(site.slug), site),
    redis.zadd(FEATURED_PUB_INDEX, { score: optedInAt, member: site.slug }),
  ]);
}

/** Read back the current published record, so the publish UI can show whether — and how —
 *  a client is already live before the operator republishes. */
export const getPublishedFeaturedSite = cache(
  async (slug: string): Promise<PublishedFeaturedSite | null> =>
    getRedis().get<PublishedFeaturedSite>(FEATURED_PUB_KEY(slug)),
);

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
