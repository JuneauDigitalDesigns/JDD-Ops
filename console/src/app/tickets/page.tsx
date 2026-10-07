import TicketsView from '@/components/tickets/TicketsView';

/**
 * Support tickets, on their own route.
 *
 * Clients open tickets from the portal's Support tab (agency site), which writes them into the
 * same KV the lead funnel uses. This board is the operator's side: triage, reply, change status.
 * It is reached from the prominent Tickets panel on the briefing (/), the same way /leads is
 * reached from the funnel panel — there is no ConsoleNav entry.
 */
export const dynamic = 'force-dynamic';

export default function TicketsPage() {
  return <TicketsView />;
}
