'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * The bar's wayfinding trail: Home / Section.
 *
 * This replaced the loose pill links the bar used to carry. The root is a card hub now, so
 * every other route is somewhere you walked TO — the trail names where you are and gives one
 * click back to Home. It's pathname-driven (like ToolSwitcher) and stays a top-level trail:
 * two crumbs at most.
 *
 * On client routes (/c/[slug]/...) the trail reads `Home / Clients` and stops there — the
 * client's brand, plan and status already live in the readout slot (ClientReadout) and the
 * active tool in the tool slot (ToolSwitcher), so duplicating identity here would just crowd
 * the bar. Dynamic leaves (/archive/[id]) show their section, not the raw id.
 */

const LABELS: Record<string, string> = {
  briefing: 'Briefing',
  leads: 'Leads',
  finances: 'Finances',
  clients: 'Clients',
  tickets: 'Tickets',
  archive: 'Archive',
  'sms-consent': 'SMS consent',
  setup: 'Setup',
  'go-live': 'Go live',
  onboard: 'Onboard',
  orphans: 'Orphans',
  // `/c/[slug]` is the per-client shell — label its crumb "Clients" and point it at the roster.
  c: 'Clients',
};

export default function Breadcrumbs() {
  const pathname = usePathname() ?? '/';
  const segments = pathname.split('/').filter(Boolean);

  // On the hub itself there's nowhere to point back to — the mark is the only affordance.
  if (segments.length === 0) return null;

  const first = segments[0];
  const label = LABELS[first];

  // Unknown top-level segment: show Home only rather than a raw slug crumb.
  if (!label) {
    return (
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center text-xs">
        <HomeCrumb />
      </nav>
    );
  }

  // The per-client shell: Home / Clients, where Clients links to the roster.
  if (first === 'c') {
    return (
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-xs">
        <HomeCrumb />
        <Sep />
        <Link href="/clients" className="shrink-0 text-fg2 transition-colors hover:text-fg">
          Clients
        </Link>
      </nav>
    );
  }

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-xs">
      <HomeCrumb />
      <Sep />
      <span className="truncate text-fg" aria-current="page">
        {label}
      </span>
    </nav>
  );
}

function HomeCrumb() {
  return (
    <Link href="/" className="shrink-0 text-fg2 transition-colors hover:text-fg">
      Home
    </Link>
  );
}

function Sep() {
  return (
    <span className="shrink-0 select-none text-fg3" aria-hidden>
      /
    </span>
  );
}
