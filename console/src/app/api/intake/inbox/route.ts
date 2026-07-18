import { NextResponse } from 'next/server';
import { intakeQueueConfigured, listPendingIntakes } from '@/lib/intakeQueue';

// Pending intakes pushed by the agency site's signup flow. The wizard's Step 1 grid
// polls this to surface "New — from signup" clients. Never cached.
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!intakeQueueConfigured()) {
    // No KV creds locally — the wizard still works with existing/blank clients.
    return NextResponse.json({ intakes: [], configured: false });
  }
  try {
    const intakes = await listPendingIntakes();
    return NextResponse.json({ intakes, configured: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to read intake queue.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
