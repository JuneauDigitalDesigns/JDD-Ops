import { NextResponse } from 'next/server';
import { loadVercelCredentials } from '@/lib/opsSecrets';
import { loadVercelSync } from '@/lib/vercelSync';
import { loadManageTarget } from '@/lib/manageSites';

/**
 * Recent deployments for one site, so "did my env change actually land?" is answerable
 * in the console. Read-only — triggering one is ./env/redeploy.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const target = await loadManageTarget(url.searchParams.get('slug'), url.searchParams.get('site'));
  if (!target.ok) return NextResponse.json({ error: target.error }, { status: target.status });

  if (!loadVercelCredentials()) {
    return NextResponse.json({
      ok: false,
      reason: 'VERCEL_TOKEN is not set in jdd-ops/.env',
      deployments: [],
    });
  }

  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 10) || 10, 1), 50);
  const { listDeployments } = await loadVercelSync();
  // listDeployments never throws — a missing project comes back as { ok:false, reason }.
  return NextResponse.json(await listDeployments(target.resolved.site.slug, { limit }));
}
