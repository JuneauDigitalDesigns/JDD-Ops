'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, Stack, ClipboardText, Wrench, ArrowRight } from '@phosphor-icons/react';

// Persistent console top nav. Lives in the ROOT layout — outside the `.studio-chrome`
// (/build) and `.onboard-chrome` (/onboard) scopes — so it always resolves the global
// JDD console palette (--bg / --fg / --accent / --rule / .btn*). The route toggle links
// to the *other* tools based on the current path; on the home landing it shows none,
// since the page's own cards already offer all three.
//
// The middle SLOT (#console-nav-slot) is a portal target: route-level chrome that used to
// sit in a second bar (the wizard's step rail, /onboard's title + Refresh) renders into it
// via <NavSlot>, so those routes save a full horizontal band of vertical space. The slot is
// empty on routes that don't fill it.
export default function ConsoleNav() {
  const pathname = usePathname() ?? '/';
  const onHome = pathname === '/';
  const onBuild = pathname.startsWith('/build');
  const onOnboard = pathname.startsWith('/onboard') || pathname.startsWith('/setup');
  const onManage = pathname.startsWith('/manage');

  return (
    <header className="relative z-50 flex h-16 shrink-0 items-center gap-4 border-b border-rule bg-[var(--bg)] px-6">
      <Link href="/" className="flex shrink-0 items-center gap-2.5 transition-opacity hover:opacity-80">
        <Compass size={21} weight="fill" style={{ color: 'var(--accent)' }} />
        <span className="font-display text-lg font-semibold tracking-tightish text-fg">JDD Console</span>
      </Link>

      {/* Portal target for route-level chrome (see <NavSlot>). min-w-0 so its children can
          truncate rather than shove the route links off the bar. */}
      <div id="console-nav-slot" className="flex min-w-0 flex-1 items-center gap-3" />

      {/* Link to the tools you're not currently on — but never on home, where the cards do it. */}
      <div className="flex shrink-0 items-center gap-2">
        {!onHome && (
          <>
            {!onBuild && <ToggleButton href="/build" label="Build" icon={<Stack size={15} />} />}
            {!onOnboard && <ToggleButton href="/onboard" label="Onboard" icon={<ClipboardText size={15} />} />}
            {!onManage && <ToggleButton href="/manage" label="Manage" icon={<Wrench size={15} />} />}
          </>
        )}
      </div>
    </header>
  );
}

function ToggleButton({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <Link href={href} className="btn btn-xs btn-primary">
      {icon} {label} <ArrowRight size={13} weight="bold" />
    </Link>
  );
}
