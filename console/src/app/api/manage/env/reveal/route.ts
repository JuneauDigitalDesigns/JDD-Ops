import { NextResponse } from 'next/server';
import { loadManageTarget } from '@/lib/manageSites';

/**
 * Return ONE env value in the clear, for the reveal-on-click affordance in the env editor.
 *
 * This deliberately relaxes the rule stated in envFields.ts ("never round-tripped through
 * the browser in full"), which existed because the list response returns every value at
 * once — masking there is still right, and still in force. The reasoning for the
 * exception:
 *
 *   - The console is localhost-only and never deployed. The value is already sitting in
 *     plaintext in clients/{slug}/.env.local on the same machine.
 *   - Permanently masked makes the obvious ops task — read a credential to paste it into
 *     Twilio or Airtable — impossible without dropping to a terminal, which is the exact
 *     dashboard-trip this route exists to remove.
 *
 * Scoped tight to keep it defensible: one key per request, named explicitly, read from
 * disk, never enumerable. If the console ever gets deployed, delete this route first.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ENV_KEY_RE = /^[A-Z][A-Z0-9_]*$/;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const target = await loadManageTarget(url.searchParams.get('slug'), url.searchParams.get('site'));
  if (!target.ok) return NextResponse.json({ error: target.error }, { status: target.status });

  const key = (url.searchParams.get('key') ?? '').trim();
  if (!key || !ENV_KEY_RE.test(key)) {
    return NextResponse.json({ error: 'Invalid or missing env key.' }, { status: 400 });
  }

  const value = target.resolved.env[key];
  if (value === undefined) {
    return NextResponse.json({ error: `${key} is not set on this site.` }, { status: 404 });
  }

  return NextResponse.json({ key, value });
}
