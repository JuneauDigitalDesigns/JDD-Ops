'use client';

import Link from 'next/link';
import { Stack, ClipboardText, Wrench, ArrowRight, Compass } from '@phosphor-icons/react';

// Home landing — shown on every launch. Three large card "buttons" route to the three
// tools, which are peers rather than a sequence. Chrome comes from the global body +
// tokens (globals.css). No auto redirect: the operator always chooses from here, so
// ConsoleNav hides its route links on this route.
//
// Deliberately wordless below the headers: the icon, the name, and the "Open X" action
// are the whole message. Prose descriptions here explained things the operator already
// knows by the second visit.
export default function Home() {
  return (
    <main className="no-scrollbar relative z-10 flex h-full flex-col items-center justify-center overflow-y-auto px-6 py-16">
      {/* Brand mark */}
      <div className="mb-12 flex flex-col items-center text-center">
        <div className="mb-5 flex items-center gap-2.5">
          <Compass size={28} weight="fill" style={{ color: 'var(--accent)' }} />
          <span className="kicker">Juneau Digital Designs · Console</span>
        </div>
        <h1 className="font-display text-[46px] font-semibold leading-[1.05] tracking-tightish text-fg sm:text-[60px]">
          Where to today?
        </h1>
      </div>

      {/* Three card buttons — wraps to 2-up before going 3-up so the cards never crush */}
      <div className="grid w-full max-w-5xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <CardLink href="/build" icon={<Stack size={34} weight="duotone" />} title="Build" />
        <CardLink href="/onboard" icon={<ClipboardText size={34} weight="duotone" />} title="Onboard" />
        <CardLink href="/manage" icon={<Wrench size={34} weight="duotone" />} title="Manage" />
      </div>
    </main>
  );
}

function CardLink({ href, icon, title }: { href: string; icon: React.ReactNode; title: string }) {
  return (
    <Link
      href={href}
      className="panel group relative flex flex-col gap-6 p-8 shadow-raised transition-all duration-200 hover:-translate-y-1 hover:border-accent hover:shadow-panel"
      style={{ borderColor: 'var(--rule)' }}
    >
      <div
        className="flex h-16 w-16 items-center justify-center rounded-2xl border text-accent transition-colors group-hover:border-accent"
        style={{ background: 'var(--surface)', borderColor: 'var(--rule-strong)' }}
      >
        {icon}
      </div>
      <h2 className="font-display text-3xl font-semibold tracking-tightish text-fg">{title}</h2>
      <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-fg3 transition-colors group-hover:text-accent">
        Open {title} <ArrowRight size={15} weight="bold" />
      </span>
    </Link>
  );
}
