// One source for how a TicketStatus is named and coloured.
//
// Same shape and reasoning as lead-meta.ts: these maps are imported by the board, the card,
// and the modal, and two copies of a label map is how a status ends up meaning something
// subtly different in two places. Client-safe (pure values + the schema types), so the UI
// imports from here and from @jdd/schema, never from the server-only ticketStore.

import type { TicketStatus } from '@jdd/schema';

export const TICKET_LABEL: Record<TicketStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  waiting_on_client: 'Waiting on client',
  resolved: 'Resolved',
  closed: 'Closed',
};

export const TICKET_COLOR: Record<TicketStatus, string> = {
  open: 'var(--accent)',
  in_progress: 'var(--accent)',
  waiting_on_client: 'var(--warn)',
  resolved: 'var(--ok)',
  closed: 'var(--fg-3)',
};

/** localStorage key holding the epoch-ms of the last time the board was viewed. */
export const TICKETS_LAST_SEEN_KEY = 'jdd:tickets:lastSeenAt';

/**
 * A ticket opened after the operator last looked at the board.
 *
 * Keyed off `createdAt`, not `updatedAt`: this marks ARRIVAL, not activity. A ticket you
 * replied to yesterday is not news today. A null `lastSeenAt` is a first-ever visit and marks
 * NOTHING, rather than flagging the whole board as new.
 */
export function isUnseen(ticket: { createdAt: number }, lastSeenAt: number | null): boolean {
  return lastSeenAt !== null && ticket.createdAt > lastSeenAt;
}

/** Statuses that need an operator response — what the briefing surfaces. */
export function needsAttention(status: TicketStatus): boolean {
  return status === 'open' || status === 'waiting_on_client';
}
