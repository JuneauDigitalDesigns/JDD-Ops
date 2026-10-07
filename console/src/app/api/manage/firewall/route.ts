import { NextResponse } from 'next/server';
import { getClientContext } from '@/lib/clients';
import { loadVercelCredentials } from '@/lib/opsSecrets';
import { loadVercelSync } from '@/lib/vercelSync';
import { appendAudit } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SLUG_RE = /^[A-Za-z0-9_-]+$/;

/** GET /api/manage/firewall?slug=xxx — read current JDD WAF rule state */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = (searchParams.get('slug') ?? '').trim();
  if (!SLUG_RE.test(slug)) {
    return NextResponse.json({ error: 'Invalid client slug.' }, { status: 400 });
  }
  if (!loadVercelCredentials()) {
    return NextResponse.json({ error: 'VERCEL_TOKEN is not set.' }, { status: 500 });
  }
  try {
    const { getFirewallStatus } = await loadVercelSync();
    const result = await getFirewallStatus(slug);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Firewall status check failed.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

/** POST /api/manage/firewall  body: { slug } — apply/re-apply the JDD WAF rules */
export async function POST(req: Request) {
  let body: { slug?: string };
  try {
    body = (await req.json()) as { slug?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const slug = (body.slug ?? '').trim();
  if (!SLUG_RE.test(slug)) {
    return NextResponse.json({ error: 'Invalid client slug.' }, { status: 400 });
  }

  const ctx = await getClientContext(slug);
  if (!ctx) {
    return NextResponse.json({ error: `Unknown client: ${slug}` }, { status: 404 });
  }

  if (!loadVercelCredentials()) {
    return NextResponse.json({ error: 'VERCEL_TOKEN is not set.' }, { status: 500 });
  }

  try {
    const { syncVercelFirewall } = await loadVercelSync();
    const result = await syncVercelFirewall(slug, { log: () => {} });
    appendAudit({
      slug,
      siteSlug: slug,
      action: 'firewall.apply',
      ok: result.ok,
      summary: result.ok
        ? `Firewall rules applied: ${result.applied?.join('; ')}`
        : `Firewall apply failed: ${result.reason}`,
      detail: { ...result },
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Firewall apply failed.';
    appendAudit({ slug, siteSlug: slug, action: 'firewall.apply', ok: false, summary: message });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
