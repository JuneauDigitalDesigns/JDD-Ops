import { NextResponse } from 'next/server';
import { loadReadiness } from '@/lib/a2pChain';
import { loadA2pEnv } from '@/lib/opsSecrets';

/**
 * A2P Phase 0 readiness, read live, cached nowhere (plan Phase 1).
 *
 * The report carries labels, details and SIDs — never a credential value; `checkA2pReadiness`
 * is written so. Per-client writes do not trust this response: `runStep` re-runs the same
 * check server-side before every write, so a stale green in a browser tab gates nothing.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { checkA2pReadiness } = await loadReadiness();
    const report = await checkA2pReadiness({ env: loadA2pEnv() });
    return NextResponse.json(report);
  } catch (err) {
    return NextResponse.json(
      { ok: null, checks: [], policies: {}, profileCandidates: [], error: err instanceof Error ? err.message : 'Readiness check failed.' },
      { status: 500 },
    );
  }
}
