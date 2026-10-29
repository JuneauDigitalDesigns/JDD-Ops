import { NextResponse } from 'next/server';
import { loadVercelCredentials } from '@/lib/opsSecrets';
import { loadVercelSync } from '@/lib/vercelSync';

/**
 * Latest PREVIEW deployment for one site, so the onboarding launch screen can show a live
 * building → ready readout after onboard.js triggers the preview deploy (step 9). Read-only;
 * promotion to production happens in the Vercel dashboard, not here.
 *
 * Takes the exact Vercel project slug (the site slug) as `?slug=` — the launch screen already
 * knows it from the client context, so this route does not need the manage-side site resolver.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SLUG_RE = /^[A-Za-z0-9_-]+$/;

export async function GET(req: Request) {
  const slug = (new URL(req.url).searchParams.get('slug') ?? '').trim();
  if (!slug || !SLUG_RE.test(slug)) {
    return NextResponse.json({ ok: false, reason: 'Invalid or missing slug', deployments: [] }, { status: 400 });
  }

  if (!loadVercelCredentials()) {
    return NextResponse.json({ ok: false, reason: 'VERCEL_TOKEN is not set in jdd-ops/.env', deployments: [] });
  }

  const { listDeployments } = await loadVercelSync();
  // Never throws — a missing project comes back as { ok:false, reason }.
  return NextResponse.json(await listDeployments(slug, { target: 'preview', limit: 1 }));
}
