'use client';

import Link from 'next/link';
import { useSearchParams, useSelectedLayoutSegment } from 'next/navigation';
import type { Icon } from '@phosphor-icons/react';
import {
  ArrowLeft,
  ArrowSquareOut,
  Gauge,
  Microphone,
  RocketLaunch,
  Sliders,
  UserCircle,
  Warning,
} from '@phosphor-icons/react';
import { sectionsForPlan, type ManageSection } from '@/lib/manageSections';
import { useManage } from './ManageContext';

/**
 * The persistent left rail. Lives in the [slug] layout, so it does NOT remount when you
 * move between sections — the active row is derived from the URL segment rather than
 * from state, which is what makes that work.
 *
 * Follows StepRail's chrome: same width, same border, and the same absolute 2px accent
 * edge for the active row (a border swap would shift the text by a pixel).
 */

const ICONS: Record<ManageSection['icon'], Icon> = {
  gauge: Gauge,
  sliders: Sliders,
  rocket: RocketLaunch,
  microphone: Microphone,
  portal: UserCircle,
};

export default function ManageRail({
  /** Per-section attention markers, e.g. { environment: 2 } for 2 drifted keys. */
  badges = {},
}: {
  badges?: Partial<Record<ManageSection['id'], number>>;
}) {
  const { ctx, site, siteSlug, multiSite } = useManage();
  const active = useSelectedLayoutSegment();
  const params = useSearchParams();

  const sections = sectionsForPlan(ctx.plan);
  // Carry ?site= across section links so the enterprise selection survives navigation.
  const qs = params.get('site') ? `?site=${encodeURIComponent(params.get('site') as string)}` : '';

  const liveUrl = site.canonical
    ? site.canonical.startsWith('http')
      ? site.canonical
      : `https://${site.canonical}`
    : null;

  return (
    <nav
      className="no-scrollbar flex h-full w-[286px] shrink-0 flex-col overflow-y-auto border-r border-rule"
      aria-label="Manage sections"
    >
      <div className="flex flex-col gap-3 border-b border-rule px-5 py-4">
        <Link
          href="/manage"
          className="-ml-1 flex w-fit items-center gap-1.5 text-xs text-fg3 transition-colors hover:text-fg"
        >
          <ArrowLeft size={13} /> All clients
        </Link>

        <div className="flex flex-col gap-2">
          <h2 className="font-display text-2xl font-semibold leading-none tracking-tightest text-fg">
            {ctx.brandName}
          </h2>
          <span className="font-mono text-xs text-fg3">{multiSite ? siteSlug : ctx.slug}</span>
        </div>

        {liveUrl && (
          <a
            href={liveUrl}
            target="_blank"
            rel="noreferrer"
            className="flex w-fit items-center gap-1.5 text-xs text-fg3 transition-colors hover:text-accent"
          >
            {liveUrl.replace(/^https?:\/\//, '')} <ArrowSquareOut size={12} />
          </a>
        )}
      </div>

      <div className="flex flex-col py-2">
        {sections.map((section) => (
          <RailRow
            key={section.id}
            section={section}
            href={`/manage/${ctx.slug}/${section.id}${qs}`}
            active={active === section.id}
            badge={badges[section.id]}
          />
        ))}
      </div>
    </nav>
  );
}

function RailRow({
  section,
  href,
  active,
  badge,
}: {
  section: ManageSection;
  href: string;
  active: boolean;
  badge?: number;
}) {
  const Icon = ICONS[section.icon];
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className="relative flex items-center gap-3 px-5 py-2.5 transition-colors"
      style={{ background: active ? 'var(--surface-2)' : undefined }}
    >
      {/* Absolute edge, not a border — a border swap would nudge the label sideways. */}
      {active && (
        <span
          className="absolute inset-y-0 left-0 w-[2px]"
          style={{ background: 'var(--accent)' }}
          aria-hidden
        />
      )}
      <Icon size={16} weight={active ? 'fill' : 'regular'} />
      <span
        className="flex-1 text-sm transition-colors"
        style={{ color: active ? 'var(--fg)' : 'var(--fg-2)' }}
      >
        {section.label}
      </span>
      {badge !== undefined && badge > 0 && (
        <span
          className="flex items-center gap-1 text-2xs"
          style={{ color: 'var(--warn)' }}
          title={`${badge} item${badge === 1 ? '' : 's'} need attention`}
        >
          <Warning size={12} weight="fill" />
          {badge}
        </span>
      )}
    </Link>
  );
}
