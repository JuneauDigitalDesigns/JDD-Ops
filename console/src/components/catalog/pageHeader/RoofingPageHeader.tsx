'use client';
// ─────────────────────────────────────────────────────────────────────────────
// RoofingPageHeader — opens Services, About, and Contact. Same measure as HvacPageHeader
// (1160px to match this template's own --maxw) with roofing's 4px-radius, no-shadow language:
// a clay eyebrow, no steel accent-bar (roofing has no "bar" motif — hairlines carry it instead).
// Copy is per-route: SiteContent.subpages[route].header, passed as `data` by wirePages. Fixed
// design, no skin.
// ─────────────────────────────────────────────────────────────────────────────
import type { PageHeaderContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'roofing-page-header',
  category: 'pageHeader',
  label: 'Roofing / Page header',
  consumes: ['subpages.*.header'],
  sharedDeps: ['@/lib/editable'],
  signature: false,
  verticalTemplate: true,
} as const;

export default function RoofingPageHeader({
  data,
  editPrefix,
}: {
  data: PageHeaderContent;
  editPrefix?: string;
}) {
  const field = (name: string, value: string) =>
    editPrefix ? <E p={`${editPrefix}.${name}`}>{value}</E> : value;

  return (
    <section id="page-header" className="border-b border-rule bg-bgSoft">
      <div className="mx-auto max-w-[1160px] px-6 py-[72px]">
        {data.eyebrow ? (
          <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-accent">
            {field('eyebrow', data.eyebrow)}
          </p>
        ) : null}
        <h1 className="mt-3 max-w-[18ch] font-heading text-[clamp(36px,4.4vw,52px)] font-extrabold leading-[0.98] tracking-[-0.024em] text-ink">
          {field('title', data.title)}
        </h1>
        {data.sub ? (
          <p className="mt-4 max-w-[48ch] text-[17px] leading-[1.6] text-inkSoft">
            {field('sub', data.sub)}
          </p>
        ) : null}
        {data.cta ? (
          <a
            href={data.cta.href}
            className="mt-7 inline-flex items-center rounded-[4px] bg-accent px-[22px] py-[14px] text-[16px] font-extrabold text-accentFg"
          >
            {data.cta.label}
          </a>
        ) : null}
      </div>
    </section>
  );
}
