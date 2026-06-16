import { NextResponse } from 'next/server';
import { readState, patchClientState, type PatchInput } from '@/lib/state';
import { STATUS_ORDER } from '@/lib/types';

// Durable runbook progress (status overrides + step completion). Local-only.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ state: readState() });
}

export async function PATCH(req: Request) {
  let body: PatchInput;
  try {
    body = (await req.json()) as PatchInput;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  if (!body?.slug || typeof body.slug !== 'string') {
    return NextResponse.json({ error: 'slug is required.' }, { status: 400 });
  }
  if (body.status && !STATUS_ORDER.includes(body.status) && body.status !== 'unknown') {
    return NextResponse.json({ error: `Unknown status "${body.status}".` }, { status: 400 });
  }
  if (body.step && (typeof body.step.id !== 'string' || typeof body.step.done !== 'boolean')) {
    return NextResponse.json({ error: 'step must be { id: string, done: boolean }.' }, { status: 400 });
  }

  const updated = patchClientState({ slug: body.slug, status: body.status, step: body.step });
  return NextResponse.json({ slug: body.slug, state: updated });
}
