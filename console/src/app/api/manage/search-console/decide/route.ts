import { NextResponse } from 'next/server';
import { loadManageTarget } from '@/lib/manageSites';
import { accountEmailForSite } from '@/lib/searchProfileStore';
import { decideProposal, type Decision } from '@/lib/seoProposals';
import { appendAudit } from '@/lib/audit';

/**
 * Phase 3: the operator decides one proposal: Approve (a spoke, or a merge-back), Not now
 * (declined) or Ask the client for facts (asked). Approving a spoke only adds it to the site's
 * approved list for the Studio; it still needs facts, copy, review and an export. Nothing here
 * publishes anything.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = { slug?: string; site?: string; id?: string; decision?: string };
const DECISIONS = new Set<string>(['approved', 'declined', 'asked']);
const ID = /^(spoke|town|fold):[a-z0-9-]+(:[a-z0-9-]+)?$/;

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const target = await loadManageTarget(body.slug ?? null, body.site ?? null);
  if (!target.ok) return NextResponse.json({ error: target.error }, { status: target.status });
  const id = (body.id ?? '').trim();
  const decision = body.decision ?? '';
  if (!ID.test(id) || !DECISIONS.has(decision)) {
    return NextResponse.json({ error: 'Invalid proposal or decision.' }, { status: 400 });
  }
  const { ctx, resolved } = target;
  const accountEmail = await accountEmailForSite(resolved.env);
  if (!accountEmail) {
    return NextResponse.json({ error: 'This site has no portal account, so it has no Search Console proposals.' }, { status: 409 });
  }
  try {
    const out = await decideProposal({ accountEmail, siteSlug: resolved.site.slug, siteDir: resolved.dir, id, decision: decision as Decision });
    appendAudit({
      slug: ctx.slug,
      siteSlug: resolved.site.slug,
      action: 'search-console.decide',
      ok: true,
      summary: `Search proposal ${id}: ${decision}`,
      detail: { id, decision },
    });
    return NextResponse.json({ ok: true, proposal: out.proposal, approved: out.approved });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 409 });
  }
}
