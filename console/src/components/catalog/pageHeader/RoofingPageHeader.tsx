'use client';
// ─────────────────────────────────────────────────────────────────────────────
// RoofingPageHeader — opens Services, About, and Contact. Premium pass (2026-11-09, approved
// mockup's roofing language): the light bgSoft band on a hairline rule stays (roofing's dark
// moments are the hero, ledger, CTA and footer), now with the eyebrow's accent-bar tick, an
// Archivo 800 H1 up to 56px under the faint pitched-roof watermark the coverage section uses,
// and the accent button with the lift-on-hover and accent shadow every roofing button has.
// Copy is per-route: SiteContent.subpages[route].header, passed as `data` by wirePages.
// Colours are palette tokens (bgSoft, rule, ink, ink-soft, accent, ink-panel-2).
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
    <section id="page-header" className="relative overflow-hidden border-b border-rule bg-bgSoft">
      {/* Pitched-roof watermark, bottom-right (same mark as the coverage section) */}
      <svg
        viewBox="0 0 200 140"
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-40px] right-[-60px] w-[440px] max-w-[46%] text-inkPanel2 opacity-[0.06]"
        fill="currentColor"
      >
        <path d="M0 90L60 30l60 60V140H0zM110 90l45-42 45 42v50h-90z" />
      </svg>

      <div className="relative mx-auto max-w-[1120px] px-5 py-12 sm:px-6 lg:py-[72px]">
        {data.eyebrow ? (
          <p className="flex items-center gap-2.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-accent">
            <span className="accent-bar !h-[3px] !w-7 !rounded-[2px]" aria-hidden="true" />
            {field('eyebrow', data.eyebrow)}
          </p>
        ) : null}
        <h1 className="mt-4 max-w-[18ch] text-balance font-heading text-[clamp(36px,4.8vw,56px)] font-extrabold leading-[0.98] tracking-[-0.024em] text-ink">
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
            className="mt-7 inline-flex items-center rounded-[4px] bg-accent px-[22px] py-[14px] text-[16px] font-extrabold text-accentFg transition-[transform,filter] hover:-translate-y-0.5 hover:brightness-105 active:scale-[0.98]"
            style={{ boxShadow: '0 10px 24px -8px color-mix(in srgb, var(--accent) 55%, transparent)' }}
          >
            {data.cta.label}
          </a>
        ) : null}
      </div>
    </section>
  );
}
