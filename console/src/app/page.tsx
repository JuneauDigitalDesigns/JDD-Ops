import BriefingView from '@/components/BriefingView';

/**
 * The console's front door is a briefing.
 *
 * Three changes got it here, each removing a reason to click before you could think.
 *
 * First the root stopped being a tool picker — three cards (Build, Onboard, Manage) that
 * each then asked which client you meant, so the first thing you did every session was
 * choose the same client up to three times. The client became the thing you pick once, and
 * the tools became things you do to it inside its shell at /c/{slug}.
 *
 * Then it stopped being a Kanban board. That organised around onboarding status — a phase
 * every client passes through once and then leaves — which made it a weekly-review view,
 * not a front door. The Kanban shape moved to /leads, pointed at prospects, which is the
 * one population it actually fits.
 *
 * Now it stops being the client roster. The roster was genuinely good at "find a client and
 * open them", and it moved to /clients unchanged. What it could never do is answer the
 * question you actually arrive with — what needs doing — because it is sorted for lookup,
 * and a roster of healthy clients looks exactly like a roster nobody has checked. The
 * reconcile engine finally made that question answerable, so the front door asks it.
 */
export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <div className="onboard-chrome h-full overflow-y-auto">
      <div className="dotfield" aria-hidden />
      <BriefingView />
    </div>
  );
}
