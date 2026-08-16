import { NextResponse } from 'next/server';
import { appendAudit } from '@/lib/audit';
import { loadPortalOpsConfig } from '@/lib/opsSecrets';

/**
 * Billing drift for one client: report it (GET) and repair it (POST).
 *
 * **This route contains no Stripe code, and must not gain any.** `stripe-lookup` states the
 * rule and the reason: the console has no authentication whatsoever, so a Stripe *write* path
 * sitting behind it is a different category of risk from a read path. Everything here is a
 * proxy to the portal app's `/api/ops/plan-sync`, which is deployed, gated on a shared secret,
 * and already holds the write-capable key.
 *
 * That indirection also keeps one definition of what a plan costs. The console renders the
 * app's answer rather than computing its own, so the two can't drift on pricing — which is
 * exactly the failure this feature exists to catch.
 *
 * Why this is needed at all: the plan routes here change `plan` in KV and never touch Stripe,
 * so a client can be moved to Growth and keep paying Starter with nothing noticing.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Same loopback guard as stripe-lookup — an assumption isn't a control. */
function isLoopback(req: Request): boolean {
  const host = (req.headers.get('host') ?? '').toLowerCase();
  const hostname = host.startsWith('[') ? host.slice(0, host.indexOf(']') + 1) : host.split(':')[0];
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname === '::1' ||
    hostname.endsWith('.localhost')
  );
}

function config() {
  const { baseUrl, secret } = loadPortalOpsConfig();
  if (!secret) {
    return {
      error: NextResponse.json(
        { error: 'No OPS_SHARED_SECRET in jdd-ops/.env — set the same value there and in the portal app.' },
        { status: 500 },
      ),
    };
  }
  if (!baseUrl) {
    return { error: NextResponse.json({ error: 'No PORTAL_BASE_URL configured.' }, { status: 500 }) };
  }
  return { baseUrl, secret };
}

export async function GET(req: Request) {
  if (!isLoopback(req)) {
    return NextResponse.json({ error: 'Available on localhost only.' }, { status: 403 });
  }
  const cfg = config();
  if ('error' in cfg) return cfg.error;

  const url = new URL(req.url);
  const email = (url.searchParams.get('email') ?? '').trim();
  const slug = (url.searchParams.get('slug') ?? '').trim();
  if (!email || !slug) {
    return NextResponse.json({ error: 'email and slug are required.' }, { status: 400 });
  }

  try {
    const res = await fetch(
      `${cfg.baseUrl}/api/ops/plan-sync?email=${encodeURIComponent(email)}&slug=${encodeURIComponent(slug)}`,
      { headers: { 'x-ops-secret': cfg.secret }, cache: 'no-store' },
    );
    const body = await res.json();
    return NextResponse.json({ ...body, portalBaseUrl: cfg.baseUrl }, { status: res.status });
  } catch (err) {
    console.error('[manage/plan/billing] GET failed', err);
    return NextResponse.json(
      { error: `Couldn't reach the portal app at ${cfg.baseUrl}.` },
      { status: 502 },
    );
  }
}

export async function POST(req: Request) {
  if (!isLoopback(req)) {
    return NextResponse.json({ error: 'Available on localhost only.' }, { status: 403 });
  }
  const cfg = config();
  if ('error' in cfg) return cfg.error;

  let body: { slug?: string; siteSlug?: string; email?: string; plan?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const clientSlug = body.slug?.trim();
  const siteSlug = body.siteSlug?.trim() || clientSlug;
  const email = body.email?.trim();
  const plan = body.plan?.trim();
  if (!clientSlug || !siteSlug || !email || !plan) {
    return NextResponse.json(
      { error: 'slug, email and plan are required.' },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(`${cfg.baseUrl}/api/ops/plan-sync`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-ops-secret': cfg.secret },
      body: JSON.stringify({ email, slug: siteSlug, plan }),
      cache: 'no-store',
    });
    const out = (await res.json()) as { ok?: boolean; changed?: boolean; error?: string };

    appendAudit({
      slug: clientSlug,
      siteSlug: siteSlug === clientSlug ? undefined : siteSlug,
      action: 'plan.billing.sync',
      ok: Boolean(out.ok),
      summary: out.ok
        ? out.changed
          ? `Billing synced to ${plan} in Stripe`
          : `Billing already on ${plan} — no change`
        : `Billing sync to ${plan} failed: ${out.error ?? res.status}`,
      // Key names and the plan only. No amounts, no ids — audit.ndjson is plaintext on disk.
      detail: { plan, changed: Boolean(out.changed) },
    });

    return NextResponse.json(out, { status: res.status });
  } catch (err) {
    console.error('[manage/plan/billing] POST failed', err);
    appendAudit({
      slug: clientSlug,
      action: 'plan.billing.sync',
      ok: false,
      summary: `Billing sync to ${plan} failed: portal app unreachable`,
      detail: { plan },
    });
    return NextResponse.json(
      { error: `Couldn't reach the portal app at ${cfg.baseUrl}.` },
      { status: 502 },
    );
  }
}
