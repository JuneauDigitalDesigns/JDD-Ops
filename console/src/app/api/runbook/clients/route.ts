import { NextResponse } from 'next/server';
import { listClientContexts } from '@/lib/clients';
import { readOpsConfig } from '@/lib/opsConfig';

// Read-only: enumerate clients/ and introspect each one's plan + provisioning state from
// site.ts and .env.local, plus a whitelist of non-secret ops config (for step context cards).
// Never static — disk state changes between runs.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const clients = await listClientContexts();
    const config = readOpsConfig();
    return NextResponse.json({ clients, config });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to read clients.';
    return NextResponse.json({ error: message, clients: [], config: {} }, { status: 500 });
  }
}
