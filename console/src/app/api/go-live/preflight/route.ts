import { NextResponse } from 'next/server';
import { runPreflight } from '@/lib/goLive/preflight';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const result = await runPreflight();
  return NextResponse.json(result);
}
