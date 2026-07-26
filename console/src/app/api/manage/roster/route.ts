import { NextResponse } from 'next/server';
import { listClientContexts } from '@/lib/clients';
import { loadVercelCredentials } from '@/lib/opsSecrets';
import { loadVercelSync } from '@/lib/vercelSync';
import { isManageable, unmanageableReason } from '@/lib/manageSites';
import type { ClientContext } from '@/lib/types';

/**
 * The /manage landing roster: every client, with enough live signal to spot a broken one
 * without opening it.
 *
 * Runs the CHEAP checks only — last deployment state and an HTTP probe of the live site.
 * Env drift is deliberately absent: resolving it costs one Vercel request per key per
 * site (see listProjectEnv), so fanning it across the whole roster would be dozens of
 * requests on every page load. Drift is resolved when you open a client.
 *
 * Every per-client check is independently failable and independently timed out — one
 * unreachable site must never blank the roster.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PROBE_TIMEOUT_MS = 4000;

interface DeployView {
  state: string;
  createdAt: number | null;
  url: string | null;
  inspectorUrl: string | null;
}

interface HttpView {
  ok: boolean;
  status: number | null;
  ms: number;
  error?: string;
}

/**
 * HEAD the live site. Falls back to GET on 405 — some hosts reject HEAD outright, and
 * "405" would otherwise read as an outage.
 */
async function probe(url: string): Promise<HttpView> {
  const started = Date.now();
  try {
    let res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      cache: 'no-store',
    });
    if (res.status === 405) {
      res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
        cache: 'no-store',
      });
    }
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

/**
 * The URL to probe: the client's custom domain when set, else the Vercel alias.
 *
 * The `.replace(/_/g, '-')` is not cosmetic — underscores are legal in a Vercel project
 * name but not in a DNS hostname, and Vercel serves the project at the hyphenated form.
 * onboard.js applies the same rule when it sets the Twilio voiceUrl (see CLAUDE.md);
 * without it, `_e2e_test_growth` probes a hostname that cannot resolve.
 */
function liveUrlFor(ctx: ClientContext): string | null {
  const canonical = ctx.sites[0]?.canonical;
  if (canonical) return canonical.startsWith('http') ? canonical : `https://${canonical}`;
  const project = ctx.sites[0]?.env?.VERCEL_PROJECT_NAME;
  if (!project) return null;
  const host = project.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  return `https://${host}.vercel.app`;
}

export async function GET() {
  let clients: ClientContext[] = [];
  try {
    clients = await listClientContexts();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to read clients/', rows: [] },
      { status: 500 },
    );
  }

  const vercelConfigured = loadVercelCredentials();
  const vercel = vercelConfigured ? await loadVercelSync().catch(() => null) : null;

  const rows = await Promise.all(
    clients.map(async (ctx) => {
      const manageable = isManageable(ctx);
      const liveUrl = liveUrlFor(ctx);
      const siteSlug = ctx.sites[0]?.slug ?? ctx.slug;

      // Only probe clients that actually have something deployed to look at.
      const [deploy, http] = await Promise.all([
        manageable && vercel
          ? vercel
              .listDeployments(siteSlug, { limit: 1 })
              .then((r): DeployView | null => {
                const d = r.deployments[0];
                return d
                  ? {
                      state: d.state,
                      createdAt: d.createdAt,
                      url: d.url,
                      inspectorUrl: d.inspectorUrl,
                    }
                  : null;
              })
              .catch(() => null)
          : Promise.resolve(null),
        manageable && liveUrl ? probe(liveUrl) : Promise.resolve(null),
      ]);

      return {
        slug: ctx.slug,
        brandName: ctx.brandName,
        plan: ctx.plan,
        isEnterprise: ctx.isEnterprise,
        detectedStatus: ctx.detectedStatus,
        hasIntake: ctx.hasIntake,
        manageable,
        reason: unmanageableReason(ctx),
        siteCount: ctx.sites.length,
        liveUrl,
        deploy,
        http,
      };
    }),
  );

  return NextResponse.json({ vercelConfigured, rows });
}
