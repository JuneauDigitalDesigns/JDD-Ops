// ─────────────────────────────────────────────────────────────────────────────
// PageHeaderSimple — the lightweight header that opens a non-home page (Services,
// About, Contact, …). Eyebrow + page title + one-line intro + optional CTA on a
// soft band. The single header variant for multi-page sites (v1).
//
// Unlike every other catalog component, this one reads a `data` prop rather than a
// global CONTENT import: each page needs its OWN header, and that copy lives in
// SiteContent.subpages[route].header. In the exported repo the wiring passes
// `data={CONTENT.subpages["<route>"].header}`. In the Studio preview, `editPrefix`
// (e.g. "subpages.services.header") makes the fields inline-editable via <E>.
// ─────────────────────────────────────────────────────────────────────────────
// Types come from '@/data/site' (not '@jdd/schema') so this compiles in a dependency-free
// exported client repo, where '@/data/site' is the inlined SiteContent type source.
import type { PageHeaderContent } from '@/data/site';
import type { SkinId } from '@/lib/skins';
import { E } from '@/lib/editable';
import { ArrowRight } from '@phosphor-icons/react';

export const meta = {
  id: 'page-header-simple',
  category: 'pageHeader',
  label: 'Page header',
  consumes: ['subpages.*.header'],
  sharedDeps: ['@phosphor-icons/react'],
  /** Structural archetype, from src/lib/archetypes.ts. Unique within the category. */
  archetype: 'centered-statement',
  /** True if this component owns a SIGNATURE motion moment (a scroll-linked transform, a pin,
   *  a count-up). Decision 26 budgets these per PAGE, not per section: at most two on a page,
   *  enforced by console/test/page-rhythm.test.mjs. Micro-reveals are free and do not count. */
  signature: false,
} as const;

export default function PageHeaderSimple({
  data,
  editPrefix,
}: {
  data: PageHeaderContent;
  /** Accepted for catalog interface parity; PageHeaderSimple ships skin-less in v1. */
  skin?: SkinId;
  /** When set (Studio preview), fields become inline-editable at `${editPrefix}.<field>`. */
  editPrefix?: string;
}) {
  // Editable in the Studio (editPrefix set), plain text in the exported repo (unset).
  const field = (name: string, value: string) =>
    editPrefix ? <E p={`${editPrefix}.${name}`}>{value}</E> : value;

  return (
    <section id="page-header" className="border-b border-rule bg-bgSoft">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 lg:py-20">
        {data.eyebrow && (
          <p className="font-heading text-xs font-bold uppercase tracking-[0.14em] text-accent">
            {field('eyebrow', data.eyebrow)}
          </p>
        )}
        <h1 className="mt-3 font-heading text-4xl font-extrabold leading-[1.05] tracking-[-0.02em] text-ink sm:text-5xl">
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
            className="mt-7 inline-flex items-center gap-2 rounded-sm bg-accent px-7 py-3.5 font-semibold text-accentFg transition-transform hover:-translate-y-0.5"
          >
            {data.cta.label}
            <ArrowRight size={16} weight="bold" />
          </a>
        )}
      </div>
    </section>
  );
}
