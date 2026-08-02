'use client';

/**
 * The console's left rail — one shell, used by both /manage and the onboarding runbook.
 *
 * ── No identity header ──────────────────────────────────────────────────────────────────
 * Both rails used to open with the brand name at text-2xl, the slug, and a plan badge. The
 * navbar already says all three, so on every manage and runbook screen the client was named
 * twice within 200px of each other — three times counting the page heading. The rail's job
 * is "which section", full stop.
 *
 * That removal is what let the width come down from 286px to 220px: the rail was only ever
 * that wide to fit a display-face brand name.
 *
 * ── The footer ──────────────────────────────────────────────────────────────────────────
 * What the header carried that was actually load-bearing — the live URL, run progress —
 * moved to the bottom, where it reads as status rather than as a title. The live URL link
 * matters: with the navbar readout inert, this is the only place in the app you can click
 * through to the client's real site.
 */
export default function NavRail({
  label,
  children,
  footer,
}: {
  /** aria-label for the <nav> — "Manage sections", "Runbook steps". */
  label: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <nav
      className="no-scrollbar flex h-full w-[220px] shrink-0 flex-col overflow-y-auto border-r border-rule"
      aria-label={label}
    >
      <div className="flex flex-col py-2">{children}</div>

      {footer && (
        <div className="mt-auto flex flex-col gap-2 border-t border-rule px-4 py-3">{footer}</div>
      )}
    </nav>
  );
}

/**
 * A rail group header — the phase title in the runbook, with an optional right-aligned count.
 * Uses .kicker: this is a genuine section eyebrow, one of the ~10 places that survived the
 * .kicker → .meta split.
 */
export function RailGroup({
  title,
  count,
  tight,
  children,
}: {
  title: string;
  count?: string;
  /** Fewer groups reads as a truncated app if each gets a heavy header — quiet them down. */
  tight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col">
      <div
        className={`flex items-center justify-between gap-2 px-4 ${tight ? 'pb-1 pt-3' : 'pb-1.5 pt-4'}`}
      >
        <span className="kicker truncate">{title}</span>
        {count && <span className="meta shrink-0">{count}</span>}
      </div>
      {children}
    </section>
  );
}
