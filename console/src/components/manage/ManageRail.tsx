'use client';

import { useSearchParams, useSelectedLayoutSegment } from 'next/navigation';
import type { Icon } from '@phosphor-icons/react';
import {
  ArrowSquareOut,
  Gauge,
  Globe,
  Microphone,
  RocketLaunch,
  Sliders,
  UserCircle,
} from '@phosphor-icons/react';
import NavRail from '@/components/shell/NavRail';
import RailRow from '@/components/shell/RailRow';
import { sectionsForPlan, type ManageSection } from '@/lib/manageSections';
import { useManage } from './ManageContext';

/**
 * The /manage section list. Thin: <NavRail> owns the shell and <RailRow> owns the row, so
 * this file is only the manage-specific parts — the icon map, the plan gate, and carrying
 * ?site= across links.
 *
 * Lives in the [slug] layout, so it does NOT remount when you move between sections. The
 * active row comes from the URL segment rather than from state, which is what makes that
 * work.
 *
 * The identity header this used to open with (brandName at text-2xl, slug, live URL) is
 * gone — see NavRail. The live URL survives in the rail footer.
 */

const ICONS: Record<ManageSection['icon'], Icon> = {
  gauge: Gauge,
  sliders: Sliders,
  rocket: RocketLaunch,
  globe: Globe,
  microphone: Microphone,
  portal: UserCircle,
};

export default function ManageRail({
  /** Per-section attention markers, e.g. { environment: 2 } for 2 drifted keys. */
  badges = {},
}: {
  badges?: Partial<Record<ManageSection['id'], number>>;
}) {
  const { ctx, domains } = useManage();
  const active = useSelectedLayoutSegment();
  const params = useSearchParams();

  const sections = sectionsForPlan(ctx.plan);
  // Carry ?site= across section links so the enterprise selection survives navigation.
  const site = params.get('site');
  const qs = site ? `?site=${encodeURIComponent(site)}` : '';

  // From Vercel, not from seo.canonical — that field is a placeholder until someone fills
  // it in, and linking to it sent you to a domain the client never owned.
  const liveUrl = domains.liveUrl;
  const unverifiedUrl = domains.source === 'canonical';

  return (
    <NavRail
      label="Manage sections"
      footer={
        liveUrl ? (
          <a
            href={liveUrl}
            target="_blank"
            rel="noreferrer"
            title={
              unverifiedUrl
                ? "Couldn't reach Vercel — this is what site.ts claims, which may be a placeholder."
                : liveUrl
            }
            className="meta flex w-fit items-center gap-1.5 transition-colors hover:text-accent"
          >
            <span className="truncate">{liveUrl.replace(/^https?:\/\//, '')}</span>
            {unverifiedUrl && <span style={{ color: 'var(--warn)' }}>?</span>}
            <ArrowSquareOut size={11} className="shrink-0" />
          </a>
        ) : undefined
      }
    >
      {sections.map((section) => {
        const SectionIcon = ICONS[section.icon];
        const isActive = active === section.id;
        return (
          <RailRow
            key={section.id}
            label={section.label}
            leading={<SectionIcon size={15} weight={isActive ? 'fill' : 'regular'} />}
            active={isActive}
            href={`/c/${ctx.slug}/manage/${section.id}${qs}`}
            badge={badges[section.id]}
          />
        );
      })}
    </NavRail>
  );
}
