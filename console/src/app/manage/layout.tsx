// /manage = the ops control panel: health roster, then per-client env, deployments,
// voice agent, and portal link.
//
// Its own `.manage-chrome` scope rather than borrowing `.onboard-chrome`. This is the
// only route in the console that writes to live client infrastructure, so the indigo
// accent is a mode signal — you can tell at a glance where you are. The scope also
// tightens the --control-* metrics, since this screen is tables and key/value rows.
//
// `overflow-hidden` + `min-h-0`, NOT `overflow-y-auto`: the rail and the stage each own
// their own scrolling below this, and a scroll container here would stack a second
// scrollbar on top of theirs.
//
// No dotfield/grain. They earn their place on /onboard's editorial surfaces; over a
// dense table they are exactly the visual noise this route is trying to remove.

// `useSearchParams()` (the ?site= enterprise switcher) needs this for the whole subtree.
export const dynamic = 'force-dynamic';

export default function ManageLayout({ children }: { children: React.ReactNode }) {
  return <div className="manage-chrome flex h-full min-h-0 flex-col overflow-hidden">{children}</div>;
}
