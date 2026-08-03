'use client';

import Link from 'next/link';
import { Warning } from '@phosphor-icons/react';
import { PLAN_LABEL } from '@/lib/runbook-content';
import { relativeTime, absoluteTime } from '@/lib/relativeTime';
import type { Plan } from '@/lib/types';

export interface PendingOnboardSummary {
  slug: string;
  name: string;
  plan: string;
  signerEmail: string;
  createdAt: number;
}

export default function PendingOnboardCard({ item }: { item: PendingOnboardSummary }) {
  const planLabel = (['starter', 'growth', 'enterprise'] as Plan[]).includes(item.plan as Plan)
    ? PLAN_LABEL[item.plan as Plan]
    : item.plan;

  return (
    <Link
      href={`/c/${item.slug}/manage/overview`}
      className="panel group relative flex cursor-pointer flex-col overflow-hidden p-0 text-left transition-all duration-150 hover:-translate-y-0.5 hover:border-accent hover:shadow-panel focus:outline-none focus-visible:ring-2 focus-visible:ring-uiAccent"
    >
      <span aria-hidden className="h-1 w-full shrink-0" style={{ background: 'var(--warn)' }} />

      <div className="flex min-w-0 flex-1 flex-col gap-3 p-5">
        <div className="min-w-0">
          <h3 className="font-display text-[26px] font-semibold leading-[1.1] tracking-tightish text-fg">
            {item.name}
          </h3>
          <p className="mono mt-1 truncate text-2xs text-fg3">{item.slug}</p>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="meta">{planLabel}</span>
          <span aria-hidden className="text-fg3">·</span>
          <span className="flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--warn)' }}>
            <Warning size={12} weight="fill" />
            Pending Onboarding
          </span>
        </div>

        <div className="mt-auto flex flex-col gap-1">
          <p className="mono truncate text-2xs text-fg3">{item.signerEmail}</p>
          <p
            className="text-2xs text-fg3"
            title={absoluteTime(item.createdAt)}
          >
            Paid {relativeTime(item.createdAt)}
          </p>
        </div>
      </div>
    </Link>
  );
}
