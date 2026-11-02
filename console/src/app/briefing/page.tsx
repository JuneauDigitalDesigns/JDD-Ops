import BriefingView from '@/components/BriefingView';

/**
 * The briefing — what needs doing, what the money is, where the funnel moved.
 *
 * This used to be the console's front door (`/`). The root is now a card hub (see
 * app/page.tsx) so the operator lands on a starting place rather than straight in triage;
 * the briefing kept everything it had and simply moved to its own route, reached from its
 * hub card. BriefingView is unchanged — it still carries its own cross-route link strip and
 * every panel it had at the root.
 */
export const dynamic = 'force-dynamic';

export default function BriefingPage() {
  return (
    <div className="onboard-chrome h-full overflow-y-auto">
      <div className="dotfield" aria-hidden />
      <BriefingView />
    </div>
  );
}
