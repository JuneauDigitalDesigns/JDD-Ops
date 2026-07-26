'use client';

import NavSlot from '@/components/NavSlot';
import PlanChip from '@/components/PlanChip';
import StatusBadge from '@/components/StatusBadge';
import { useManage } from './ManageContext';

/**
 * Client identity in the global top bar, the way /build puts its step rail there —
 * it saves a full horizontal band and keeps context pinned while the stage scrolls.
 *
 * The site switcher lives here rather than in a section because it applies to all of
 * them: switching site on Deployments and then moving to Environment should keep the
 * same site selected.
 */
export default function ManageNavChrome() {
  const { ctx, siteSlug, setSiteSlug, multiSite } = useManage();

  return (
    <NavSlot>
      <div className="flex min-w-0 items-center gap-2.5 border-l border-rule pl-3">
        <span className="truncate font-display text-lg font-semibold tracking-tightish text-fg">
          {ctx.brandName}
        </span>
        <PlanChip plan={ctx.plan} />
        <StatusBadge status={ctx.detectedStatus} />
      </div>

      {multiSite && (
        <div className="flex shrink-0 items-center gap-1.5 border-l border-rule pl-3">
          <span className="kicker">Site</span>
          <div className="flex items-center gap-1">
            {ctx.sites.map((s) => (
              <button
                key={s.slug}
                type="button"
                onClick={() => setSiteSlug(s.slug)}
                title={s.brandName}
                className={s.slug === siteSlug ? 'btn btn-xs btn-primary' : 'btn btn-xs'}
              >
                {s.brandShort ?? s.slug}
              </button>
            ))}
          </div>
        </div>
      )}
    </NavSlot>
  );
}
