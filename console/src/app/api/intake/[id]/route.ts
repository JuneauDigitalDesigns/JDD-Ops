import { NextResponse } from 'next/server';
import { getIntake } from '@/lib/intakeQueue';

// Full payload for a single queued intake — used to seed the wizard's intake-review step.
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const item = await getIntake(params.id);
    if (!item) return NextResponse.json({ error: 'Intake not found or expired.' }, { status: 404 });
    return NextResponse.json({ intake: item });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to read intake.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
