// ─────────────────────────────────────────────────────────────────────────────
// PageHeaderEditorial — editorial-index page header (see the Phase 5 specimen). The
// service named as an indexed entry with a neutral kicker (decision 10) and a hairline
// under the title. Same {data, editPrefix} contract as PageHeaderSimple so compose-page
// and wirePages construct it the same way; skinless, like every page header in v1.
// ─────────────────────────────────────────────────────────────────────────────
import type { PageHeaderContent } from '@/data/site';
import type { SkinId } from '@/lib/skins';
import { E } from '@/lib/editable';
import { ArrowRight } from '@phosphor-icons/react';

export const meta = {
  id: 'page-header-editorial',
  category: 'pageHeader',
  label: 'Page header / Editorial',
  consumes: ['subpages.*.header'],
  sharedDeps: ['@phosphor-icons/react'],
  /** Structural archetype, from src/lib/archetypes.ts. Unique within the category. */
  archetype: 'editorial-index',
  signature: false,
} as const;

export default function PageHeaderEditorial({
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
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 lg:py-20">
        <div className="flex items-baseline gap-3">
          <span aria-hidden className="font-heading text-sm font-bold tabular-nums text-inkSoft">01</span>
          {data.eyebrow && <span className="text-sm font-semibold text-inkSoft">{field('eyebrow', data.eyebrow)}</span>}
        </div>
        <h1 className="mt-3 max-w-3xl font-heading text-4xl font-extrabold leading-[1.05] tracking-[-0.02em] text-ink sm:text-5xl">
          {field('title', data.title)}
        </h1>
        <hr className="mt-6 border-0 border-t border-rule" />
        {data.sub && (
          <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-inkSoft sm:text-lg">
            {field('sub', data.sub)}
          </p>
        )}
        {data.cta && (
          <a
            href={data.cta.href}
            className="mt-7 inline-flex items-center gap-2 rounded-control bg-accent px-7 py-3.5 font-semibold text-accentFg transition-transform hover:-translate-y-0.5"
          >
            {data.cta.label}
            <ArrowRight size={16} weight="bold" />
          </a>
        )}
      </div>
    </section>
  );
}
