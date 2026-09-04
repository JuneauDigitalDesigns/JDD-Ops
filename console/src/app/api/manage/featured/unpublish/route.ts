import { NextResponse } from 'next/server';
import { del } from '@vercel/blob';
import { loadManageTarget } from '@/lib/manageSites';
import { loadBlobToken } from '@/lib/opsSecrets';
import { getPublishedFeaturedSite, unpublishFeaturedSite } from '@/lib/cancelKv';
import { appendAudit } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { slug?: string; site?: string };
  const target = await loadManageTarget(body.slug ?? null, body.site ?? null);
  if (!target.ok) return NextResponse.json({ error: target.error }, { status: target.status });

  const siteSlug = target.resolved.site.slug;

  // Free the blob as well as the KV record — otherwise unpublishing leaves the screenshot
  // hosted forever. Best-effort and token-gated; a missing token just skips the blob delete.
  const record = await getPublishedFeaturedSite(siteSlug).catch(() => null);
  const token = loadBlobToken();
  if (record?.image && token && isBlobUrl(record.image)) {
    await del(record.image, { token }).catch(() => {});
  }

  await unpublishFeaturedSite(siteSlug);

  appendAudit({
    slug: target.ctx.slug,
    siteSlug,
    action: 'featured.unpublish',
    ok: true,
    summary: `Unpublished featured card for ${siteSlug}`,
  });

  return NextResponse.json({ ok: true });
}

function isBlobUrl(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith('.public.blob.vercel-storage.com');
  } catch {
    return false;
  }
}
