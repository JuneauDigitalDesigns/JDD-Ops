import { extname } from 'node:path';
import { NextResponse } from 'next/server';
import { del, put } from '@vercel/blob';
import { loadManageTarget } from '@/lib/manageSites';
import { loadBlobToken } from '@/lib/opsSecrets';
import {
  cancelKvConfigured,
  getFeaturedRequestRecord,
  getPublishedFeaturedSite,
  publishFeaturedSite,
} from '@/lib/cancelKv';
import { appendAudit } from '@/lib/audit';
import { resolveShotUrl, captureScreenshot } from '@/lib/screenshot';

/**
 * Publish a client's opt-in to the homepage. Multipart so the operator can hand over a
 * screenshot straight from their machine when they choose to. The image, in priority order:
 *
 *  1. An operator file upload, if one is attached — a manual override always wins, whatever
 *     the client chose at opt-in.
 *  2. A fresh capture, when the client chose auto-screenshot (`imageMode === 'auto'`) or the
 *     operator explicitly asks for one (`recapture`) — e.g. to refresh a stale client image.
 *  3. The client's own upload already on the request record (`imageMode === 'upload'`),
 *     reused as-is — it is already a Blob URL, so there is nothing to re-host.
 *  4. Otherwise, a 400 telling the operator to supply an image one of the other ways.
 *
 * The screenshot goes to Vercel Blob, not the agency repo's /public: publishing is a
 * runtime act (the KV record the homepage reads is written live), and a /public file is a
 * deploy-time asset that would 404 on the deployed site until a redeploy. A blob URL is a
 * CDN asset that appears the instant it's written, matching the KV record.
 *
 * Consent is baked into the record here, from the client's own opt-in choice
 * (`FeaturedRequestRecord.showName`/`showLink`), NOT from anything the operator types — the
 * operator supplies the image, not the client's privacy choice. An anonymous opt-in can
 * never end up credited by a stray form field.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OK_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(req: Request) {
  const form = await req.formData();
  const slugParam = form.get('slug');
  const siteParam = form.get('site');
  const file = form.get('file');
  const recapture = form.get('recapture') === 'true';

  const target = await loadManageTarget(
    typeof slugParam === 'string' ? slugParam : null,
    typeof siteParam === 'string' ? siteParam : null,
  );
  if (!target.ok) return NextResponse.json({ error: target.error }, { status: target.status });

  if (!cancelKvConfigured()) {
    return NextResponse.json({ error: 'KV is not configured.' }, { status: 400 });
  }

  const token = loadBlobToken();
  if (!token) {
    return NextResponse.json(
      { error: 'No BLOB_READ_WRITE_TOKEN — add it to jdd-ops/.env to publish screenshots.' },
      { status: 400 },
    );
  }

  const siteSlug = target.resolved.site.slug;
  const featured = await getFeaturedRequestRecord(siteSlug).catch(() => null);
  if (!featured) {
    return NextResponse.json(
      { error: 'This client has not opted in to being featured.' },
      { status: 400 },
    );
  }

  // The URL we're about to replace, so we can free it once the new one is committed.
  const previous = await getPublishedFeaturedSite(siteSlug).catch(() => null);

  let imageUrl: string;

  if (file instanceof File) {
    // 1. Operator upload — always the override.
    const ext = extname(file.name).toLowerCase();
    if (!OK_EXT.has(ext)) {
      return NextResponse.json(
        { error: 'Unsupported image type — use jpg, png or webp.' },
        { status: 400 },
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Max 8 MB.' }, { status: 400 });
    }
    // Random suffix → a unique URL per publish, so a republish is never served stale from
    // the CDN cache.
    const blob = await put(`featured/${siteSlug}${ext}`, Buffer.from(await file.arrayBuffer()), {
      access: 'public',
      token,
      contentType: file.type || undefined,
      addRandomSuffix: true,
    });
    imageUrl = blob.url;
  } else if (featured.imageMode === 'auto' || recapture) {
    // 2. Fresh capture — either the client asked for auto-screenshot, or the operator wants
    // to refresh whatever image is on file.
    const shotTarget = resolveShotUrl(featured.siteUrl);
    if (!shotTarget) {
      return NextResponse.json(
        { error: 'No resolvable site URL to screenshot — upload an image instead.' },
        { status: 400 },
      );
    }
    let captured: Awaited<ReturnType<typeof captureScreenshot>>;
    try {
      captured = await captureScreenshot(shotTarget);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? `Capture failed: ${err.message}` : 'Capture failed.' },
        { status: 502 },
      );
    }
    const blob = await put(`featured/${siteSlug}.png`, captured.bytes, {
      access: 'public',
      token,
      contentType: captured.contentType,
      addRandomSuffix: true,
    });
    imageUrl = blob.url;
  } else if (featured.image) {
    // 3. The client's own upload — already a Blob URL, reuse directly.
    imageUrl = featured.image;
  } else {
    return NextResponse.json(
      { error: 'No image on file — upload a screenshot or capture one.' },
      { status: 400 },
    );
  }

  const credited = featured.showName && featured.showLink;
  await publishFeaturedSite(
    {
      slug: siteSlug,
      image: imageUrl,
      businessName: credited ? featured.siteName : undefined,
      url: credited ? (featured.siteUrl ?? undefined) : undefined,
      quote: featured.quote,
    },
    featured.optedInAt,
  );

  // Only after the record points at the new blob — deleting first would risk a window with a
  // dead image if the write failed. Best-effort: an orphaned blob is cheap, a broken card
  // isn't. A client-uploaded image may live in the agency site's Blob store rather than the
  // console's, in which case this token can't delete it — that failure is swallowed same as
  // any other, and the orphan is accepted (see the plan's caveat on cross-store cleanup).
  if (previous?.image && previous.image !== imageUrl && isBlobUrl(previous.image)) {
    await del(previous.image, { token }).catch(() => {});
  }

  appendAudit({
    slug: target.ctx.slug,
    siteSlug,
    action: 'featured.publish',
    ok: true,
    summary: `Published featured card for ${siteSlug} (${credited ? 'credited' : 'anonymous'})`,
    detail: { credited },
  });

  return NextResponse.json({ ok: true, image: imageUrl });
}

function isBlobUrl(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith('.public.blob.vercel-storage.com');
  } catch {
    return false;
  }
}
