'use client';

import ClientReadout from '@/components/shell/ClientReadout';
import ToolSwitcher from '@/components/shell/ToolSwitcher';

/**
 * The client's contribution to the console bar, split across two of its three zones.
 *
 * This used to be one row — back-link, brand name, plan chip, status badge, three tool
 * tabs — sitting between the logo and whatever the current tool portaled in. That put
 * identity in the middle of navigation, which is the specific thing that made the bar
 * hard to read.
 *
 * Now it renders two independent portals into two zones with different rules:
 *   <ToolSwitcher>  → NAVIGATE (left).  Interactive, full contrast.
 *   <ClientReadout> → CONTEXT (right).  Inert, muted.
 *
 * Both are mounted from the /c/[slug] layout, so they survive every navigation between
 * tools — the client is chosen once at the root picker and never asked for again.
 *
 * The "‹ back to all clients" link is gone: the JDD mark is the home link now, and it's in
 * the same place on every route including the ones with no client.
 */
export default function ClientChrome() {
  return (
    <>
      <ToolSwitcher />
      <ClientReadout />
    </>
  );
}
