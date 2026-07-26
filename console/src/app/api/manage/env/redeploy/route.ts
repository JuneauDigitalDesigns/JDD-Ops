import { NextResponse } from 'next/server';
import { getClientContext } from '@/lib/clients';
import { loadVercelCredentials } from '@/lib/opsSecrets';
import { loadVercelSync } from '@/lib/vercelSync';

/**
 * Kick a production deployment so env vars synced by ../route.ts actually take effect.
 *
 * Deliberately a separate call rather than a step inside the save: env changes are cheap
 * and reversible, a deploy takes the client's live site through a fresh build. The UI
 * saves first, then offers this.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SLUG_RE = /^[A-Za-z0-9_-]+$/;

type Body = { slug?: string; siteSlug?: string };

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const slug = (body.slug ?? '').trim();
  const siteSlug = (body.siteSlug ?? '').trim() || slug;
  if (!SLUG_RE.test(slug) || !SLUG_RE.test(siteSlug)) {
    return NextResponse.json({ error: 'Invalid client slug.' }, { status: 400 });
  }

  // Only deploy sites we actually know about, so a typo can't hit an unrelated project.
  const ctx = await getClientContext(slug);
  if (!ctx || !ctx.sites.some((s) => s.slug === siteSlug)) {
    return NextResponse.json({ error: `${siteSlug} is not a site of ${slug}.` }, { status: 400 });
  }

  if (!loadVercelCredentials()) {
    return NextResponse.json(
      { error: 'VERCEL_TOKEN is not set in jdd-ops/.env.' },
      { status: 500 },
    );
  }

  try {
    const { triggerRedeploy } = await loadVercelSync();
    const deployment = await triggerRedeploy({ slug: siteSlug, log: () => {} });
    return NextResponse.json({ ok: true, deployment });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Redeploy failed.' },
      { status: 502 },
    );
  }
}
