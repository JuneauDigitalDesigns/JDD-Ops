/**
 * What actually serves a site, ranked from what Vercel reports.
 *
 * Moved out of manageSites.ts (2026-11-11), which is server-only, so lib/canonicalCheck.ts and
 * its test can use the same ranking the domain tiles and the reconcile probe use. manageSites
 * re-exports it, so existing imports are unchanged.
 */

/** Where a live-site URL came from, so the UI can say how much to trust it. */
export type LiveUrlSource = 'custom' | 'vercel-alias' | 'canonical' | 'none';

export interface ResolvedLiveUrl {
  url: string | null;
  source: LiveUrlSource;
}

/** One project domain, as lib/vercel-sync.js's listProjectDomains normalizes it. */
export interface ProjectDomain {
  name: string;
  verified: boolean;
  redirect: string | null;
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
 *   - `seo.canonical` was a placeholder by design: every vertical preset shipped one
 *     (`data/verticals/hvac.ts` → yourhvaccompany.com). The presets carry none now
 *     (lib/placeholderCanonical.ts), but an unfilled or stale value is still common.
 *   - Vercel STRIPS underscores when it mints the alias; the hyphenating transform gave
 *     `e2e-test-growth.vercel.app` (404) where Vercel actually serves
 *     `e2etestgrowth.vercel.app` (200).
 *
 * So we ask Vercel and rank what it reports. `canonical` remains only as a last resort for
 * when Vercel is unreachable, and the returned `source` tells the caller it is a guess.
 */
export function resolveLiveUrl(domains: ProjectDomain[], canonical: string | null): ResolvedLiveUrl {
  // A redirect domain forwards elsewhere — it isn't where the site lives.
  const usable = domains.filter((d) => d.name && !d.redirect);
  const custom = usable.find((d) => d.verified && !d.name.endsWith('.vercel.app'));
  if (custom) return { url: `https://${custom.name}`, source: 'custom' };

  const alias = usable.find((d) => d.name.endsWith('.vercel.app'));
  if (alias) return { url: `https://${alias.name}`, source: 'vercel-alias' };

  if (canonical) return { url: withScheme(canonical), source: 'canonical' };
  return { url: null, source: 'none' };
}
