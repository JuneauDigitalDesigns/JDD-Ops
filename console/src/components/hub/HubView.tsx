'use client';

import Link from 'next/link';
import {
  Archive,
  ArrowRight,
  CalendarBlank,
  ChartLineUp,
  ChatText,
  CurrencyDollar,
  Funnel,
  Lifebuoy,
  Users,
  type Icon,
} from '@phosphor-icons/react';
import PageHeader from '@/components/shell/PageHeader';

/**
 * The console's front door: a launch hub, not a dashboard.
 *
 * The root used to be the briefing — a dense triage screen you landed in before you'd had
 * a chance to decide what you came to do. This is the starting place instead: one card per
 * major section, so the app reads as a web you begin from and walk through, with the bar's
 * breadcrumb (see shell/Breadcrumbs) carrying you back. The briefing kept everything and
 * moved to /briefing, reached from its own card here.
 *
 * Deliberately static — these are launchers, not live tiles. No counts, no fetch. It carries
 * `'use client'` only because Phosphor's icons are client-only in this repo (every icon use
 * lives in a client file); there is no state here. If a card ever needs a "3 need attention"
 * badge, that's a later, additive change.
 *
 * Two tiers: the three things you open daily (Briefing, Leads, Finances) are large cards up
 * top; the rest (Clients, Tickets, Archive, SMS consent) are compact cards below. Setup and
 * Go-live stay in the bar's utility cluster — one-time, account-wide checklists, not daily
 * destinations, so they don't earn a card.
 */

type HubCard = {
  href: string;
  title: string;
  blurb: string;
  Icon: Icon;
  tier: 'primary' | 'secondary';
};

const CARDS: HubCard[] = [
  {
    href: '/briefing',
    title: 'Briefing',
    blurb: 'What needs doing — findings, failing payments, the funnel and the money at a glance.',
    Icon: ChartLineUp,
    tier: 'primary',
  },
  {
    href: '/leads',
    title: 'Leads',
    blurb: 'The sales funnel — prospects from the agency site and demo-agent calls, before they sign.',
    Icon: Funnel,
    tier: 'primary',
  },
  {
    href: '/calendar',
    title: 'Calendar',
    blurb: 'Scheduled meetings — calls and video, by day. Book one straight from a lead.',
    Icon: CalendarBlank,
    tier: 'primary',
  },
  {
    href: '/finances',
    title: 'Finances',
    blurb: 'Income, expenses, draws and the tax reserve — the money side of the business.',
    Icon: CurrencyDollar,
    tier: 'primary',
  },
  {
    href: '/clients',
    title: 'Clients',
    blurb: 'The searchable roster — find a client and open them.',
    Icon: Users,
    tier: 'secondary',
  },
  {
    href: '/tickets',
    title: 'Tickets',
    blurb: 'Support queue — triage, reply, change status.',
    Icon: Lifebuoy,
    tier: 'secondary',
  },
  {
    href: '/archive',
    title: 'Archive',
    blurb: 'Torn-down clients, newest first.',
    Icon: Archive,
    tier: 'secondary',
  },
  {
    href: '/sms-consent',
    title: 'SMS consent',
    blurb: 'Who agreed to be texted, and at which number.',
    Icon: ChatText,
    tier: 'secondary',
  },
];

export default function HubView() {
  const primary = CARDS.filter((c) => c.tier === 'primary');
  const secondary = CARDS.filter((c) => c.tier === 'secondary');

  return (
    <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <PageHeader title="Console" lede="Everything, from one place." />

      {/* Primary — the things you open daily. */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {primary.map((c) => (
          <PrimaryCard key={c.href} card={c} />
        ))}
      </div>

      {/* Secondary — reached often, but not where the day starts. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {secondary.map((c) => (
          <SecondaryCard key={c.href} card={c} />
        ))}
      </div>
    </div>
  );
}

/**
 * Hover treatment mirrors the panel-links already in BriefingView (FunnelPanel / MoneyPanel):
 * the border warms to the accent and the title follows, so a card reads as "openable" without
 * a button sitting inside a card that is itself a link.
 */
function PrimaryCard({ card: { href, title, blurb, Icon } }: { card: HubCard }) {
  return (
    <Link
      href={href}
      className="panel group flex flex-col gap-3 p-5 transition-colors hover:border-[var(--accent)]"
    >
      <div className="flex items-center justify-between">
        <Icon size={24} weight="duotone" style={{ color: 'var(--accent)' }} />
        <ArrowRight
          size={16}
          weight="bold"
          className="text-fg3 transition-colors group-hover:text-accent"
        />
      </div>
      <h2 className="font-display text-xl font-semibold tracking-tightish text-fg transition-colors group-hover:text-accent">
        {title}
      </h2>
      <p className="text-[13px] leading-snug text-fg3">{blurb}</p>
    </Link>
  );
}

function SecondaryCard({ card: { href, title, blurb, Icon } }: { card: HubCard }) {
  return (
    <Link
      href={href}
      className="panel group flex flex-col gap-2 p-4 transition-colors hover:border-[var(--accent)]"
    >
      <Icon size={18} weight="duotone" className="text-fg2 transition-colors group-hover:text-accent" />
      <h2 className="font-display text-[15px] font-semibold tracking-tightish text-fg transition-colors group-hover:text-accent">
        {title}
      </h2>
      <p className="meta leading-snug">{blurb}</p>
    </Link>
  );
}
