'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, Stack, ClipboardText, Wrench, ArrowRight } from '@phosphor-icons/react';
import ThemeToggle from '@/app/components/theme/ThemeToggle';

// Persistent console top nav. Lives in the ROOT layout — outside the `.studio-chrome`
// (/build) and `.onboard-chrome` (/onboard) scopes — so it always resolves the global
// JDD console palette (--bg / --fg / --accent / --rule / .btn*), which globals.css themes
// for light + dark. The route toggle links to the *other* tool based on the current path;
// on the home landing it offers both.
export default function ConsoleNav() {
  const pathname = usePathname() ?? '/';
  const onBuild = pathname.startsWith('/build');
  const onOnboard = pathname.startsWith('/onboard') || pathname.startsWith('/setup');
  const onManage = pathname.startsWith('/manage');

  return (
    <header className="relative z-50 flex h-11 shrink-0 items-center justify-between border-b border-rule bg-[var(--bg)] px-5">
      <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
        <Compass size={17} weight="fill" style={{ color: 'var(--accent)' }} />
        <span className="font-display text-[14px] font-semibold tracking-tightish text-fg">JDD Console</span>
      </Link>

      {/* Link to the tools you're not currently on. */}
      <div className="flex items-center gap-2">
        <ThemeToggle />
        {!onBuild && <ToggleButton href="/build" label="Build" icon={<Stack size={13} />} />}
        {!onOnboard && <ToggleButton href="/onboard" label="Onboard" icon={<ClipboardText size={13} />} />}
        {!onManage && <ToggleButton href="/manage" label="Manage" icon={<Wrench size={13} />} />}
      </div>
    </header>
  );
}

function ToggleButton({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <Link href={href} className="btn btn-xs btn-primary">
      {icon} {label} <ArrowRight size={11} weight="bold" />
    </Link>
  );
}
