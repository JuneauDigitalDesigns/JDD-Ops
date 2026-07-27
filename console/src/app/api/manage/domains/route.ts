import { NextResponse } from 'next/server';
import { loadVercelCredentials } from '@/lib/opsSecrets';
import { loadVercelSync, type DomainConfig, type ProjectDomain } from '@/lib/vercelSync';
import { loadManageTarget, resolveLiveUrl } from '@/lib/manageSites';
import { appendAudit } from '@/lib/audit';

/**
 * A site's domains, and — the important part — where it ACTUALLY serves.
 *
 * This is the single source the rail's "Open site" link, the Overview health tile, and the
 * Domain section all read. Before this, each derived a URL from `seo.canonical`, which is a
 * placeholder until someone fills it in, so a healthy client could show as down while the
 * link pointed at a domain that was never theirs.
 *
 * DNS config is fetched only for UNVERIFIED custom domains — that is the one case where the
 * operator needs to know what their registrar is missing. Verified domains and the
 * `*.vercel.app` alias skip the extra request.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DOMAIN_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;

export interface DomainView extends ProjectDomain {
  /** Present only when we looked it up — see the note above. */
  config?: DomainConfig;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const target = await loadManageTarget(url.searchParams.get('slug'), url.searchParams.get('site'));
  if (!target.ok) return NextResponse.json({ error: target.error }, { status: target.status });

  const canonical = target.resolved.site.canonical ?? null;

  if (!loadVercelCredentials()) {
    // No token: fall back to what site.ts claims and say so via `source`.
    const resolved = resolveLiveUrl([], canonical);
    return NextResponse.json({
      ok: false,
      reason: 'VERCEL_TOKEN is not set in jdd-ops/.env',
      domains: [],
      canonical,
      liveUrl: resolved.url,
      source: resolved.source,
    });
  }

  const { listProjectDomains, getDomainConfig } = await loadVercelSync();
  const result = await listProjectDomains(target.resolved.site.slug);

  const domains: DomainView[] = await Promise.all(
    result.domains.map(async (d) => {
      if (d.verified || d.name.endsWith('.vercel.app')) return d;
      return { ...d, config: await getDomainConfig(d.name) };
    }),
  );

  const resolved = resolveLiveUrl(result.ok ? result.domains : [], canonical);
  return NextResponse.json({
    ...result,
    domains,
    canonical,
    // Named liveUrl, not url — this payload is full of domains and a bare `url` reads
    // like it belongs to one of them.
    liveUrl: resolved.url,
    source: resolved.source,
  });
}

type PostBody = { slug?: string; site?: string; domain?: string };

/**
 * Attach a custom domain to this site's Vercel project.
 *
 * Outward-facing: this touches a live project, and Vercel's refusals are informative
 * ("already assigned to another project"), so its `reason` is surfaced verbatim rather
 * than flattened into a status code. Never retried automatically.
 *
 * Attaching does not make the domain live — the response carries the DNS config so the UI
 * can immediately show what the registrar still needs.
 */
export async function POST(req: Request) {
  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const target = await loadManageTarget(body.slug ?? null, body.site ?? null);
  if (!target.ok) return NextResponse.json({ error: target.error }, { status: target.status });

  const domain = (body.domain ?? '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!DOMAIN_RE.test(domain)) {
    return NextResponse.json({ error: `"${domain}" doesn't look like a domain name.` }, { status: 400 });
  }

  if (!loadVercelCredentials()) {
    return NextResponse.json({ error: 'VERCEL_TOKEN is not set in jdd-ops/.env.' }, { status: 500 });
  }

  const { ctx, resolved } = target;
  const { addProjectDomain, getDomainConfig } = await loadVercelSync();
  const added = await addProjectDomain(resolved.site.slug, domain);

  if (!added.ok) {
    appendAudit({
      slug: ctx.slug,
      siteSlug: resolved.site.slug,
      action: 'domain.add',
      ok: false,
      summary: `Could not attach ${domain}: ${added.reason}`,
      detail: { domain },
    });
    return NextResponse.json({ error: added.reason ?? 'Add domain failed.' }, { status: 502 });
  }

  appendAudit({
    slug: ctx.slug,
    siteSlug: resolved.site.slug,
    action: 'domain.add',
    ok: true,
    summary: `Attached ${domain} to ${resolved.site.slug}`,
    detail: { domain, verified: added.domain?.verified ?? false },
  });

  return NextResponse.json({
    ok: true,
    domain: added.domain,
    config: await getDomainConfig(domain),
  });
}
