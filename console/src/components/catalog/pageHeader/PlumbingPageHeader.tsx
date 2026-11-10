'use client';
// ─────────────────────────────────────────────────────────────────────────────
// PlumbingPageHeader — page opener for Services, About, and Contact, premium pass (2026-11-09,
// approved mockup's shared language). Mirrors HvacPageHeader's contract with plumbing's pill
// geometry and display type: the soft band with a hairline, the accent eyebrow on its accent-bar,
// the H1, the sub and the pill CTA that lifts on hover. Copy is per-route:
// SiteContent.subpages[route].header, passed as `data` by wirePages; editPrefix keeps the fields
// inline-editable in the Studio. Every colour is a palette token. Fixed design, no skin.
// ─────────────────────────────────────────────────────────────────────────────
import type { PageHeaderContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'plumbing-page-header',
  category: 'pageHeader',
  label: 'Plumbing / Page header',
  consumes: ['subpages.*.header'],
  sharedDeps: ['@/lib/editable'],
  signature: false,
  verticalTemplate: true,
} as const;

export default function PlumbingPageHeader({
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
      <div className="mx-auto max-w-[1120px] px-5 py-12 sm:px-6 lg:py-[72px]">
        {data.eyebrow ? (
          <p className="flex items-center gap-2.5 text-[12px] font-bold uppercase tracking-[0.14em] text-accent">
            <span className="accent-bar !h-[3px] !w-7" aria-hidden="true" />
            {field('eyebrow', data.eyebrow)}
          </p>
        ) : null}
        <h1 className="mt-4 max-w-[18ch] font-heading text-[clamp(36px,4.8vw,56px)] font-extrabold leading-[1.02] tracking-[-0.02em] text-ink">
          {field('title', data.title)}
        </h1>
        {data.sub ? (
          <p className="mt-4 max-w-[48ch] text-[17px] leading-[1.65] text-inkSoft">
            {field('sub', data.sub)}
          </p>
        ) : null}
        {data.cta ? (
          <a
            href={data.cta.href}
            className="mt-7 inline-flex items-center rounded-full bg-accent px-[22px] py-[14px] text-[16px] font-bold text-accentFg transition-[transform,filter] hover:-translate-y-0.5 hover:brightness-105 active:scale-[0.98]"
            style={{ boxShadow: '0 10px 24px -8px color-mix(in srgb, var(--accent) 50%, transparent)' }}
          >
            {data.cta.label}
          </a>
        ) : null}
      </div>
    </section>
  );
}
