import { NextResponse } from 'next/server';
import { put } from '@vercel/blob/client';
import { isLoopback } from '@/lib/loopback';
import { agencyOrders } from '@/lib/salesOrders';
import { appendAudit } from '@/lib/audit';
import { attachRecording } from '@/lib/recordingUpload';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Attach a close call's recording to its agreement. The body is the raw file.
 *
 * The one mutating route the middleware doesn't run on (see `middleware.ts`), so the loopback
 * check here is the only one it has. It must stay first.
 */
export async function POST(req: Request, { params }: { params: { orderId: string } }) {
  if (!isLoopback(req)) return NextResponse.json({ error: 'Available on localhost only.' }, { status: 403 });
  if (!req.body) return NextResponse.json({ error: 'No file.' }, { status: 400 });

  const path = `/${encodeURIComponent(params.orderId)}/recording`;
  const meta = {
    fileName: decodeURIComponent(req.headers.get('x-file-name') ?? ''),
    contentType: req.headers.get('content-type') ?? '',
    sizeBytes: Number(req.headers.get('content-length')),
  };

  const out = await attachRecording(req.body, meta, {
    begin: (m) => agencyOrders(path, { method: 'POST', body: { step: 'begin', ...m } }),
    store: async (pathname, stream, { token, contentType }) => {
      await put(pathname, stream, { access: 'private', token, contentType, multipart: true });
    },
    complete: (input) => agencyOrders(path, { method: 'POST', body: { step: 'complete', ...input } }),
  });

  const slug = new URL(req.url).searchParams.get('slug') ?? 'unknown';
  appendAudit({
    slug,
    action: 'agreement.recording',
    ok: out.status < 300,
    summary: out.status < 300 ? 'Recording attached' : `Recording attach failed: ${String(out.body.error ?? out.status)}`,
    // The order id only. The file name can carry the client's name.
    detail: { orderId: params.orderId },
  });
  return NextResponse.json(out.body, { status: out.status });
}
