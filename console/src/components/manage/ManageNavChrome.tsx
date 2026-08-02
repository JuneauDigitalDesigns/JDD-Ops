'use client';

import NavSlot from '@/components/NavSlot';
import { useManage } from './ManageContext';

/**
 * Manage's slice of the per-tool ToolBar strip: just the enterprise site switcher.
 *
 * Client identity used to live here too, but it belongs to the console bar's CONTEXT zone
 * now — it is the same in every tool. What's left is genuinely manage-specific.
 *
 * The switcher sits in the tool strip rather than inside a section because it applies to all
 * of them: switching site on Deployments and then moving to Environment should keep the same
 * site. Single-site clients render nothing, which leaves the strip empty and collapses it.
 */
export default function ManageNavChrome() {
  const { ctx, siteSlug, setSiteSlug, multiSite } = useManage();

  return (
    <NavSlot>
      {multiSite && (
        <div className="flex shrink-0 items-center gap-2">
          <span className="meta">Site</span>
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
