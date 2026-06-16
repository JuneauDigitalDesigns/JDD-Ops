'use client';

import Link from 'next/link';
import { Stack, ClipboardText, ArrowRight, Compass } from '@phosphor-icons/react';

// Home landing — shown on every launch. Two large card "buttons" route to the two tools.
// Aurora-Glass dark chrome comes from the global body + tokens (globals.css). No auto
// redirect: the operator always chooses Build or Onboard from here.
export default function Home() {
  return (
    <main className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-16">
      {/* Brand mark */}
      <div className="mb-10 flex flex-col items-center text-center">
        <div className="mb-5 flex items-center gap-2.5">
          <Compass size={26} weight="fill" style={{ color: 'var(--accent)' }} />
          <span className="kicker">Juneau Digital Designs · Console</span>
        </div>
        <h1 className="font-display text-[40px] font-semibold leading-[1.05] tracking-tightish text-fg sm:text-[52px]">
          Where to today?
        </h1>
        <p className="mt-4 max-w-md text-[15px] leading-relaxed text-fg2">
          Build a client site and provision its repo, or run the onboarding orchestrator to launch a new client.
        </p>
      </div>

      {/* Two card buttons */}
      <div className="grid w-full max-w-3xl gap-5 sm:grid-cols-2">
        <CardLink
          href="/build"
          icon={<Stack size={30} weight="duotone" />}
          eyebrow="Step one"
          title="Build"
          desc="Compose a site from the component catalog, set the brand, and provision the client GitHub repo."
        />
        <CardLink
          href="/onboard"
          icon={<ClipboardText size={30} weight="duotone" />}
          eyebrow="Step two"
          title="Onboard"
          desc="Run the provisioning orchestrator for a client and follow the manual setup runbook to launch."
        />
      </div>
    </main>
  );
}

function CardLink({
  href,
  icon,
  eyebrow,
  title,
  desc,
}: {
  href: string;
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="panel group relative flex flex-col gap-5 p-7 transition-all duration-200 hover:-translate-y-1 hover:border-accent"
      style={{ borderColor: 'var(--rule)' }}
    >
      <div
        className="flex h-14 w-14 items-center justify-center rounded-2xl border text-accent transition-colors group-hover:border-accent"
        style={{ background: 'var(--surface)', borderColor: 'var(--rule-strong)' }}
      >
        {icon}
      </div>
      <div className="flex flex-col gap-2">
        <span className="kicker">{eyebrow}</span>
        <h2 className="font-display text-[28px] font-semibold tracking-tightish text-fg">{title}</h2>
        <p className="text-[14px] leading-relaxed text-fg2">{desc}</p>
      </div>
      <span className="mt-1 inline-flex items-center gap-1.5 text-[13px] font-medium text-fg3 transition-colors group-hover:text-accent">
        Open {title} <ArrowRight size={14} weight="bold" />
      </span>
    </Link>
  );
}
