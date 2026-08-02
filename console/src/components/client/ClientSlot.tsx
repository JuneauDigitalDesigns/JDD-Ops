'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// Renders its children into ConsoleNav's #console-client-slot — the CLIENT band, which holds
// the selected client's identity and the tool tabs. The sibling <NavSlot> targets
// #console-nav-slot for the tool's own chrome.
//
// A separate component rather than a prop on NavSlot: the two bands have different owners
// (the /c/[slug] shell vs whichever tool is mounted) and a mistyped id would silently put a
// tool's chrome in the client band.
//
// The target doesn't exist during SSR (ConsoleNav renders it, but portals run client-side),
// so we gate on a mounted flag and look the node up after paint.
export default function ClientSlot({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setTarget(document.getElementById('console-client-slot'));
  }, []);

  return target ? createPortal(children, target) : null;
}
