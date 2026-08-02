import { NextResponse } from 'next/server';
import {
  LEAD_STAGES,
  leadQueueConfigured,
  listLeads,
  patchLead,
  type LeadStage,
  type QueuedLead,
} from '@/lib/leadQueue';
import { LEAD_LABEL } from '@/lib/lead-meta';
import { reconcileWon } from '@/lib/leadConversion';
import { readOpsConfig } from '@/lib/opsConfig';

// The funnel behind /leads. Reads the KV the agency site writes; local-only, like the
// rest of this console.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** KV creds absent is a setup problem with a fix, so say which one rather than throwing. */
function notConfigured() {
  return NextResponse.json(
    {
      leads: [],
      error:
        'Lead queue not configured — set KV_REST_API_URL and KV_REST_API_TOKEN in console/.env.local (the same pair the intake queue uses).',
    },
    { status: 200 },
  );
}

export async function GET() {
  if (!leadQueueConfigured()) return notConfigured();

  let leads: QueuedLead[];
  try {
    leads = await listLeads();
  } catch (e) {
    console.error('[/api/leads] list failed', e);
    return NextResponse.json({ leads: [], error: 'Could not read the lead queue.' }, { status: 200 });
  }

  // Anyone who has since become a real client is marked won here rather than by a
  // separate job — this route is the only place both sources are already in hand.
  try {
    leads = await reconcileWon(leads);
  } catch (e) {
    // A reconciliation failure must not take the board down; the leads are still valid.
    console.error('[/api/leads] conversion reconcile failed', e);
  }

  // The modal deep-links a prospect into the agency site's agreement flow, so it needs
  // that origin. Sent with the list rather than read client-side — opsConfig is a
  // server-only disk read.
  return NextResponse.json({ leads, siteUrl: readOpsConfig().siteUrl });
}

interface PatchBody {
  id?: string;
  stage?: LeadStage;
  order?: number;
  notes?: string;
  lostReason?: string;
}

export async function PATCH(req: Request) {
  if (!leadQueueConfigured()) {
    return NextResponse.json({ error: 'Lead queue not configured.' }, { status: 503 });
  }

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  if (!body?.id || typeof body.id !== 'string') {
    return NextResponse.json({ error: 'id is required.' }, { status: 400 });
  }
  if (body.stage !== undefined && !LEAD_STAGES.includes(body.stage)) {
    return NextResponse.json({ error: `Unknown stage "${body.stage}".` }, { status: 400 });
  }
  // Fractional by design, but NaN/Infinity would poison the column sort and persist.
  if (body.order !== undefined && !Number.isFinite(body.order)) {
    return NextResponse.json({ error: 'order must be a finite number.' }, { status: 400 });
  }
  if (body.notes !== undefined && typeof body.notes !== 'string') {
    return NextResponse.json({ error: 'notes must be a string.' }, { status: 400 });
  }
  if (body.lostReason !== undefined && typeof body.lostReason !== 'string') {
    return NextResponse.json({ error: 'lostReason must be a string.' }, { status: 400 });
  }

  // One trail entry per meaningful change. A pure reorder writes nothing — dragging a
  // card up two places is not history, and logging it would bury the entries that are.
  let activity: { kind: string; text: string } | undefined;
  if (body.stage !== undefined) {
    activity = {
      kind: 'stage',
      text:
        body.stage === 'lost' && body.lostReason?.trim()
          ? `Marked Lost — ${body.lostReason.trim()}`
          : `Moved to ${LEAD_LABEL[body.stage]}`,
    };
  } else if (body.notes !== undefined) {
    activity = { kind: 'note', text: 'Notes updated' };
  }

  try {
    const updated = await patchLead(body.id, {
      stage: body.stage,
      order: body.order,
      notes: body.notes,
      lostReason: body.lostReason,
      activity,
    });
    if (!updated) return NextResponse.json({ error: 'Lead not found.' }, { status: 404 });
    return NextResponse.json({ lead: updated });
  } catch (e) {
    console.error('[/api/leads] patch failed', e);
    return NextResponse.json({ error: 'Could not save that change.' }, { status: 500 });
  }
}
