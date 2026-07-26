import { NextResponse } from 'next/server';
import { readAudit } from '@/lib/audit';
import { SLUG_RE } from '@/lib/manageSites';

/**
 * Recent /manage writes, newest first. Rendered as "Recent activity" on a client's
 * Overview; omit `slug` for the console-wide feed.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = (url.searchParams.get('slug') ?? '').trim();
  if (slug && !SLUG_RE.test(slug)) {
    return NextResponse.json({ error: 'Invalid client slug.' }, { status: 400 });
  }
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 20) || 20, 1), 200);
  return NextResponse.json({ entries: readAudit({ slug: slug || undefined, limit }) });
}
