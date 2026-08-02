'use client';

import { useEffect, useState } from 'react';

/**
 * The per-tool action strip, directly below the console bar and above the work.
 *
 * Everything evicted from the navbar lands here: the Build wizard's step pills and
 * undo/redo/Back/Next, Deploy, the enterprise site switcher, `Pipeline →`. The rule is
 * that an action sits next to the thing it acts on — the navbar is wayfinding only.
 *
 * ── Why it self-collapses ────────────────────────────────────────────────────────────
 * Not every route has actions. /leads has none at all once Refresh moved to the navbar
 * utility cluster. A permanently reserved 40px strip would put an empty band under the bar
 * on those routes, which reads as a rendering bug.
 *
 * So the strip measures its own portal target and renders nothing at all when it's empty.
 * A MutationObserver rather than a render-time check because the target is filled by a
 * PORTAL from a descendant — the fill happens after this component has already committed,
 * so there is no render pass in which we could simply look at children.
 */
export default function ToolBar() {
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    const target = document.getElementById('console-toolbar-slot');
    if (!target) return;

    const sync = () => setFilled(target.childElementCount > 0);
    sync();

    const observer = new MutationObserver(sync);
    observer.observe(target, { childList: true });
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={
        filled
          ? 'relative z-40 flex h-10 shrink-0 items-center gap-2 border-b border-rule bg-[var(--bg)] px-4'
          : 'hidden'
      }
    >
      {/* Always rendered, even while hidden — the portal target must exist in the DOM for
          a route to be able to fill it, and filling it is what un-hides the strip. */}
      <div id="console-toolbar-slot" className="flex min-w-0 flex-1 items-center gap-2" />
    </div>
  );
}
