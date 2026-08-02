import { NextResponse } from 'next/server';
import { listClientContexts } from '@/lib/clients';
import { loadVercelCredentials } from '@/lib/opsSecrets';
import { loadVercelSync } from '@/lib/vercelSync';
import { isManageable, resolveLiveUrl } from '@/lib/manageSites';
import { probeUrl, type ProbeResult } from '@/lib/probe';

/**
 * Live health for the /manage roster, keyed by slug.
 *
 * Returns ONLY the health — the rows themselves are server-rendered from disk by
 * manage/page.tsx, which is instant. Splitting them matters: the HTTP probe alone can
 * take seconds against an unreachable domain, and blocking the whole roster on that
 * would mean staring at a spinner before you can even see the client list.
 *
 * Runs the CHEAP checks only. Env drift is deliberately absent — resolving it costs one
 * Vercel request per key per site (see listProjectEnv), so it is an explicit button on
 * the roster rather than something that fires on every page load.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type HttpView = ProbeResult;

export async function GET(req: Request) {
  // Mirror the client list's fixture filter, or health comes back keyed for a population the
  // index isn't showing — and we'd spend probes on fixtures nobody asked about.
  const includeFixtures = new URL(req.url).searchParams.get('fixtures') === '1';
  const clients = await listClientContexts({ includeFixtures }).catch(() => []);
  const vercelConfigured = loadVercelCredentials();
  const vercel = vercelConfigured ? await loadVercelSync().catch(() => null) : null;

  const health: Record<
    string,
    { deploy: unknown; http: HttpView | null; liveUrl: string | null; urlSource: string }
  > = {};

  await Promise.all(
    clients.filter(isManageable).map(async (ctx) => {
      const siteSlug = ctx.sites[0]?.slug ?? ctx.slug;
      const canonical = ctx.sites[0]?.canonical ?? null;

      // Ask Vercel where the site actually lives BEFORE probing. Probing seo.canonical
      // reported healthy clients as down, because that field is a placeholder until
      // someone fills it in. One extra request per client — the same order of cost as
      // the deployment lookup, and nothing like drift's per-key fan-out.
      const [deploy, resolved] = await Promise.all([
        vercel
          ? vercel
              .listDeployments(siteSlug, { limit: 1 })
              .then((r) => {
                const d = r.deployments[0];
                return d
                  ? { state: d.state, createdAt: d.createdAt, url: d.url, inspectorUrl: d.inspectorUrl }
                  : null;
              })
              .catch(() => null)
          : Promise.resolve(null),
        vercel
          ? vercel
              .listProjectDomains(siteSlug)
              .then((r) => resolveLiveUrl(r.ok ? r.domains : [], canonical))
              .catch(() => resolveLiveUrl([], canonical))
          : Promise.resolve(resolveLiveUrl([], canonical)),
      ]);

      const http = resolved.url ? await probeUrl(resolved.url) : null;
      health[ctx.slug] = { deploy, http, liveUrl: resolved.url, urlSource: resolved.source };
    }),
  );

  return NextResponse.json({ vercelConfigured, health });
}
