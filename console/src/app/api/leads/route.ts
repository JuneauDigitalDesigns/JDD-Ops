import { NextResponse } from 'next/server';
import {
  LEAD_STAGES,
  deleteLead,
  getLead,
  leadQueueConfigured,
  listLeads,
  patchLead,
  type LeadStage,
  type QueuedLead,
} from '@/lib/leadQueue';
import { LEAD_LABEL } from '@/lib/lead-meta';
import { reconcileWon } from '@/lib/leadConversion';
import { readOpsConfig } from '@/lib/opsConfig';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

  try {
    leads = await reconcileWon(leads);
  } catch (e) {
    console.error('[/api/leads] conversion reconcile failed', e);
  }

  return NextResponse.json({ leads, siteUrl: readOpsConfig().siteUrl });
}

const CONTACT_FIELD_LABEL: Record<string, string> = {
  name: 'Name',
  businessName: 'Business',
  phone: 'Phone',
  email: 'Email',
  trade: 'Trade',
  planInterest: 'Plan',
};
const CONTACT_FIELDS = Object.keys(CONTACT_FIELD_LABEL) as Array<keyof typeof CONTACT_FIELD_LABEL>;

interface PatchBody {
  id?: string;
  stage?: LeadStage;
  order?: number;
  notes?: string;
  lostReason?: string;
  name?: string;
  businessName?: string;
  phone?: string;
  email?: string | null;
  trade?: string | null;
  planInterest?: string | null;
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
  if (body.order !== undefined && !Number.isFinite(body.order)) {
    return NextResponse.json({ error: 'order must be a finite number.' }, { status: 400 });
  }
  if (body.notes !== undefined && typeof body.notes !== 'string') {
    return NextResponse.json({ error: 'notes must be a string.' }, { status: 400 });
  }
  if (body.lostReason !== undefined && typeof body.lostReason !== 'string') {
    return NextResponse.json({ error: 'lostReason must be a string.' }, { status: 400 });
  }
  for (const f of ['name', 'businessName', 'phone'] as const) {
    if (body[f] !== undefined && (typeof body[f] !== 'string' || !(body[f] as string).trim())) {
      return NextResponse.json({ error: `${f} must be a non-empty string.` }, { status: 400 });
    }
  }
  for (const f of ['email', 'trade'] as const) {
    if (body[f] !== undefined && body[f] !== null && typeof body[f] !== 'string') {
      return NextResponse.json({ error: `${f} must be a string or null.` }, { status: 400 });
    }
  }

  // Read current state to generate diffs for contact-field edits.
  const existing = await getLead(body.id);
  if (!existing) return NextResponse.json({ error: 'Lead not found.' }, { status: 404 });

  const activities: { kind: string; text: string }[] = [];

  // Contact field diffs
  const bodyIndex = body as Record<string, unknown>;
  const existingIndex = existing as unknown as Record<string, unknown>;
  for (const key of CONTACT_FIELDS) {
    if (bodyIndex[key] === undefined) continue;
    const oldVal = String(existingIndex[key] ?? '—');
    const newVal = String(bodyIndex[key] ?? '—');
    if (oldVal !== newVal) {
      activities.push({
        kind: 'field',
        text: `${CONTACT_FIELD_LABEL[key]} corrected: "${oldVal}" → "${newVal}"`,
      });
    }
  }

  // Stage / notes activities (a pure reorder stays silent)
  if (body.stage !== undefined) {
    activities.push({
      kind: 'stage',
      text:
        body.stage === 'lost' && body.lostReason?.trim()
          ? `Marked Lost — ${body.lostReason.trim()}`
          : `Moved to ${LEAD_LABEL[body.stage]}`,
    });
  } else if (body.notes !== undefined) {
    activities.push({ kind: 'note', text: 'Notes updated' });
  }

  try {
    const updated = await patchLead(body.id, {
      stage: body.stage,
      order: body.order,
      notes: body.notes,
      lostReason: body.lostReason,
      name: body.name,
      businessName: body.businessName,
      phone: body.phone,
      email: body.email,
      trade: body.trade,
      planInterest: body.planInterest as 'starter' | 'growth' | 'enterprise' | null | undefined,
      activity: activities.length > 0 ? activities : undefined,
    });
    if (!updated) return NextResponse.json({ error: 'Lead not found.' }, { status: 404 });
    return NextResponse.json({ lead: updated });
  } catch (e) {
    console.error('[/api/leads] patch failed', e);
    return NextResponse.json({ error: 'Could not save that change.' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  if (!leadQueueConfigured()) {
    return NextResponse.json({ error: 'Lead queue not configured.' }, { status: 503 });
  }

  let body: { id?: string };
  try {
    body = (await req.json()) as { id?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  if (!body?.id || typeof body.id !== 'string') {
    return NextResponse.json({ error: 'id is required.' }, { status: 400 });
  }

  try {
    const found = await deleteLead(body.id);
    if (!found) return NextResponse.json({ error: 'Lead not found.' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[/api/leads] delete failed', e);
    return NextResponse.json({ error: 'Could not delete that lead.' }, { status: 500 });
  }
}
