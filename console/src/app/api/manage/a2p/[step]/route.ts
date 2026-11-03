import { NextResponse } from 'next/server';
import { loadManageTarget } from '@/lib/manageSites';
import { runA2pStepForClient, type A2pStepRequest } from '@/lib/a2pServer';

/**
 * One A2P registration step per call — `POST /api/manage/a2p/{step}?slug=`.
 *
 * ── The rules this file exists to keep (plan §6) ─────────────────────────────────────────────
 *   - **The slug is the only thing in the URL.** Everything the operator typed — the EIN, the
 *     rep's email and mobile — is in the POST body. A query string is what request logs keep.
 *   - **The request body is never logged**, in whole or in part, and no error path
 *     interpolates it. Vendor errors are scrubbed at construction (`A2pVendorError`); anything
 *     else is scrubbed again here against the submitted values before it is returned.
 *   - **The response never echoes input.** It returns the record (SIDs and statuses, by schema)
 *     and a one-line summary built from SIDs.
 *   - **Audit gets the step name and the summary, never a field value**, and the entry is
 *     tax-ID-checked before it is written — `audit.ndjson` is the one log written to disk and kept.
 *   - **Every write needs `confirm: true`**, which only the section's confirm dialog sends; the
 *     four steps that FILE something with Twilio — and so start a review clock or a fee — also
 *     need the client slug typed back (`confirmSlug`). Server-side, so a stray script cannot skip
 *     the dialog. Readiness and step order are then enforced again inside `runStep`.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { step: string } }) {
  const slug = new URL(req.url).searchParams.get('slug');
  const target = await loadManageTarget(slug, null);
  if (!target.ok) return NextResponse.json({ error: target.error }, { status: target.status });

  let body: A2pStepRequest;
  try {
    body = (await req.json()) as A2pStepRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const { status, json } = await runA2pStepForClient(target.ctx, params.step, body);
  return NextResponse.json(json, { status });
}
