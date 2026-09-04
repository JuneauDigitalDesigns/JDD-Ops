import { NextResponse } from 'next/server';
import { runEnvSync } from '@/lib/goLive/envSync';
import { appendAudit } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { dryRun?: boolean };
  const dryRun = body.dryRun !== false;
  const result = runEnvSync(dryRun);

  if (!dryRun) {
    appendAudit({
      slug: '_go-live',
      action: 'go-live.env-sync',
      ok: result.ok,
      summary: result.summary ?? 'Env sync',
    });
  }
  return NextResponse.json(result);
}
