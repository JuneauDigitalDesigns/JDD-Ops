import 'server-only';
import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Redis } from '@upstash/redis';
import { opsRoot } from './paths';
import { loadKvCredentials } from './opsSecrets';
import { getAccountEmailByUserId } from './accountStore';

/**
 * The per-site search profile the agency's nightly Search Console job reads (L11/L12). Built by
 * jdd-ops/lib/search-profile.js from the EXPORTED content; written here to the agency's KV at
 * `jdd:seo:profile:v1:{acctScope}:{siteSlug}`. Published when JDD verifies a property, refreshed
 * on every export of a site that already has one. Best-effort on export: a KV miss never fails a
 * deploy, it only leaves the job one export behind.
 */

export interface SearchProfile {
  v: 1;
  siteSlug: string;
  property: string | null;
  verifiedAt: string | null;
  mainCity: string;
  towns: Array<{ name: string; slug: string; hub: boolean; qualifies: boolean; facts: number }>;
  services: Array<{ slug: string; name: string; terms: string[]; page: boolean }>;
  sharedFacts: Record<string, number>;
  spokes: Array<{ town: string; service: string; since: string }>;
  updatedAt: string;
}

interface SearchProfileModule {
  searchProfileKey(acctScope: string, siteSlug: string): string;
  buildSearchProfile(
    content: unknown,
    opts: { siteSlug: string; property?: string | null; verifiedAt?: string | null; previous?: SearchProfile | null },
  ): SearchProfile;
}
interface AccountStoreModule {
  accountScope(email: string): string;
}

const cache = new Map<string, Promise<unknown>>();
function loadOps<T>(file: string): Promise<T> {
  const path = resolve(opsRoot(), 'lib', file);
  const url = `${pathToFileURL(path).href}?v=${statSync(path).mtimeMs}`;
  let mod = cache.get(url);
  if (!mod) {
    mod = import(/* webpackIgnore: true */ url);
    cache.set(url, mod);
  }
  return mod as Promise<T>;
}

let _redis: Redis | null = null;
function redis(): Redis | null {
  if (!loadKvCredentials()) return null;
  if (!_redis) {
    _redis = new Redis({
      url: (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) as string,
      token: (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN) as string,
    });
  }
  return _redis;
}

/** The portal account a site belongs to: its Clerk user's email, else the recorded email. */
export async function accountEmailForSite(env: Record<string, string | undefined>): Promise<string | null> {
  const byUser = env.CLERK_USER_ID ? await getAccountEmailByUserId(env.CLERK_USER_ID).catch(() => null) : null;
  return byUser ?? env.PORTAL_ACCOUNT_EMAIL ?? null;
}

async function keyFor(accountEmail: string, siteSlug: string): Promise<string> {
  const [{ searchProfileKey }, { accountScope }] = await Promise.all([
    loadOps<SearchProfileModule>('search-profile.js'),
    loadOps<AccountStoreModule>('account-store.js'),
  ]);
  return searchProfileKey(accountScope(accountEmail), siteSlug);
}

export async function readSearchProfile(accountEmail: string, siteSlug: string): Promise<SearchProfile | null> {
  const r = redis();
  if (!r) return null;
  return (await r.get<SearchProfile>(await keyFor(accountEmail, siteSlug))) ?? null;
}

/**
 * Write the profile. `property`/`verifiedAt` given: a verification just succeeded. Omitted: a
 * refresh, written only when a profile already exists, so an unverified site never appears to the
 * nightly job.
 */
export async function publishSearchProfile(args: {
  accountEmail: string;
  siteSlug: string;
  content: unknown;
  property?: string;
  verifiedAt?: string;
}): Promise<{ written: boolean; reason?: string }> {
  const r = redis();
  if (!r) return { written: false, reason: 'KV not configured' };
  const key = await keyFor(args.accountEmail, args.siteSlug);
  const previous = (await r.get<SearchProfile>(key)) ?? null;
  if (!previous && !args.property) return { written: false, reason: 'not verified yet' };
  const { buildSearchProfile } = await loadOps<SearchProfileModule>('search-profile.js');
  const profile = buildSearchProfile(args.content, {
    siteSlug: args.siteSlug,
    property: args.property ?? null,
    verifiedAt: args.verifiedAt ?? null,
    previous,
  });
  await r.set(key, profile);
  return { written: true };
}

/**
 * After an export pushes: refresh the profile of a site that already has one, from the content
 * now in its repo, so new towns, hubs and spokes reach the nightly job. Silent and best-effort.
 */
export async function refreshSearchProfileAfterExport(siteSlug: string): Promise<{ written: boolean; reason?: string }> {
  const [{ loadManageTarget }, { resolveRepoRoot, readRepoSiteContent }, { loadProvisionedFields }] = await Promise.all([
    import('./manageSites'),
    import('./export'),
    import('./provisionedFields'),
  ]);
  const target = await loadManageTarget(siteSlug);
  if (!target.ok) return { written: false, reason: target.error };
  const accountEmail = await accountEmailForSite(target.resolved.env);
  if (!accountEmail) return { written: false, reason: 'no portal account for this site' };
  const pf = await loadProvisionedFields();
  const content = readRepoSiteContent(resolveRepoRoot(), siteSlug, pf.extractContentObject);
  if (!content) return { written: false, reason: 'no exported site.ts' };
  return publishSearchProfile({ accountEmail, siteSlug, content });
}
