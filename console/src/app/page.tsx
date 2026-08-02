import ClientIndex from '@/components/picker/ClientIndex';

/**
 * The console's front door is a searchable client index.
 *
 * Two changes got it here. First, the root stopped being a tool picker — it used to be three
 * cards (Build, Onboard, Manage) and each of those then made you pick a client again, so the
 * first thing you did every session was choose the same client up to three times. The client
 * is now chosen once, and the tools are things you do to it inside its shell at /c/{slug}.
 *
 * Then the root stopped being a Kanban board. The board organised around onboarding status —
 * a phase every client passes through once and then leaves — which made it a weekly-review
 * view, not a front door: it couldn't be searched, and it couldn't tell you a live site was
 * down. It moved to /pipeline, and was eventually deleted outright: given a route of its own
 * it turned out to answer nothing this screen didn't already answer better. The Kanban shape
 * now lives at /leads, pointed at prospects — the one population that has no rows here.
 *
 * The `.onboard-chrome` scope (dotfield) is the surface these roster views were designed on,
 * and came up with them from /onboard. The `.grain` overlay it also used to carry was removed
 * console-wide; see globals.css.
 */
export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <div className="onboard-chrome h-full">
      <div className="dotfield" aria-hidden />
      <ClientIndex />
    </div>
  );
}
