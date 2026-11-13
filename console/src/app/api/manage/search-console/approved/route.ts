import { NextResponse } from 'next/server';
import { readApprovedSpokesFor } from '@/lib/approvedSpokesStore';

/**
 * The spokes approved in Search for this client, for the Studio's town-page sync. Disk only (no
 * KV), so a new client with no approvals gets [] at once. A failure answers 500 and the Studio
 * keeps its composition as it is rather than syncing against a guess.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SLUG = /^[a-z0-9][a-z0-9_-]*$/i;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get('slug') ?? '';
  const site = url.searchParams.get('site');
  if (!SLUG.test(slug) || (site && !SLUG.test(site))) return NextResponse.json({ error: 'Invalid slug.' }, { status: 400 });
  try {
    return NextResponse.json({ approved: await readApprovedSpokesFor(slug, site) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
