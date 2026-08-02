import { NextResponse } from 'next/server';
import { leadQueueConfigured, listDemoCalls } from '@/lib/leadQueue';

// Every call to the demo number, including the anonymous ones that never became leads.
// That's the point of it being separate from the board: the funnel only holds people you
// can follow up with, but call volume is worth seeing on its own.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!leadQueueConfigured()) {
    return NextResponse.json({ calls: [], error: 'Lead queue not configured.' }, { status: 200 });
  }
  try {
    return NextResponse.json({ calls: await listDemoCalls() });
  } catch (e) {
    console.error('[/api/leads/calls] list failed', e);
    return NextResponse.json({ calls: [], error: 'Could not read demo calls.' }, { status: 200 });
  }
}
