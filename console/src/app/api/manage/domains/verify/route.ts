import { NextResponse } from 'next/server';
import { loadVercelCredentials } from '@/lib/opsSecrets';
import { loadVercelSync } from '@/lib/vercelSync';
import { loadManageTarget } from '@/lib/manageSites';
import { appendAudit } from '@/lib/audit';

/**
 * Re-check a pending domain after the operator has updated DNS at the registrar.
 *
 * Vercel does verify on its own eventually, but not on a timescale that's useful while
 * you're sitting there having just pasted a record in — hence the button.
 *
 * A refusal here is the NORMAL case (DNS hasn't propagated yet), so this returns 200 with
 * `verified: false` and the reason rather than an error status. Only a genuine failure to
 * reach Vercel is a 5xx. The fresh config comes back either way so the UI can show what
 * DNS currently looks like.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = { slug?: string; site?: string; domain?: string };

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const target = await loadManageTarget(body.slug ?? null, body.site ?? null);
  if (!target.ok) return NextResponse.json({ error: target.error }, { status: target.status });

  const domain = (body.domain ?? '').trim().toLowerCase();
  if (!domain) return NextResponse.json({ error: 'No domain given.' }, { status: 400 });

  if (!loadVercelCredentials()) {
    return NextResponse.json({ error: 'VERCEL_TOKEN is not set in jdd-ops/.env.' }, { status: 500 });
  }

  const { ctx, resolved } = target;
  const { verifyProjectDomain, getDomainConfig } = await loadVercelSync();

  const [result, config] = await Promise.all([
    verifyProjectDomain(resolved.site.slug, domain),
    getDomainConfig(domain),
  ]);

  // Only log the transition worth knowing about; a failed re-check is expected noise
  // while DNS propagates and would bury the real events in the activity feed.
  if (result.verified) {
    appendAudit({
      slug: ctx.slug,
      siteSlug: resolved.site.slug,
      action: 'domain.verify',
      ok: true,
      summary: `${domain} verified on Vercel`,
      detail: { domain },
    });
  }

  return NextResponse.json({
    ok: result.ok,
    verified: result.verified,
    reason: result.reason,
    domain: result.domain,
    config,
  });
}
