'use client';
// ─────────────────────────────────────────────────────────────────────────────
// PlumbingPageHeader — page opener for Services, About, and Contact. Mirrors HvacPageHeader's
// contract exactly, with plumbing's pill geometry and Schibsted Grotesk display type. Copy is
// per-route: SiteContent.subpages[route].header, passed as `data` by wirePages. Fixed design,
// no skin.
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
      <div className="mx-auto max-w-[1160px] px-6 py-[72px]">
        {data.eyebrow ? (
          <p className="text-[12px] font-bold uppercase tracking-[0.15em] text-accent">
            {field('eyebrow', data.eyebrow)}
          </p>
        ) : null}
        <h1 className="mt-3 max-w-[18ch] font-heading text-[clamp(36px,4.4vw,52px)] font-extrabold leading-[1.02] tracking-[-0.02em] text-ink">
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
            className="mt-7 inline-flex items-center rounded-full bg-accent px-[22px] py-[14px] text-[16px] font-bold text-accentFg shadow-[0_10px_22px_-8px_rgba(30,111,168,0.55)] transition-transform hover:-translate-y-0.5"
          >
            {data.cta.label}
          </a>
        ) : null}
      </div>
    </section>
  );
}
