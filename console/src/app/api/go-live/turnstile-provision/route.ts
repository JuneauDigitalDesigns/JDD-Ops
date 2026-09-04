import { NextResponse } from 'next/server';
import { runTurnstileProvision } from '@/lib/goLive/turnstile';
import { appendAudit } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { dryRun?: boolean };
  const dryRun = body.dryRun !== false;
  const result = await runTurnstileProvision(dryRun);

  if (!dryRun) {
    appendAudit({
      slug: '_go-live',
      action: 'go-live.turnstile',
      ok: result.ok,
      summary: `Turnstile production widget ${result.ok ? 'provisioned' : 'failed'}`,
      detail: { keys: result.captured?.map((c) => c.label) ?? [] },
    });
  }
  return NextResponse.json(result);
}
