import { NextResponse } from 'next/server';
import { listClientContexts } from '@/lib/clients';
import { loadVercelCredentials } from '@/lib/opsSecrets';
import { loadVercelSync } from '@/lib/vercelSync';
import { isManageable, liveUrlFor } from '@/lib/manageSites';

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

const PROBE_TIMEOUT_MS = 4000;

interface HttpView {
  ok: boolean;
  status: number | null;
  ms: number;
  error?: string;
}

/**
 * HEAD the live site, falling back to GET on 405 — some hosts reject HEAD outright and
 * "405" would otherwise read as an outage.
 */
async function probe(url: string): Promise<HttpView> {
  const started = Date.now();
  const opts = {
    redirect: 'follow' as const,
    signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    cache: 'no-store' as const,
  };
  try {
    let res = await fetch(url, { method: 'HEAD', ...opts });
    if (res.status === 405) res = await fetch(url, { method: 'GET', ...opts });
    return { ok: res.ok, status: res.status, ms: Date.now() - started };
  } catch (err) {
    return {
      ok: false,
      status: null,
      ms: Date.now() - started,
      error: err instanceof Error ? err.message : 'unreachable',
    };
  }
}

export async function GET() {
  const clients = await listClientContexts().catch(() => []);
  const vercelConfigured = loadVercelCredentials();
  const vercel = vercelConfigured ? await loadVercelSync().catch(() => null) : null;

  const health: Record<
    string,
    { deploy: unknown; http: HttpView | null }
  > = {};

  await Promise.all(
    clients.filter(isManageable).map(async (ctx) => {
      const siteSlug = ctx.sites[0]?.slug ?? ctx.slug;
      const liveUrl = liveUrlFor(ctx);

      const [deploy, http] = await Promise.all([
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
        liveUrl ? probe(liveUrl) : Promise.resolve(null),
      ]);

      health[ctx.slug] = { deploy, http };
    }),
  );

  return NextResponse.json({ vercelConfigured, health });
}
