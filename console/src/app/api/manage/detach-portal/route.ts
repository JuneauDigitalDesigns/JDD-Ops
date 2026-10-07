import { NextResponse } from 'next/server';
import { accountStoreConfigured, detachSiteFromAccount } from '@/lib/accountStore';
import { appendAudit } from '@/lib/audit';

/**
 * Detach one site from a portal account: the inverse of `link-portal`.
 *
 * Removes the site -> account mapping ONLY. It deliberately does not scrub CLERK_USER_ID
 * from the client's disk env, delete the Clerk user, or touch the account-by-user index, so
 * the site can be re-attached to the right email afterwards. Full removal is `teardown`.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = { email?: unknown; siteSlug?: unknown; slug?: unknown };

const SLUG_RE = /^[A-Za-z0-9_-]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const siteSlug = typeof body.siteSlug === 'string' ? body.siteSlug.trim() : '';
  const clientSlug = typeof body.slug === 'string' && body.slug.trim() ? body.slug.trim() : siteSlug;

  if (!email || !siteSlug) {
    return NextResponse.json({ error: 'email and siteSlug are required.' }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'A valid account email is required.' }, { status: 400 });
  }
  if (!SLUG_RE.test(siteSlug) || !SLUG_RE.test(clientSlug)) {
    return NextResponse.json({ error: 'Invalid slug.' }, { status: 400 });
  }
  if (!accountStoreConfigured()) {
    return NextResponse.json(
      { error: 'KV not configured — set KV_REST_API_URL and KV_REST_API_TOKEN in jdd-ops/.env.' },
      { status: 500 },
    );
  }

  try {
    const account = await detachSiteFromAccount(email, siteSlug);
    if (!account) {
      appendAudit({
        slug: clientSlug,
        siteSlug,
        action: 'portal.detach',
        ok: true,
        summary: `Detach ${siteSlug}: no account for ${email}`,
        detail: { email, detached: false },
      });
      return NextResponse.json({ ok: true, detached: false, note: `No account for ${email}.` });
    }
    appendAudit({
      slug: clientSlug,
      siteSlug,
      action: 'portal.detach',
      ok: true,
      summary: `Detached ${siteSlug} from ${email}`,
      detail: { email, sitesRemaining: account.sites.length },
    });
    return NextResponse.json({
      ok: true,
      detached: true,
      email,
      siteSlug,
      sitesRemaining: account.sites.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Detach failed.';
    appendAudit({ slug: clientSlug, siteSlug, action: 'portal.detach', ok: false, summary: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
