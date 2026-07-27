import { NextResponse } from 'next/server';
import { loadVercelCredentials } from '@/lib/opsSecrets';
import { loadVercelSync } from '@/lib/vercelSync';
import { loadManageTarget, resolveLiveUrl } from '@/lib/manageSites';
import { probeUrl } from '@/lib/probe';

/**
 * Is this client's site up right now?
 *
 * Takes a SLUG, never a URL. Resolving the target server-side keeps this from being a
 * general-purpose "fetch any URL for me" endpoint — the console has no auth, so an
 * arbitrary-URL parameter here would be a request-forgery hole for anything that can
 * reach localhost.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const target = await loadManageTarget(url.searchParams.get('slug'), url.searchParams.get('site'));
  if (!target.ok) return NextResponse.json({ error: target.error }, { status: target.status });

  const canonical = target.resolved.site.canonical ?? null;
  let domains: Array<{ name: string; verified: boolean; redirect: string | null }> = [];

  if (loadVercelCredentials()) {
    const { listProjectDomains } = await loadVercelSync();
    const result = await listProjectDomains(target.resolved.site.slug);
    if (result.ok) domains = result.domains;
  }

  const resolved = resolveLiveUrl(domains, canonical);
  if (!resolved.url) {
    return NextResponse.json({ ok: false, status: null, liveUrl: null, source: resolved.source });
  }

  return NextResponse.json({
    ...(await probeUrl(resolved.url)),
    liveUrl: resolved.url,
    source: resolved.source,
  });
}
