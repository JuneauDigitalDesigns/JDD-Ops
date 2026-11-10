'use client';

/**
 * Step 10, Review: generated copy, one section at a time. Pages and sections on the left,
 * the selected section's wireframe (Accept / Re-roll / Revert, click-to-edit) in the middle.
 * Replaces the long page of every section on every page (8,078 px at 1440×900).
 *
 * The gate is unchanged: a section that was generated and is still ticked for regeneration
 * hasn't been read, and blocks Approve, which now sits on Still to do.
 */
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight } from '@phosphor-icons/react';
import type { SiteContent } from '@/data/site';
import { verdictKey, type VerdictKey } from '@/lib/copy-schema';
import { buildReviewGroups, type ReviewPage } from '@/lib/copy-review-groups';
import { labelFor } from '@/lib/section-labels';
import { SectionReviewCard, type SectionVerdict } from '../CopyWireframe';
import { Card, StatusMark, Tag } from './ui';

export default function ReviewBoard({
  content, setField, verdictFor, pages, unreviewed, hasGenerated,
}: {
  content: SiteContent;
  setField: (path: string, value: unknown) => void;
  verdictFor: (key: VerdictKey) => SectionVerdict;
  pages: ReviewPage[];
  unreviewed: Set<VerdictKey>;
  hasGenerated: boolean;
}) {
  const groups = useMemo(() => buildReviewGroups(pages), [pages]);
  const flat = useMemo(
    () => groups.flatMap((g, gi) => g.sections.map((s) => ({ gi, section: s, route: g.route || undefined, key: verdictKey(s, g.route || undefined) }))),
    [groups],
  );
  const [gi, setGi] = useState(0);
  const [key, setKey] = useState<VerdictKey | null>(null);

  // Open on the first section still to review, else the first section.
  useEffect(() => {
    if (key && flat.some((f) => f.key === key)) return;
    const first = flat.find((f) => unreviewed.has(f.key)) ?? flat[0];
    if (first) { setKey(first.key); setGi(first.gi); }
  }, [flat, unreviewed, key]);

  const pos = Math.max(0, flat.findIndex((f) => f.key === key));
  const cur = flat[pos];
  const group = groups[gi];
  function go(n: number) {
    const f = flat[n];
    if (!f) return;
    setKey(f.key);
    setGi(f.gi);
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3.5 px-6 py-4">
      <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1">
        <h2 className="font-display text-[28px] font-bold leading-none text-uiInk">Review</h2>
        <span className="text-xs text-uiFg3">One section at a time.</span>
        <span className="ml-auto font-chromeMono text-2xs" style={{ color: unreviewed.size ? 'var(--warn)' : 'var(--ok)' }}>
          {!hasGenerated ? 'Nothing generated yet' : unreviewed.size ? `${unreviewed.size} to review` : 'All reviewed'}
        </span>
      </div>

      <div className="grid min-h-0 flex-1 gap-3.5 lg:grid-cols-[270px_minmax(0,1fr)]">
        <Card
          title={
            <span className="flex flex-wrap gap-1">
              {groups.map((g, k) => {
                const n = g.sections.filter((s) => unreviewed.has(verdictKey(s, g.route || undefined))).length;
                return (
                  <button
                    key={g.route || 'home'}
                    type="button"
                    onClick={() => { setGi(k); const f = flat.find((x) => x.gi === k); if (f) setKey(f.key); }}
                    className={`rounded-md px-2 py-0.5 font-chrome text-xs normal-case tracking-normal ${k === gi ? 'bg-uiInk text-uiCanvas' : 'text-uiFg2 hover:bg-uiSurface'}`}
                    style={k === gi ? { background: 'var(--accent)', color: 'var(--accent-ink)' } : undefined}
                  >
                    {g.label}{n > 0 ? ` · ${n}` : ''}
                  </button>
                );
              })}
            </span>
          }
        >
          <ul>
            {group?.sections.map((s) => {
              const k = verdictKey(s, group.route || undefined);
              const open = unreviewed.has(k);
              return (
                <li key={k}>
                  <button
                    type="button"
                    onClick={() => setKey(k)}
                    aria-current={k === key ? 'true' : undefined}
                    className={`flex h-10 w-full items-center gap-2.5 border-l-[3px] px-3.5 text-left text-[13.5px] ${k === key ? 'border-uiAccent bg-uiSurface font-semibold' : 'border-transparent hover:bg-uiSurface/60'}`}
                  >
                    <StatusMark ok={!open} />
                    {labelFor(s)}
                    <span className="ml-auto">{open ? <Tag tone="warn">To review</Tag> : null}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="flex min-h-0 flex-col gap-2">
          <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
            {cur && (
              <SectionReviewCard
                key={cur.key}
                section={cur.section}
                route={cur.route}
                content={content}
                setField={setField}
                verdict={verdictFor(cur.key)}
              />
            )}
          </div>
          <div className="flex shrink-0 items-center justify-between">
            <button type="button" className="btn btn-sm" disabled={pos === 0} onClick={() => go(pos - 1)}>
              <ArrowLeft size={13} /> {flat[pos - 1] ? labelFor(flat[pos - 1].section) : 'Previous'}
            </button>
            <span className="font-chromeMono text-2xs text-uiFg3">{pos + 1} of {flat.length}</span>
            <button type="button" className="btn btn-sm" disabled={pos >= flat.length - 1} onClick={() => go(pos + 1)}>
              {flat[pos + 1] ? labelFor(flat[pos + 1].section) : 'Next'} <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
