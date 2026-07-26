import { NextResponse } from 'next/server';
import { loadManageTarget } from '@/lib/manageSites';
import { accountStoreConfigured, getAccount, getAccountEmailByUserId } from '@/lib/accountStore';

/**
 * What the portal currently knows about this client: which account they sign in with, and
 * which sites are attached to it.
 *
 * The read side the old batch repair tool never had — it could attach, but gave you no way
 * to see whether a client was already linked or what the account holds.
 *
 * Resolution goes CLERK_USER_ID (from .env.local) → jdd:account-by-user: index → email →
 * account record. A client who hasn't signed into the portal yet has no index entry, which
 * is a normal state, not an error.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const target = await loadManageTarget(url.searchParams.get('slug'), url.searchParams.get('site'));
  if (!target.ok) return NextResponse.json({ error: target.error }, { status: target.status });

  if (!accountStoreConfigured()) {
    return NextResponse.json({
      configured: false,
      note: 'KV is not configured — portal account records are unavailable.',
      clerkUserId: null,
      email: null,
      sites: [],
    });
  }

  // Any site of the client can carry the link; check them all so an enterprise client
  // linked via site 2 still resolves.
  const clerkUserId =
    target.resolved.env.CLERK_USER_ID ??
    target.ctx.sites.map((s) => s.env.CLERK_USER_ID).find(Boolean) ??
    null;

  if (!clerkUserId) {
    return NextResponse.json({
      configured: true,
      clerkUserId: null,
      email: null,
      sites: [],
      note: 'No CLERK_USER_ID on disk — this client has not been linked to a portal account.',
    });
  }

  try {
    const email = await getAccountEmailByUserId(clerkUserId);
    if (!email) {
      return NextResponse.json({
        configured: true,
        clerkUserId,
        email: null,
        sites: [],
        note: 'A Clerk user is recorded, but no portal account is indexed against it yet.',
      });
    }

    const account = await getAccount(email);
    return NextResponse.json({
      configured: true,
      clerkUserId,
      email,
      sites: (account?.sites ?? []).map((s) => ({
        slug: s.slug,
        name: s.name,
        plan: s.plan,
        status: s.status,
        airtableBaseId: s.airtableBaseId ?? null,
        /** Whether this account entry belongs to the client we're looking at. */
        mine: target.ctx.sites.some((cs) => cs.slug === s.slug),
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to read the portal account.' },
      { status: 502 },
    );
  }
}
