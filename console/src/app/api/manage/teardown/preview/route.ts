import { NextResponse } from 'next/server';
import { SLUG_RE } from '@/lib/manageSites';
import { buildTeardownPlan } from '@/lib/teardownPlan';
import { findUnfinishedArchive } from '@/lib/archive';

/**
 * What a teardown of this client would actually destroy — existence-verified, not assumed.
 *
 * Read-only: nothing here mutates anything. The Danger section calls this on load and on
 * demand (a "Refresh preview" button, since the plan can go stale — a domain attached five
 * minutes ago wouldn't be in an old preview). The returned previewHash must be echoed back
 * on the destroy POST, which is what actually enforces "you saw a preview before you armed
 * the button" rather than just asking nicely.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const slug = (new URL(req.url).searchParams.get('slug') ?? '').trim();
  if (!slug || !SLUG_RE.test(slug)) {
    return NextResponse.json({ error: 'Invalid or missing client slug.' }, { status: 400 });
  }

  try {
    const plan = await buildTeardownPlan(slug);
    // A previous run that didn't finish — the section offers Resume instead of a fresh start.
    const unfinished = findUnfinishedArchive(slug);
    return NextResponse.json({ plan, unfinished });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to build the teardown preview.' },
      { status: 404 },
    );
  }
}
