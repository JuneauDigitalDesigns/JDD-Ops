import { NextResponse } from 'next/server';
import { loadPortalOpsConfig } from '@/lib/opsSecrets';

/**
 * Consent proof lookup, proxied to the portal app's `/api/ops/sms-consent`.
 *
 * A proxy rather than a direct KV read, for the same reason as `manage/plan/billing`: the
 * record lives where it is written, and a second reader with its own key would eventually
 * disagree with the first. The console renders the app's answer.
 *
 * Read-only by construction — there is no POST here and there must never be one. This is
 * the route you open when a carrier asks why a number was texted, and an endpoint that can
 * also write is a worse witness.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Same loopback guard as the other ops proxies — the console has no auth of its own. */
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

export async function GET(req: Request) {
  if (!isLoopback(req)) {
    return NextResponse.json({ error: 'Available on localhost only.' }, { status: 403 });
  }

  const { baseUrl, secret } = loadPortalOpsConfig();
  if (!secret) {
    return NextResponse.json(
      { error: 'No OPS_SHARED_SECRET in jdd-ops/.env — set the same value there and in the portal app.' },
      { status: 500 },
    );
  }
  if (!baseUrl) {
    return NextResponse.json({ error: 'No PORTAL_BASE_URL configured.' }, { status: 500 });
  }

  const url = new URL(req.url);
  const phone = (url.searchParams.get('phone') ?? '').trim();
  const email = (url.searchParams.get('email') ?? '').trim();
  if (!phone && !email) {
    return NextResponse.json({ error: 'phone or email is required.' }, { status: 400 });
  }

  const query = new URLSearchParams();
  if (phone) query.set('phone', phone);
  if (email) query.set('email', email);

  try {
    const res = await fetch(`${baseUrl}/api/ops/sms-consent?${query}`, {
      headers: { 'x-ops-secret': secret },
      cache: 'no-store',
    });
    const body = await res.json();
    return NextResponse.json({ ...body, portalBaseUrl: baseUrl }, { status: res.status });
  } catch (err) {
    console.error('[sms-consent] lookup failed', err);
    return NextResponse.json({ error: `Couldn't reach the portal app at ${baseUrl}.` }, { status: 502 });
  }
}
