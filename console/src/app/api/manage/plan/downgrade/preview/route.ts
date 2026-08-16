import { NextResponse } from 'next/server';
import { buildPlanDowngradePreview, PlanDowngradeError } from '@/lib/planDowngrade';

/**
 * What a growth → starter downgrade would destroy, probed against live APIs.
 *
 * Read-only, and separate from the execute route for the same reason teardown's preview is:
 * the operator has to be able to look before committing, and looking must not be able to
 * change anything.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SLUG_RE = /^[A-Za-z0-9_-]+$/;

export async function GET(req: Request) {
  const slug = (new URL(req.url).searchParams.get('slug') ?? '').trim();
  if (!SLUG_RE.test(slug)) {
    return NextResponse.json({ error: 'Invalid client slug.' }, { status: 400 });
  }

  try {
    const preview = await buildPlanDowngradePreview(slug);
    return NextResponse.json({ preview });
  } catch (err) {
    const status = err instanceof PlanDowngradeError ? err.status : 500;
    const error = err instanceof Error ? err.message : 'Could not build a downgrade preview.';
    return NextResponse.json({ error }, { status });
  }
}
