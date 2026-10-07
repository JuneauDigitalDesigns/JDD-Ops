import { NextResponse } from 'next/server';
import {
  TICKET_STATUSES,
  deleteTicket,
  getTicket,
  listTickets,
  patchTicket,
  ticketQueueConfigured,
  type Ticket,
  type TicketStatus,
} from '@/lib/ticketStore';
import { notifyClientOfTicketUpdate, ticketStatusLabel } from '@/lib/emails/ticket-update';
import { appendAudit } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function notConfigured() {
  return NextResponse.json(
    {
      tickets: [],
      error:
        'Ticket queue not configured — set KV_REST_API_URL and KV_REST_API_TOKEN in console/.env.local (the same pair the lead queue uses).',
    },
    { status: 200 },
  );
}

export async function GET() {
  if (!ticketQueueConfigured()) return notConfigured();

  let tickets: Ticket[];
  try {
    tickets = await listTickets();
  } catch (e) {
    console.error('[/api/tickets] list failed', e);
    return NextResponse.json({ tickets: [], error: 'Could not read the ticket queue.' }, { status: 200 });
  }

  return NextResponse.json({ tickets });
}

/**
 * Tickets originate from the client's portal, not the console — there is no hand-create here.
 * Kept explicit so a future need is a deliberate change, not a silent 404.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Tickets are opened by clients in the portal; the console cannot create one.' },
    { status: 405 },
  );
}

interface PatchBody {
  id?: string;
  status?: TicketStatus;
  order?: number;
  /** Operator reply appended to the thread. */
  message?: string;
}

export async function PATCH(req: Request) {
  if (!ticketQueueConfigured()) {
    return NextResponse.json({ error: 'Ticket queue not configured.' }, { status: 503 });
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
  // The console operator may set ANY status — no client-side restriction here.
  if (body.status !== undefined && !TICKET_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: `Unknown status "${body.status}".` }, { status: 400 });
  }
  if (body.order !== undefined && !Number.isFinite(body.order)) {
    return NextResponse.json({ error: 'order must be a finite number.' }, { status: 400 });
  }
  if (body.message !== undefined && (typeof body.message !== 'string' || !body.message.trim())) {
    return NextResponse.json({ error: 'message must be a non-empty string.' }, { status: 400 });
  }
  if (body.status === undefined && body.order === undefined && body.message === undefined) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  const existing = await getTicket(body.id);
  if (!existing) return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });

  try {
    const updated = await patchTicket(body.id, {
      status: body.status,
      order: body.order,
      message: body.message?.trim() ? { author: 'operator', text: body.message.trim() } : undefined,
    });
    if (!updated) return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });

    // Notify the client of anything they'd want to know about. A reply is the richer signal, so
    // when a patch both replies and changes status we send the one reply email (the new status is
    // visible on the thread). A pure reorder sends nothing.
    const notifyKind = body.message?.trim() ? 'reply' : body.status !== undefined ? 'status' : null;
    if (notifyKind) await notifyClientOfTicketUpdate(updated, notifyKind);

    // Key names / status only — never the message text (audit.ndjson is plaintext on disk).
    if (body.message?.trim()) {
      appendAudit({
        slug: updated.siteSlug,
        action: 'ticket.reply',
        ok: true,
        summary: `Replied to ticket "${updated.subject}"`,
        detail: { id: updated.id, status: updated.status },
      });
    } else if (body.status !== undefined) {
      appendAudit({
        slug: updated.siteSlug,
        action: 'ticket.status',
        ok: true,
        summary: `Ticket "${updated.subject}" → ${ticketStatusLabel(updated.status)}`,
        detail: { id: updated.id, status: updated.status },
      });
    }

    return NextResponse.json({ ticket: updated });
  } catch (e) {
    console.error('[/api/tickets] patch failed', e);
    return NextResponse.json({ error: 'Could not save that change.' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  if (!ticketQueueConfigured()) {
    return NextResponse.json({ error: 'Ticket queue not configured.' }, { status: 503 });
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

  const existing = await getTicket(body.id);

  try {
    const found = await deleteTicket(body.id);
    if (!found) return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });
    if (existing) {
      appendAudit({
        slug: existing.siteSlug,
        action: 'ticket.delete',
        ok: true,
        summary: `Deleted ticket "${existing.subject}"`,
        detail: { id: existing.id },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[/api/tickets] delete failed', e);
    return NextResponse.json({ error: 'Could not delete that ticket.' }, { status: 500 });
  }
}
