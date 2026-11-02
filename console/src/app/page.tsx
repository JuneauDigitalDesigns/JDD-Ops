import HubView from '@/components/hub/HubView';

/**
 * The console's front door is a card hub.
 *
 * It used to be the briefing — a dense triage screen you landed in before you'd decided what
 * you came to do. Before that it was a tool picker, then a Kanban board, then the client
 * roster; each front door organised around one job and forced that job on you at the door.
 *
 * The hub steps back from all of them: it is a starting place, one card per major section
 * (see components/hub/HubView), so the app reads as a web you begin from and walk through.
 * The briefing kept everything it had and moved to /briefing, reached from its own card; the
 * roster is at /clients, the funnel at /leads, and so on. The bar's breadcrumb carries you
 * back here (see components/shell/Breadcrumbs).
 */
export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <div className="onboard-chrome h-full overflow-y-auto">
      <div className="dotfield" aria-hidden />
      <HubView />
    </div>
  );
}
