import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { SiteComposition } from '@/lib/pages';
import { previousRoutes } from '@/lib/composition-manifest';

/**
 * Permanent redirects for every URL a client site has stopped serving (Xander's local SEO decision
 * L3, 2026-11-12: "a changed URL gets a 308 redirect, kept for good"). Google asks for permanent
 * redirects kept "at least 1 year" so signals transfer
 * (https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes); keeping
 * them for good costs nothing.
 *
 * Town pages and spokes come and go with their facts (a town that loses its facts loses its page,
 * a spoke that stops qualifying is folded into its town page), and a town's slug follows the
 * spelling in the service area. Every route an export ever wrote is recorded in a ledger,
 * `.studio/published-routes.json`, which only ever grows. Each export redirects every ledger route
 * the composition no longer has to the closest page that still exists.
 *
 * WHERE: `vercel.json` in the client repo. Not next.config.js, which the template owns and every
 * export overwrites (sharedLibs.ts TEMPLATE_OWNED_FILES). The template has no vercel.json, so
 * copyTemplate never touches it, and this module merges into whatever the repo already has. Other
 * keys are kept, and so is any redirect whose source is not a route we generated, so an operator's
 * own redirect survives every re-export. Vercel serves `permanent: true` as a 308.
 */

export interface VercelRedirect {
  source: string;
  destination: string;
  permanent?: boolean;
  [key: string]: unknown;
}

const LEDGER_VERSION = 1;

export function ledgerPath(repoDir: string): string {
  return resolve(repoDir, '.studio', 'published-routes.json');
}

export function vercelJsonPath(repoDir: string): string {
  return resolve(repoDir, 'vercel.json');
}

const clean = (routes: Iterable<string>) => [...new Set([...routes].map((r) => r.trim().replace(/^\/+|\/+$/g, '')).filter(Boolean))];

/**
 * The closest page that still exists for a route that is gone:
 *   a spoke      -> its town page, else its service page, else the /areas index, else home;
 *   a town page  -> the /areas index, else home;
 *   a service    -> /services, else home;
 *   anything else -> home.
 * Computed against the live routes every time, so a redirect never points at a page that has
 * itself gone (no chains).
 */
export function fallbackFor(route: string, live: ReadonlySet<string>): string {
  const parts = route.split('/');
  if (parts[0] === 'areas' && parts.length === 3) {
    if (live.has(`areas/${parts[1]}`)) return `/areas/${parts[1]}`;
    if (live.has(`services/${parts[2]}`)) return `/services/${parts[2]}`;
  }
  if (parts[0] === 'areas' && parts.length >= 2 && live.has('areas')) return '/areas';
  if (parts[0] === 'services' && parts.length === 2 && live.has('services')) return '/services';
  return '/';
}

/**
 * Pure. Given every route ever published, the routes this export serves and the repo's existing
 * redirects, returns the redirects to write and the new ledger.
 *   - every published route that is no longer live gets a permanent redirect to fallbackFor;
 *   - a route that is live again loses its redirect (Vercel applies redirects before pages, so a
 *     stale one would hide the page);
 *   - a redirect whose source is not a route we generated is the operator's, and is kept as is.
 */
export function planRedirects(
  published: Iterable<string>,
  live: Iterable<string>,
  existing: VercelRedirect[],
): { redirects: VercelRedirect[]; published: string[] } {
  const liveSet = new Set(clean(live));
  const ledger = clean([...published, ...liveSet]);
  const ours = new Set(ledger.map((r) => `/${r}`));
  const kept = existing.filter((r) => !ours.has(String(r.source).replace(/\/+$/, '')));
  const generated = ledger
    .filter((r) => !liveSet.has(r))
    .map((r) => ({ source: `/${r}`, destination: fallbackFor(r, liveSet), permanent: true }));
  return { redirects: [...kept, ...generated], published: ledger.sort() };
}

function readLedger(repoDir: string): string[] {
  const path = ledgerPath(repoDir);
  if (!existsSync(path)) return [];
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as { routes?: unknown };
    return Array.isArray(parsed.routes) ? parsed.routes.filter((r): r is string => typeof r === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Write the redirects and the ledger for this composition. Call BEFORE reconcileRoutes, which
 * replaces the manifest that `previousRoutes` reads (the ledger's seed for repos exported before
 * the ledger existed). Throws on a vercel.json that isn't valid JSON: overwriting it would lose
 * whatever the operator put there, so the export stops and says so instead.
 */
export function writeRedirects(repoDir: string, comp: Pick<SiteComposition, 'pages'>): { added: VercelRedirect[]; redirects: VercelRedirect[] } {
  const vPath = vercelJsonPath(repoDir);
  let config: Record<string, unknown> = {};
  if (existsSync(vPath)) {
    try {
      const parsed = JSON.parse(readFileSync(vPath, 'utf8')) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) config = parsed as Record<string, unknown>;
      else throw new Error('not an object');
    } catch {
      throw new Error('The client repo has a vercel.json that is not valid JSON. Fix or remove it, then export again, so its redirects are not lost.');
    }
  }
  const existing = (Array.isArray(config.redirects) ? config.redirects : []).filter(
    (r): r is VercelRedirect => !!r && typeof r === 'object' && typeof (r as VercelRedirect).source === 'string',
  );
  const live = comp.pages.map((p) => p.route);
  const { redirects, published } = planRedirects([...readLedger(repoDir), ...previousRoutes(repoDir)], live, existing);

  const before = new Set(existing.map((r) => `${r.source}>${r.destination}`));
  const added = redirects.filter((r) => !before.has(`${r.source}>${r.destination}`));
  if (redirects.length || existsSync(vPath)) {
    const next = { ...config, redirects };
    if (!redirects.length) delete (next as Record<string, unknown>).redirects;
    writeFileSync(vPath, JSON.stringify(next, null, 2) + '\n', 'utf8');
  }
  mkdirSync(resolve(repoDir, '.studio'), { recursive: true });
  writeFileSync(ledgerPath(repoDir), JSON.stringify({ version: LEDGER_VERSION, routes: published }, null, 2) + '\n', 'utf8');
  return { added, redirects };
}
