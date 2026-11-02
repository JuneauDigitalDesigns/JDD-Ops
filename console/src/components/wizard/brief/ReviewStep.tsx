'use client';

/**
 * The Review step — the copy wireframe, plus the approve action pinned beside it.
 *
 * The approve button used to live in the Intake's header bar, which this rebuild deleted. It
 * could not simply move to the Prev/Next footer either: reviewing means scrolling a long
 * wireframe of every section on every page, and a button at the bottom of that scroll is a
 * button you have to go looking for once you've decided. So it sits in a rail that sticks to
 * the top of the viewport — you can approve from any scroll position, the moment you're
 * satisfied.
 *
 * The gate is unchanged and still hard: model-generated copy that is still ticked for
 * regeneration has not been read by anyone, so Approve stays disabled until every such section
 * has been accepted. The rail states the count and the reason rather than just greying out.
 */
import { CheckCircle, WarningCircle, ArrowRight } from '@phosphor-icons/react';
import type { SiteContent } from '@/data/site';
import type { VerdictKey } from '@/lib/copy-schema';
import type { ReviewPage } from '@/lib/copy-review-groups';
import CopyWireframe, { type SectionVerdict } from '../CopyWireframe';

export default function ReviewStep({
  content, setField, verdictFor, pages, unreviewed, hasGenerated, gateReason, onApprove,
}: {
  content: SiteContent;
  setField: (path: string, value: unknown) => void;
  verdictFor: (key: VerdictKey) => SectionVerdict;
  pages: ReviewPage[];
  unreviewed: Set<VerdictKey>;
  hasGenerated: boolean;
  /** Human reason the gate is closed, or undefined when it's open. */
  gateReason?: string;
  onApprove: () => void;
}) {
  const blocked = unreviewed.size > 0;

  return (
    <div className="flex min-h-full gap-6">
      <div className="min-w-0 flex-1">
        <CopyWireframe
          content={content}
          setField={setField}
          verdictFor={verdictFor}
          pages={pages}
          unreviewed={unreviewed}
          hasGenerated={hasGenerated}
        />
      </div>

      {/* w-[240px] shrink-0 with a sticky child — the scroll container is an ancestor, so
          `sticky top-4` holds this at the top of the viewport for the whole scroll. */}
      <aside className="w-[240px] shrink-0">
        <div className="sticky top-4 flex flex-col gap-3 rounded-xl border border-uiCardRule bg-uiBg p-4 shadow-raised">
          <div>
            <p className="kicker mb-1.5">Ready to build?</p>
            {blocked ? (
              <p className="flex items-start gap-1.5 text-xs leading-relaxed" style={{ color: 'var(--warn)' }}>
                <WarningCircle size={13} weight="fill" style={{ flexShrink: 0, marginTop: 2 }} />
                <span>
                  {unreviewed.size} section{unreviewed.size === 1 ? '' : 's'} still unreviewed.
                  Accept or re-roll each one.
                </span>
              </p>
            ) : (
              <p className="flex items-start gap-1.5 text-xs leading-relaxed text-ok">
                <CheckCircle size={13} weight="fill" style={{ flexShrink: 0, marginTop: 2 }} />
                <span>
                  {hasGenerated
                    ? 'Everything generated has been reviewed.'
                    : 'No generated copy to review.'}
                </span>
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onApprove}
            disabled={blocked}
            title={gateReason}
            className="btn btn-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-50"
          >
            Approve &amp; continue <ArrowRight size={14} />
          </button>

          <p className="text-2xs leading-relaxed text-uiFg3">
            Takes you to the Studio, where you compose the pages. You can come back to the
            Intake at any time.
          </p>
        </div>
      </aside>
    </div>
  );
}
