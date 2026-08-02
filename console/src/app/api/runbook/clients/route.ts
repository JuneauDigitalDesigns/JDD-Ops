import { NextResponse } from 'next/server';
import { listClientContexts } from '@/lib/clients';
import { readOpsConfig } from '@/lib/opsConfig';
import { lastTouchedBySlug } from '@/lib/activity';

// Read-only: enumerate clients/ and introspect each one's plan + provisioning state from
// site.ts and .env.local, plus a whitelist of non-secret ops config (for step context cards)
// and each client's last-touched timestamp (the client index's default sort).
//
// `activity` rides along here rather than in its own endpoint: the index already calls this
// route, and the two reads it does (audit.ndjson + progress.json) are local files measured in
// milliseconds. A second endpoint would only be a second thing to keep in step with this one.
//
// `?fixtures=1` includes the `_`-prefixed test fixtures, which are hidden by default.
// Never static — disk state changes between runs.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const includeFixtures = new URL(req.url).searchParams.get('fixtures') === '1';
  try {
    const clients = await listClientContexts({ includeFixtures });
    const config = readOpsConfig();
    const activity = lastTouchedBySlug();
    return NextResponse.json({ clients, config, activity });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to read clients.';
    return NextResponse.json(
      { error: message, clients: [], config: {}, activity: {} },
      { status: 500 },
    );
  }
}
