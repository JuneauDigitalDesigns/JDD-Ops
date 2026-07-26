import 'server-only';
import { cache } from 'react';
import { getClientContext, siteDirFor } from './clients';
import { readEnvLocal } from './intake';
import type { ClientContext, SiteEnv, SiteInfo } from './types';

/**
 * Per-request memo of getClientContext.
 *
 * The [slug] layout and the [section] page both need the client, and App Router renders
 * them as separate server components with no way to pass props between them. Without
 * this, every section navigation re-reads and re-parses site.ts twice.
 */
export const getManageClient = cache(
  async (slug: string): Promise<ClientContext | null> => getClientContext(slug),
);

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
