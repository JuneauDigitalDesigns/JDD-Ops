'use client';
// ─────────────────────────────────────────────────────────────────────────────
// DetailPageHeader — page opener for Services, About, and Contact. Mirrors HvacPageHeader's
// contract exactly; bg-bgSoft/text-ink/text-accent resolve dark automatically from this
// vertical's VERTICAL_LANGUAGES entry. Copy is per-route: SiteContent.subpages[route].header,
// passed as `data` by wirePages. Fixed design, no skin.
// ─────────────────────────────────────────────────────────────────────────────
import type { PageHeaderContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'detail-page-header',
  category: 'pageHeader',
  label: 'Car Detailing / Page header',
  consumes: ['subpages.*.header'],
  sharedDeps: ['@/lib/editable'],
  signature: false,
  verticalTemplate: true,
} as const;

export default function DetailPageHeader({
  data,
  editPrefix,
}: {
  data: PageHeaderContent;
  editPrefix?: string;
}) {
  const field = (name: string, value: string) =>
    editPrefix ? <E p={`${editPrefix}.${name}`}>{value}</E> : value;

  return (
    <section className="border-b border-rule bg-bgSoft">
      <div className="mx-auto max-w-[1180px] px-6 py-[76px] text-center">
        {data.eyebrow ? (
          <p className="text-[11.5px] font-bold uppercase tracking-[0.26em] text-accent">
            {field('eyebrow', data.eyebrow)}
          </p>
        ) : null}
        <h1 className="mx-auto mt-3.5 max-w-[18ch] font-heading text-[clamp(36px,4.4vw,52px)] font-extrabold leading-[1.0] tracking-[-0.018em] text-ink">
          {field('title', data.title)}
        </h1>
        {data.sub ? (
          <p className="mx-auto mt-4 max-w-[48ch] text-[17px] leading-[1.6] text-inkSoft">
            {field('sub', data.sub)}
          </p>
        ) : null}
        {data.cta ? (
          <a
            href={data.cta.href}
            className="mt-7 inline-flex items-center rounded-[8px] bg-accent px-[22px] py-[14px] text-[16px] font-extrabold text-accentFg"
          >
            {data.cta.label}
          </a>
        ) : null}
      </div>
    </section>
  );
}
