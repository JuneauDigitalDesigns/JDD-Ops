import { existsSync } from 'node:fs';
import { NextResponse, type NextRequest } from 'next/server';
import { clientDir } from '@/lib/paths';
import { writeDraft } from '@/lib/draft';

export async function POST(req: NextRequest) {
  const body = await req.json() as { slug?: unknown; bundle?: unknown };
  const { slug, bundle } = body;

  if (!slug || typeof slug !== 'string' || !bundle || typeof bundle !== 'object') {
    return NextResponse.json({ error: 'bad request' }, { status: 400 });
  }
  // Guard: only write for clients whose directory already exists — never create dirs here.
  if (!existsSync(clientDir(slug))) {
    return NextResponse.json({ error: 'client not found' }, { status: 404 });
  }

  writeDraft(slug, bundle);
  return NextResponse.json({ ok: true });
}
