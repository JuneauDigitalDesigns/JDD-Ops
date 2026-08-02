'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * The console shell's portal targets, in one file.
 *
 * The bar is assembled from below: ConsoleNav renders empty divs, and whichever route or
 * layout owns a piece of chrome portals its JSX in. A portal rather than context-with-state
 * because there is no cross-tree state to keep in sync — the owner keeps its own handlers
 * and children are just JSX.
 *
 * Four targets, not one, because a single shared target appends by MOUNT ORDER: the client
 * band and the tool band would race for first position and the bar would reorder itself
 * depending on which subtree hydrated first.
 *
 *   #console-tools-slot    NAVIGATE zone — the Build/Onboard/Manage segmented control.
 *                          Owned by /c/[slug]/layout. Empty on / and /leads.
 *   #console-readout-slot  CONTEXT zone — the muted, inert client readout. Same owner.
 *   #console-utility-slot  UTILITIES zone — route-scoped utilities that sit beside ⌘K and
 *                          the settings gear. Currently just Refresh, on / and /leads.
 *   #console-toolbar-slot  The per-tool action strip BELOW the bar (see <ToolBar>).
 *
 * Each target is created by ConsoleNav/ToolBar during render, but portals only run on the
 * client — so every slot gates on a post-paint lookup rather than assuming the node exists.
 */
function useSlot(id: string): HTMLElement | null {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setTarget(document.getElementById(id));
  }, [id]);
  return target;
}

function Slot({ id, children }: { id: string; children: React.ReactNode }) {
  const target = useSlot(id);
  return target ? createPortal(children, target) : null;
}

/** The Build/Onboard/Manage segmented control. Left zone, full contrast. */
export function ToolsSlot({ children }: { children: React.ReactNode }) {
  return <Slot id="console-tools-slot">{children}</Slot>;
}

/** The inert client readout. Nothing in here should be clickable. */
export function ReadoutSlot({ children }: { children: React.ReactNode }) {
  return <Slot id="console-readout-slot">{children}</Slot>;
}

/** App-level utilities that happen to be route-scoped — Refresh, today. */
export function UtilitySlot({ children }: { children: React.ReactNode }) {
  return <Slot id="console-utility-slot">{children}</Slot>;
}

/** Per-tool actions, in the strip directly above the work they act on. */
export function ToolBarSlot({ children }: { children: React.ReactNode }) {
  return <Slot id="console-toolbar-slot">{children}</Slot>;
}
