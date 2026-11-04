import { NextResponse } from 'next/server';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { isLoopback } from '@/lib/loopback';
import { resolveRepoRoot } from '@/lib/export';
import { checkSiteId } from '@/lib/siteId';
import { loadStore } from '@/lib/a2pChain';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Is this Site ID free on the console's side: no `clients/<slug>/` folder and no A2P record?
 * The agency's claim when the order is saved is the final word (it also checks other orders and
 * the client's portal account); this just lets the Order step say "✓ Available" as you type.
 */
export async function GET(req: Request) {
  if (!isLoopback(req)) return NextResponse.json({ error: 'Available on localhost only.' }, { status: 403 });
  const slug = (new URL(req.url).searchParams.get('slug') ?? '').trim();

  const shape = checkSiteId(slug);
  if (shape) return NextResponse.json({ available: false, reason: shape });

  if (existsSync(resolve(resolveRepoRoot(), 'clients', slug, 'site.ts'))) {
    return NextResponse.json({ available: false, reason: 'A client already uses this Site ID.' });
  }
  try {
    if (await (await loadStore()).readRegistration({ slug })) {
      return NextResponse.json({ available: false, reason: 'This Site ID already has a texting registration.' });
    }
  } catch {
    // No A2P store reachable is not a reason to refuse; the agency claim still runs.
  }
  return NextResponse.json({ available: true });
}
