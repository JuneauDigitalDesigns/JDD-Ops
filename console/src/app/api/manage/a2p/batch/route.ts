import { NextResponse } from 'next/server';
import { loadManageTarget } from '@/lib/manageSites';
import { runA2pBatchForClient } from '@/lib/a2pServer';
import type { A2pBatchForm } from '@/lib/a2pChain';

/**
 * The sales-call close's one confirmed registration run — `POST /api/manage/a2p/batch?slug=`.
 *
 * Body: `{ mode: 'submit' | 'save', form, confirm: true, confirmSlug }`. Same rules as the
 * single-step route: the slug is the only thing in the URL, the body is never logged or echoed,
 * and the response carries SIDs, statuses and per-step results only. See runA2pBatchForClient.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const slug = new URL(req.url).searchParams.get('slug');
  const target = await loadManageTarget(slug, null);
  if (!target.ok) return NextResponse.json({ error: target.error }, { status: target.status });

  let body: { mode?: 'submit' | 'save'; form?: A2pBatchForm; confirm?: boolean; confirmSlug?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const { status, json } = await runA2pBatchForClient(target.ctx, body);
  return NextResponse.json(json, { status });
}
