import { NextResponse } from 'next/server';
import { loadManageTarget, resolveLiveUrl } from '@/lib/manageSites';
import { loadVercelCredentials } from '@/lib/opsSecrets';
import { loadVercelSync } from '@/lib/vercelSync';
import { resolveRepoRoot, readRepoSiteContent } from '@/lib/export';
import { loadProvisionedFields } from '@/lib/provisionedFields';
import { searchConsole } from '@/lib/searchConsole';
import { accountEmailForSite, publishSearchProfile } from '@/lib/searchProfileStore';
import { appendAudit } from '@/lib/audit';

/**
 * L11: JDD verifies a site's Google Search Console property itself, then lists it, submits its
 * sitemap, adds the client's Google account as an owner, and publishes the site's search profile
 * for the agency's nightly job. The client grants nothing.
 *
 * The property is the host the site actually lives on, as Vercel reports it: the verified custom
 * domain when one is attached, else the vercel.app alias. A custom domain attached later is a NEW
 * property (one URL-prefix property covers one host), so this is run again then.
 *
 * Needs the site exported and deployed first: Google fetches JDD's token file, which every export
 * writes. Every step is idempotent, so running it again is safe.
 *
 * The client's Google account comes from the operator (`ownerEmail`), never inferred: a portal
 * sign-in address need not be a Google account. It is passed to Google only and never written to
 * the audit log or any file.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = { slug?: string; site?: string; ownerEmail?: string };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const target = await loadManageTarget(body.slug ?? null, body.site ?? null);
  if (!target.ok) return NextResponse.json({ error: target.error }, { status: target.status });
  const { ctx, resolved } = target;
  const siteSlug = resolved.site.slug;

  const ownerEmail = (body.ownerEmail ?? '').trim();
  if (ownerEmail && !EMAIL.test(ownerEmail)) {
    return NextResponse.json({ error: 'That isn’t an email address.' }, { status: 400 });
  }

  const gsc = await searchConsole().catch(() => null);
  if (!gsc) {
    return NextResponse.json(
      { error: 'Google Search Console isn’t set up on this machine. Run npm run google-sign-in in jdd-ops first.' },
      { status: 503 },
    );
  }

  if (!loadVercelCredentials()) {
    return NextResponse.json({ error: 'VERCEL_TOKEN not set, so the site’s live address can’t be confirmed.' }, { status: 503 });
  }
  const domains = await (await loadVercelSync()).listProjectDomains(siteSlug);
  const live = resolveLiveUrl(domains.ok ? domains.domains : [], null);
  if (!live.url) {
    return NextResponse.json({ error: 'Vercel reports no address for this site yet. Deploy it first.' }, { status: 409 });
  }
  const property = gsc.mod.propertyUrl(live.url);

  let steps;
  try {
    steps = await gsc.mod.setupProperty({
      client: gsc.client,
      property,
      sitemapUrl: `${property}sitemap.xml`,
      ownerEmails: ownerEmail ? [ownerEmail] : [],
    });
  } catch (err) {
    const failed = (err as { steps?: unknown }).steps ?? [];
    appendAudit({
      slug: ctx.slug,
      siteSlug,
      action: 'search-console.verify',
      ok: false,
      summary: `Search Console setup stopped for ${property}`,
      detail: { property, steps: (failed as Array<{ name: string; ok: boolean }>).map((s) => `${s.name}:${s.ok ? 'ok' : 'failed'}`) },
    });
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err), property, steps: failed }, { status: 502 });
  }

  const verifiedAt = new Date().toISOString();
  const accountEmail = await accountEmailForSite(resolved.env);
  const pf = await loadProvisionedFields();
  const content = readRepoSiteContent(resolveRepoRoot(), siteSlug, pf.extractContentObject);
  const profile =
    accountEmail && content
      ? await publishSearchProfile({ accountEmail, siteSlug, content, property, verifiedAt }).catch((e) => ({
          written: false,
          reason: e instanceof Error ? e.message : String(e),
        }))
      : { written: false, reason: accountEmail ? 'no exported site.ts in the client repo' : 'no portal account for this site' };

  appendAudit({
    slug: ctx.slug,
    siteSlug,
    action: 'search-console.verify',
    ok: true,
    summary: `Search Console set up for ${property}`,
    detail: { property, owner: ownerEmail ? 'added' : 'none', profile: profile.written ? 'published' : profile.reason },
  });
  return NextResponse.json({ ok: true, property, source: live.source, steps, profile });
}
