'use client';
// ─────────────────────────────────────────────────────────────────────────────
// DetailPageHeader — page opener for Services, About, and Contact, premium pass (2026-11-09,
// approved mockup's type and material). Mirrors HvacPageHeader's contract exactly: centred
// champagne eyebrow with a short gold bar, the 800-weight heading, the sub, and the accent button
// (lifts on hover, accent glow). Copy is per-route: SiteContent.subpages[route].header, passed as
// `data` by wirePages. Every colour is a palette token (bg-soft, ink, accent, rule).
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

const GOLD_BAR = 'linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 65%, black) 60%, transparent)';

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
      <div className="mx-auto max-w-[1120px] px-5 py-14 text-center sm:px-6 sm:py-[76px]">
        {data.eyebrow ? (
          <p className="flex items-center justify-center gap-2.5 text-[11.5px] font-semibold uppercase leading-none tracking-[0.26em] text-accent">
            <span className="h-[3px] w-7 shrink-0 rounded-sm" style={{ background: GOLD_BAR }} aria-hidden="true" />
            {field('eyebrow', data.eyebrow)}
          </p>
        ) : null}
        <h1 className="mx-auto mt-4 max-w-[18ch] font-heading text-[clamp(36px,4.6vw,56px)] font-extrabold leading-[1.0] tracking-[-0.016em] text-ink">
          {field('title', data.title)}
        </h1>
        {data.sub ? (
          <p className="mx-auto mt-4 max-w-[48ch] text-[17px] leading-[1.65] text-inkSoft">
            {field('sub', data.sub)}
          </p>
        ) : null}
        {data.cta ? (
          <a
            href={data.cta.href}
            className="mt-7 inline-flex items-center rounded-[8px] bg-accent px-[22px] py-[14px] font-heading text-[16px] font-extrabold text-accentFg transition-[transform,filter] hover:-translate-y-0.5 hover:brightness-105 active:scale-[0.98]"
            style={{ boxShadow: '0 10px 24px -8px color-mix(in srgb, var(--accent) 55%, transparent)' }}
          >
            {data.cta.label}
          </a>
        ) : null}
      </div>
    </section>
  );
}
