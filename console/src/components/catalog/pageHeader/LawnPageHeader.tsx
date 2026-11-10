'use client';
// ─────────────────────────────────────────────────────────────────────────────
// LawnPageHeader — opens Services, About, and Contact, premium pass (2026-11-09, approved
// mockup). The thin soft band became a FOREST band (ink-panel-2 → ink-panel) with a faint sun
// glow: sun eyebrow with a short accent-bar, a display H1 up to 60px, the sub, and the accent
// CTA — the inner pages open on the same forest the home hero and final CTA use. Copy is
// per-route: SiteContent.subpages[route].header, passed as `data` by wirePages; Studio sets
// editPrefix so the fields stay inline-editable. Every colour is a palette token (the sun is the
// editable accent2 slot). Fixed design, no skin.
// ─────────────────────────────────────────────────────────────────────────────
import type { PageHeaderContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'lawn-page-header',
  category: 'pageHeader',
  label: 'Lawn / Page header',
  consumes: ['subpages.*.header'],
  sharedDeps: ['@/lib/editable'],
  signature: false,
  verticalTemplate: true,
} as const;

export default function LawnPageHeader({
  data,
  editPrefix,
}: {
  data: PageHeaderContent;
  editPrefix?: string;
}) {
  const field = (name: string, value: string) =>
    editPrefix ? <E p={`${editPrefix}.${name}`}>{value}</E> : value;

  return (
    <section
      id="page-header"
      className="relative isolate overflow-hidden bg-inkPanel text-onInk"
      style={{
        background:
          'radial-gradient(900px 300px at 85% -10%, color-mix(in srgb, var(--accent-2) 12%, transparent), transparent 60%),' +
          'linear-gradient(180deg, var(--ink-panel-2), var(--ink-panel))',
      }}
    >
      <div className="mx-auto max-w-[1120px] px-5 py-12 sm:px-6 lg:py-[72px]">
        {data.eyebrow ? (
          <p className="flex items-center gap-2.5 text-[12px] font-bold uppercase tracking-[0.14em] text-[color:var(--accent-2)]">
            <span className="accent-bar !h-[3px] !w-7" aria-hidden="true" />
            {field('eyebrow', data.eyebrow)}
          </p>
        ) : null}
        <h1 className="mt-4 max-w-[18ch] font-heading text-[clamp(38px,4.8vw,60px)] font-extrabold leading-[1.02] tracking-[-0.02em] text-onInk">
          {field('title', data.title)}
        </h1>
        {data.sub ? (
          <p className="mt-4 max-w-[48ch] text-[17px] leading-[1.6] text-onInkSoft">
            {field('sub', data.sub)}
          </p>
        ) : null}
        {data.cta ? (
          <a
            href={data.cta.href}
            className="mt-7 inline-flex items-center rounded-[14px] bg-accent px-[22px] py-[14px] text-[16px] font-bold text-accentFg transition-[transform,filter] hover:-translate-y-0.5 hover:brightness-105 active:scale-[0.98]"
            style={{ boxShadow: '0 10px 24px -8px color-mix(in srgb, var(--accent) 55%, transparent)' }}
          >
            {data.cta.label}
          </a>
        ) : null}
      </div>
    </section>
  );
}
