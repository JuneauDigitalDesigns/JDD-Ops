'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// Renders its children into ConsoleNav's #console-nav-slot, so a route can put its own
// chrome (the wizard step rail, /onboard's title + Refresh) into the ONE global bar instead
// of a second bar of its own. A portal rather than context-with-state: no cross-tree state
// to keep in sync, and the route keeps owning its handlers — children are just JSX.
//
// The target doesn't exist during SSR (ConsoleNav renders it, but portals run client-side),
// so we gate on a mounted flag and look the node up after paint.
export default function NavSlot({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setTarget(document.getElementById('console-nav-slot'));
  }, []);

  return target ? createPortal(children, target) : null;
}
