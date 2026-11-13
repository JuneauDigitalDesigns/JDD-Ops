import { NextResponse } from 'next/server';
import { loadManageTarget } from '@/lib/manageSites';
import { accountEmailForSite, readSearchProfile } from '@/lib/searchProfileStore';
import { listSiteProposals, readApproved } from '@/lib/seoProposals';

/**
 * Phase 3: the nightly job's proposals for one site, the spokes already approved, and whether
 * JDD has set Search Console up (the profile's property). Read-only. The Studio reads `approved`
 * to pass to chosenSpokePages.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const target = await loadManageTarget(url.searchParams.get('slug'), url.searchParams.get('site'));
  if (!target.ok) return NextResponse.json({ error: target.error }, { status: target.status });
  const { resolved } = target;
  const approved = await readApproved(resolved.dir).catch(() => []);
  const accountEmail = await accountEmailForSite(resolved.env);
  if (!accountEmail) return NextResponse.json({ property: null, verifiedAt: null, proposals: [], approved });
  try {
    const [profile, proposals] = await Promise.all([
      readSearchProfile(accountEmail, resolved.site.slug),
      listSiteProposals(accountEmail, resolved.site.slug),
    ]);
    return NextResponse.json({ property: profile?.property ?? null, verifiedAt: profile?.verifiedAt ?? null, proposals, approved });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err), approved }, { status: 502 });
  }
}
