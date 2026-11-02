'use client';
// ─────────────────────────────────────────────────────────────────────────────
// HvacPageHeader — Northstar page opener for Services, About, and Contact.
// Same type and measure as the home (Oswald via font-heading, 1120px, orange
// eyebrow). Copy is per-route: SiteContent.subpages[route].header, passed as
// `data` by wirePages. Studio sets editPrefix so the fields stay inline-editable.
// Fixed design, no skin.
// ─────────────────────────────────────────────────────────────────────────────
import type { PageHeaderContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'hvac-page-header',
  category: 'pageHeader',
  label: 'HVAC / Page header',
  consumes: ['subpages.*.header'],
  sharedDeps: ['@/lib/editable'],
  signature: false,
  verticalTemplate: true,
} as const;

const STEEL_BAR = 'linear-gradient(90deg,#8FB2D9,#4A6D96 55%,#1E3A5F)';

export default function HvacPageHeader({
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
      <div className="mx-auto max-w-[1120px] px-6 py-[72px]">
        <div className="h-1 w-[68px] rounded-full" style={{ background: STEEL_BAR }} aria-hidden="true" />
        {data.eyebrow ? (
          <p className="mt-4 text-[12.5px] font-bold uppercase tracking-[0.17em] text-accent">
            {field('eyebrow', data.eyebrow)}
          </p>
        ) : null}
        <h1 className="mt-3 max-w-[18ch] font-heading text-[clamp(36px,4.4vw,52px)] font-semibold leading-[1.04] tracking-[-0.01em] text-ink">
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
            className="mt-7 inline-flex items-center rounded-[10px] bg-accent px-[22px] py-[14px] text-[16px] font-bold text-accentFg shadow-[0_10px_24px_-8px_rgba(224,96,44,0.5)] transition-transform hover:-translate-y-0.5"
          >
            {data.cta.label}
          </a>
        ) : null}
      </div>
    </section>
  );
}
