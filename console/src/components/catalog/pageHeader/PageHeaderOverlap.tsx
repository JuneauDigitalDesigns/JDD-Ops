// ─────────────────────────────────────────────────────────────────────────────
// PageHeaderOverlap — overlap-split page header (see the Phase 5 specimen). An inverted
// ink band carries the eyebrow; a flat card overlaps its lower edge with the title, sub
// and CTA. The "overlap" is structural, not a photo: PageHeaderContent has no image
// field, so nothing is claimed and no gradient is used (decision 30b). Same
// {data, editPrefix} contract as PageHeaderSimple; skinless.
// ─────────────────────────────────────────────────────────────────────────────
import type { PageHeaderContent } from '@/data/site';
import type { SkinId } from '@/lib/skins';
import { E } from '@/lib/editable';
import { ArrowRight } from '@phosphor-icons/react';

export const meta = {
  id: 'page-header-overlap',
  category: 'pageHeader',
  label: 'Page header / Overlap',
  consumes: ['subpages.*.header'],
  sharedDeps: ['@phosphor-icons/react'],
  /** Structural archetype, from src/lib/archetypes.ts. Unique within the category. */
  archetype: 'overlap-split',
  signature: false,
} as const;

export default function PageHeaderOverlap({
  data,
  editPrefix,
}: {
  data: PageHeaderContent;
  /** Accepted for catalog interface parity; page headers ship skin-less in v1. */
  skin?: SkinId;
  editPrefix?: string;
}) {
  const field = (name: string, value: string) =>
    editPrefix ? <E p={`${editPrefix}.${name}`}>{value}</E> : value;

  return (
    <section id="page-header" className="bg-bg">
      <div className="bg-inkPanel pb-20 pt-14">
        <div className="mx-auto max-w-6xl px-5 sm:px-6">
          {data.eyebrow && <p className="text-sm font-semibold text-onInkSoft">{field('eyebrow', data.eyebrow)}</p>}
        </div>
      </div>
      <div className="mx-auto -mt-14 max-w-6xl px-5 sm:px-6">
        <div className="rounded-panel border border-rule bg-bg p-7 shadow-slab sm:p-9">
          <h1 className="max-w-3xl font-heading text-4xl font-extrabold leading-[1.05] tracking-[-0.02em] text-ink sm:text-5xl">
            {field('title', data.title)}
          </h1>
          {data.sub && (
            <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-inkSoft sm:text-lg">
              {field('sub', data.sub)}
            </p>
          )}
          {data.cta && (
            <a
              href={data.cta.href}
              className="mt-6 inline-flex items-center gap-2 rounded-control bg-accent px-7 py-3.5 font-semibold text-accentFg transition-transform hover:-translate-y-0.5"
            >
              {data.cta.label}
              <ArrowRight size={16} weight="bold" />
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
