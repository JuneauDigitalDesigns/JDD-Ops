import { NextResponse } from 'next/server';
import { runKvReset } from '@/lib/goLive/kvReset';
import { appendAudit } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { dryRun?: boolean };
  const dryRun = body.dryRun !== false;
  const result = await runKvReset(dryRun);

  if (!dryRun) {
    appendAudit({
      slug: '_go-live',
      action: 'go-live.kv-reset',
      ok: result.ok,
      summary: result.summary ?? 'KV reset',
    });
  }
  return NextResponse.json(result);
}
