'use client';

import Link from 'next/link';
import { Gear } from '@phosphor-icons/react';
import JddMark from './shell/JddMark';

/**
 * The persistent console bar. Lives in the ROOT layout — outside the `.studio-chrome`
 * (build) and `.onboard-chrome` (onboard) scopes — so it always resolves the global JDD
 * palette (--bg / --fg / --accent / --rule / .btn*).
 *
 * ── THREE ZONES, one job each ───────────────────────────────────────────────────────────
 *
 *   [JDD] [ Build │ Onboard │ Manage ]   arthur-plumbing · growth · ● Live │ ⌘K ↻ ⚙
 *   └──────── NAVIGATE ──────────────┘   └──── CONTEXT (inert) ───────────┘└ UTILITIES ┘
 *
 * This replaced a bar that mixed all three. On /c/{slug}/build it used to carry the logo,
 * a back link, the brand name, a plan chip, a status badge, three tool tabs, two wizard
 * step pills, undo/redo, Back and Next — twelve-plus targets spanning six unrelated
 * concepts, separated by nothing but `gap-4`. The problem was never density; it was that
 * nothing told you which controls belonged to which scope.
 *
 * So: everything you can navigate with is on the LEFT. The client you're working on is a
 * muted, non-interactive readout in the MIDDLE-RIGHT — visible, never competing. App-level
 * utilities sit past a hairline on the FAR RIGHT.
 *
 * Page actions do not live here at all. They moved to <ToolBar>, the strip directly below,
 * where they sit next to the work they act on.
 *
 * The bar is otherwise empty on its own: the middle three regions are portal targets filled
 * from below (see shell/slots.tsx for why there are four separate ones rather than one).
 */
export default function ConsoleNav() {
  return (
    <header className="relative z-50 flex h-[52px] shrink-0 items-center gap-3 border-b border-rule bg-[var(--bg)] px-4">
      {/* ── NAVIGATE ──────────────────────────────────────────────────────── */}
      <JddMark />

      {/* The tool switcher (see <ToolSwitcher>). Empty on / and /leads, which have
          no client selected — there the mark stands alone. */}
      <div id="console-tools-slot" className="flex shrink-0 items-center" />

      {/* ── CONTEXT ───────────────────────────────────────────────────────────
          ml-auto pushes this and everything after it right. min-w-0 so a long brand
          name truncates rather than shoving the utilities off the bar. */}
      <div id="console-readout-slot" className="ml-auto flex min-w-0 items-center justify-end" />

      {/* ── UTILITIES ─────────────────────────────────────────────────────────
          Divided by a real rule, because this is the one place on the right that IS
          clickable — an unmarked mix of inert text and buttons is worse than either
          rule on its own. */}
      <div className="flex shrink-0 items-center gap-1 border-l border-rule pl-3">
        <span
          className="meta hidden select-none px-1 sm:inline"
          title="Press ⌘K (or Ctrl+K) to jump to any client"
        >
          ⌘K
        </span>

        {/* Route-scoped utilities — Refresh on / and /leads. */}
        <div id="console-utility-slot" className="flex items-center gap-1" />

        {/* /setup is the one-time master setup checklist. It had no link path into it
            from anywhere in the app until this gear existed. */}
        <Link
          href="/setup"
          title="One-time master setup"
          aria-label="One-time master setup"
          className="flex h-7 w-7 items-center justify-center rounded-[6px] text-fg3 transition-colors hover:bg-[var(--surface-2)] hover:text-fg"
        >
          <Gear size={15} />
        </Link>
      </div>
    </header>
  );
}
