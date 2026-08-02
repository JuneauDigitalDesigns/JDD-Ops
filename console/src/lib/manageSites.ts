import 'server-only';
import { getClientContext, siteDirFor } from './clients';
import { readEnvLocal } from './intake';
import type { ClientContext, SiteEnv, SiteInfo } from './types';

/**
 * The per-request memo now lives in clients.ts as getClientCached — the /c/[slug] shell
 * needs it too, and it was never specific to /manage. Re-exported under the old name so
 * every manage route keeps its existing import.
 */
export { getClientCached as getManageClient } from './clients';

/**
 * Shared slug/site resolution for the /manage routes.
 *
 * Every /manage endpoint needs the same three things — validate the slug, find which of
 * the client's sites is being addressed, and locate that site's folder on disk. Before
 * this they each re-derived it (see the old dirForSite in api/manage/env/route.ts), which
 * is how the redeploy route ended up with a subtly different guard than the env route.
 */

/** Slugs are folder names under clients/ — keep this in step with onboard.js. */
export const SLUG_RE = /^[A-Za-z0-9_-]+$/;

export interface ResolvedSite {
  site: SiteInfo;
  /** Absolute path to clients/{slug} or clients/{slug}/site-N. */
  dir: string;
  env: SiteEnv;
}

/**
 * Can /manage do anything useful with this client?
 *
 * The bar is a real .env.local on at least one site — that is what every tool here
 * reads. Deliberately NOT `hasIntake`: that is the wrong axis, and it is what made the
 * old components hide provisioned clients.
 *
 * Note a client with no readable site.ts comes back from getClientContext with
 * `sites: []`, so it fails this check for the right reason: with no plan there are no
 * fields to render and no site slug to address Vercel with.
 */
export function isManageable(ctx: ClientContext): boolean {
  return ctx.sites.some((s) => Object.keys(s.env).length > 0);
}

/** Why a client can't be opened, for the roster to show inline. */
export function unmanageableReason(ctx: ClientContext): string | null {
  if (isManageable(ctx)) return null;
  if (!ctx.hasIntake) return 'No readable site.ts — nothing to manage yet.';
  return 'Not provisioned — no .env.local on disk.';
}

/**
 * Locate one site of a client. `siteSlug` defaults to the first site, which is the whole
 * client for starter/growth.
 */
export function resolveSite(ctx: ClientContext, siteSlug?: string): ResolvedSite | null {
  const i = siteSlug ? ctx.sites.findIndex((s) => s.slug === siteSlug) : 0;
  if (i === -1 || !ctx.sites[i]) return null;
  const dir = siteDirFor(ctx.slug, ctx.sites.length, i);
  return { site: ctx.sites[i], dir, env: readEnvLocal(dir) };
}

/**
 * The disk-only half of a roster row.
 *
 * Split out so the page can server-render rows instantly and the roster API can return
 * the same shape with health attached — without the two drifting. Reading clients/ is a
 * few milliseconds; the health checks are what take seconds, so they arrive separately.
 */
export interface RosterBase {
  slug: string;
  brandName: string;
  plan: ClientContext['plan'];
  isEnterprise: boolean;
  detectedStatus: ClientContext['detectedStatus'];
  hasIntake: boolean;
  manageable: boolean;
  reason: string | null;
  siteCount: number;
  liveUrl: string | null;
}

/** Where a live-site URL came from, so the UI can say how much to trust it. */
export type LiveUrlSource = 'custom' | 'vercel-alias' | 'canonical' | 'none';

export interface ResolvedLiveUrl {
  url: string | null;
  source: LiveUrlSource;
}

function withScheme(value: string): string {
  return value.startsWith('http') ? value : `https://${value}`;
}

/**
 * What actually serves this site.
 *
 * **Never constructs a hostname.** The previous version preferred `seo.canonical` and fell
 * back to building `{project}.vercel.app` from the project name, and both were wrong:
 *
 *   - `seo.canonical` is a placeholder by design. Every vertical preset ships one
 *     (`data/verticals/hvac.ts` → yourhvaccompany.com) and lists `seo.canonical` in
 *     `_meta.missing_fields`, so an unfilled value is the expected state, not an anomaly.
 *   - Vercel STRIPS underscores when it mints the alias; the hyphenating transform gave
 *     `e2e-test-growth.vercel.app` (404) where Vercel actually serves
 *     `e2etestgrowth.vercel.app` (200).
 *
 * So we ask Vercel and rank what it reports. `canonical` remains only as a last resort for
 * when Vercel is unreachable, and the returned `source` tells the caller it is a guess.
 */
export function resolveLiveUrl(
  domains: Array<{ name: string; verified: boolean; redirect: string | null }>,
  canonical: string | null,
): ResolvedLiveUrl {
  // A redirect domain forwards elsewhere — it isn't where the site lives.
  const usable = domains.filter((d) => d.name && !d.redirect);
  const custom = usable.find((d) => d.verified && !d.name.endsWith('.vercel.app'));
  if (custom) return { url: `https://${custom.name}`, source: 'custom' };

  const alias = usable.find((d) => d.name.endsWith('.vercel.app'));
  if (alias) return { url: `https://${alias.name}`, source: 'vercel-alias' };

  if (canonical) return { url: withScheme(canonical), source: 'canonical' };
  return { url: null, source: 'none' };
}

/**
 * Offline fallback for when there is no Vercel token to ask.
 *
 * Deliberately returns only what site.ts claims — the hostname-construction branch that
 * used to live here produced a dead host and has been removed. If Vercel can be reached,
 * use resolveLiveUrl instead.
 */
export function liveUrlFor(ctx: ClientContext): string | null {
  const canonical = ctx.sites[0]?.canonical;
  return canonical ? withScheme(canonical) : null;
}

export function rosterBase(ctx: ClientContext): RosterBase {
  return {
    slug: ctx.slug,
    brandName: ctx.brandName,
    plan: ctx.plan,
    isEnterprise: ctx.isEnterprise,
    detectedStatus: ctx.detectedStatus,
    hasIntake: ctx.hasIntake,
    manageable: isManageable(ctx),
    reason: unmanageableReason(ctx),
    siteCount: ctx.sites.length,
    liveUrl: liveUrlFor(ctx),
  };
}

export type LoadResult =
  | { ok: true; ctx: ClientContext; resolved: ResolvedSite }
  | { ok: false; error: string; status: number };

/**
 * The guard every /manage route opens with: validate, load, resolve a site.
 * Returns a discriminated union rather than throwing so routes can shape their own
 * NextResponse without a try/catch around the happy path.
 */
export async function loadManageTarget(
  slug: string | null,
  siteSlug?: string | null,
): Promise<LoadResult> {
  const base = (slug ?? '').trim();
  if (!base || !SLUG_RE.test(base)) {
    return { ok: false, error: 'Invalid or missing client slug.', status: 400 };
  }
  const site = (siteSlug ?? '').trim();
  if (site && !SLUG_RE.test(site)) {
    return { ok: false, error: 'Invalid site slug.', status: 400 };
  }

  const ctx = await getClientContext(base);
  if (!ctx) return { ok: false, error: `No client folder at clients/${base}`, status: 404 };
  if (ctx.sites.length === 0) {
    return { ok: false, error: `No readable site.ts at clients/${base}/site.ts`, status: 404 };
  }

  const resolved = resolveSite(ctx, site || undefined);
  if (!resolved) {
    return { ok: false, error: `${site} is not a site of ${base}.`, status: 400 };
  }
  return { ok: true, ctx, resolved };
}
