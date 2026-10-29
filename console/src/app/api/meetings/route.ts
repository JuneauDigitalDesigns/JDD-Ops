import { NextResponse } from 'next/server';
import {
  createMeeting,
  deleteMeeting,
  getMeeting,
  listMeetings,
  meetingQueueConfigured,
  patchMeeting,
  type Meeting,
  type MeetingKind,
  type MeetingPatch,
  type MeetingStatus,
} from '@/lib/meetingQueue';
import {
  MEETING_DURATIONS,
  MEETING_KINDS,
  MEETING_STATUSES,
} from '@/lib/meetingTypes';
import { dayLabel, formatTime, isDay } from '@/lib/meetingTime';
import { KIND_LABEL } from '@/lib/meeting-meta';
import { patchLead } from '@/lib/leadQueue';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function notConfigured() {
  return NextResponse.json(
    {
      meetings: [],
      error:
        'Meeting store not configured — set KV_REST_API_URL and KV_REST_API_TOKEN in jdd-ops/.env (the same pair the lead queue uses).',
    },
    { status: 200 },
  );
}

export async function GET() {
  if (!meetingQueueConfigured()) return notConfigured();

  try {
    const meetings = await listMeetings();
    return NextResponse.json({ meetings });
  } catch (e) {
    console.error('[/api/meetings] list failed', e);
    return NextResponse.json({ meetings: [], error: 'Could not read the meeting store.' }, { status: 200 });
  }
}

interface CreateBody {
  day?: string;
  startMinutes?: number;
  durationMinutes?: number;
  kind?: string;
  businessName?: string;
  contactName?: string | null;
  trade?: string | null;
  phone?: string | null;
  notes?: string | null;
  leadId?: string;
}

/** Shared slot validation for create + patch. Returns an error string, or null if valid. */
function validateSlot(b: {
  day?: unknown;
  startMinutes?: unknown;
  durationMinutes?: unknown;
  kind?: unknown;
  status?: unknown;
}): string | null {
  if (b.day !== undefined && (typeof b.day !== 'string' || !isDay(b.day))) {
    return 'day must be a YYYY-MM-DD string.';
  }
  if (
    b.startMinutes !== undefined &&
    (!Number.isInteger(b.startMinutes) || (b.startMinutes as number) < 0 || (b.startMinutes as number) > 1439)
  ) {
    return 'startMinutes must be an integer 0–1439.';
  }
  if (
    b.durationMinutes !== undefined &&
    !(MEETING_DURATIONS as readonly number[]).includes(b.durationMinutes as number)
  ) {
    return `durationMinutes must be one of ${MEETING_DURATIONS.join(', ')}.`;
  }
  if (b.kind !== undefined && !(MEETING_KINDS as string[]).includes(b.kind as string)) {
    return `kind must be one of ${MEETING_KINDS.join(', ')}.`;
  }
  if (b.status !== undefined && !(MEETING_STATUSES as string[]).includes(b.status as string)) {
    return `status must be one of ${MEETING_STATUSES.join(', ')}.`;
  }
  return null;
}

/**
 * Create a meeting.
 *
 * Status is always born 'scheduled'; the id and createdAt are server-owned, like createLead. When
 * a `leadId` is present (the meeting came from a lead's "Add to calendar"), a best-effort activity
 * line is appended to that lead so the two directions of the link agree — the meeting points back
 * at the lead, and the lead's trail records that it was scheduled. A missing/failed lead write
 * never fails the meeting create.
 */
export async function POST(req: Request) {
  if (!meetingQueueConfigured()) {
    return NextResponse.json({ error: 'Meeting store not configured.' }, { status: 503 });
  }

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const slotError = validateSlot(body);
  if (slotError) return NextResponse.json({ error: slotError }, { status: 400 });

  if (body.day === undefined || body.startMinutes === undefined || body.durationMinutes === undefined) {
    return NextResponse.json({ error: 'day, startMinutes and durationMinutes are required.' }, { status: 400 });
  }
  if (body.kind === undefined) {
    return NextResponse.json({ error: 'kind is required.' }, { status: 400 });
  }
  if (typeof body.businessName !== 'string' || !body.businessName.trim()) {
    return NextResponse.json({ error: 'businessName must be a non-empty string.' }, { status: 400 });
  }
  for (const f of ['contactName', 'trade', 'phone', 'notes'] as const) {
    if (body[f] !== undefined && body[f] !== null && typeof body[f] !== 'string') {
      return NextResponse.json({ error: `${f} must be a string or null.` }, { status: 400 });
    }
  }

  const now = Date.now();
  const meeting: Meeting = {
    id: crypto.randomUUID(),
    createdAt: now,
    day: body.day,
    startMinutes: body.startMinutes,
    durationMinutes: body.durationMinutes,
    kind: body.kind as MeetingKind,
    status: 'scheduled',
    businessName: body.businessName.trim(),
  };
  if (body.contactName) meeting.contactName = body.contactName;
  if (body.trade) meeting.trade = body.trade;
  if (body.phone) meeting.phone = body.phone;
  if (body.notes) meeting.notes = body.notes;
  if (body.leadId) meeting.leadId = body.leadId;

  try {
    await createMeeting(meeting);
  } catch (e) {
    console.error('[/api/meetings] create failed', e);
    return NextResponse.json({ error: 'Could not create that meeting.' }, { status: 500 });
  }

  if (meeting.leadId) {
    try {
      await patchLead(meeting.leadId, {
        activity: {
          kind: 'meeting',
          text: `Meeting scheduled — ${dayLabel(meeting.day)}, ${formatTime(meeting.startMinutes)} (${KIND_LABEL[meeting.kind]})`,
        },
      });
    } catch (e) {
      // Best-effort: the meeting is already created; a silent/missing lead must not fail the call.
      console.error('[/api/meetings] lead activity write failed', e);
    }
  }

  return NextResponse.json({ meeting });
}

interface PatchBody extends MeetingPatch {
  id?: string;
  status?: MeetingStatus;
}

export async function PATCH(req: Request) {
  if (!meetingQueueConfigured()) {
    return NextResponse.json({ error: 'Meeting store not configured.' }, { status: 503 });
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

  const slotError = validateSlot(body);
  if (slotError) return NextResponse.json({ error: slotError }, { status: 400 });

  if (body.businessName !== undefined && (typeof body.businessName !== 'string' || !body.businessName.trim())) {
    return NextResponse.json({ error: 'businessName must be a non-empty string.' }, { status: 400 });
  }
  for (const f of ['contactName', 'trade', 'phone', 'notes'] as const) {
    if (body[f] !== undefined && body[f] !== null && typeof body[f] !== 'string') {
      return NextResponse.json({ error: `${f} must be a string or null.` }, { status: 400 });
    }
  }

  const existing = await getMeeting(body.id);
  if (!existing) return NextResponse.json({ error: 'Meeting not found.' }, { status: 404 });

  try {
    const updated = await patchMeeting(body.id, {
      day: body.day,
      startMinutes: body.startMinutes,
      durationMinutes: body.durationMinutes,
      kind: body.kind,
      status: body.status,
      businessName: body.businessName,
      contactName: body.contactName,
      trade: body.trade,
      phone: body.phone,
      notes: body.notes,
    });
    if (!updated) return NextResponse.json({ error: 'Meeting not found.' }, { status: 404 });
    return NextResponse.json({ meeting: updated });
  } catch (e) {
    console.error('[/api/meetings] patch failed', e);
    return NextResponse.json({ error: 'Could not save that change.' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  if (!meetingQueueConfigured()) {
    return NextResponse.json({ error: 'Meeting store not configured.' }, { status: 503 });
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
    const found = await deleteMeeting(body.id);
    if (!found) return NextResponse.json({ error: 'Meeting not found.' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[/api/meetings] delete failed', e);
    return NextResponse.json({ error: 'Could not delete that meeting.' }, { status: 500 });
  }
}
