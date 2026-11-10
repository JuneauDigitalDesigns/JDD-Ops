'use client';
// ─────────────────────────────────────────────────────────────────────────────
// RoofingServices — "structural / weatherproof" services, premium pass (2026-11-09, approved
// mockup). RULED ROWS, not cards — a roofer's offer is a scope list: a two-column head (eyebrow
// with the accent-bar tick + heading / lede), then a hairline-bordered row per service with an
// outlined index numeral, title + uppercase tag, description, and a chevron. On hover the row
// fills bgSoft and indents 8px, and the numeral's stroke and the chevron turn accent (the hover
// the old header promised but never built). Rows arrive one after another (rv-stagger). On a
// phone a row is numeral + copy, the description under the title, no chevron.
//
// Colours are palette tokens: the resting numeral stroke and chevron are an ink-soft/bg mix
// (the warm mid-grey the hardcoded #93847C was), hover is accent. Content schema-driven.
// ─────────────────────────────────────────────────────────────────────────────
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'roofing-services',
  category: 'services',
  label: 'Roofing / Ruled-row services',
  consumes: ['services.eyebrow', 'services.title', 'services.sub', 'services.items'],
  sharedDeps: ['@/lib/editable'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

export default function RoofingServices({ content = CONTENT }: { content?: SiteContent }) {
  const { services } = content;
  const items = services.items.filter((it) => it.t?.trim());
  if (!items.length) return null;

  return (
    <section className="bg-bg py-16 lg:py-24">
      <div className="mx-auto max-w-[1120px] px-5 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-2 lg:items-end lg:gap-12">
          <div>
            {services.eyebrow && (
              <div className="flex items-center gap-2.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-accent">
                <span className="accent-bar !h-[3px] !w-7 !rounded-[2px]" aria-hidden="true" />
                <E p="services.eyebrow">{services.eyebrow}</E>
              </div>
            )}
            <h2 className="mt-4 font-heading text-[clamp(34px,4vw,46px)] font-extrabold leading-[1.02] tracking-[-0.024em] text-ink">
              <E p="services.title">{services.title}</E>
            </h2>
          </div>
          <p className="max-w-[52ch] text-[17px] leading-[1.65] text-inkSoft">
            <E p="services.sub">{services.sub}</E>
          </p>
        </div>

        <div className="rv-stagger mt-10 border-t border-rule lg:mt-12">
          {items.map((item, i) => (
            <div
              key={item.n ?? i}
              className="group grid grid-cols-[56px_1fr] items-start [--rf-stroke:color-mix(in_srgb,var(--ink-soft)_70%,var(--bg))] hover:[--rf-stroke:var(--accent)] gap-x-4 border-b border-rule px-1 py-[22px] transition-[background-color,padding] duration-300 hover:bg-bgSoft md:grid-cols-[96px_1fr_1.25fr_40px] md:gap-6 md:px-3 md:py-[30px] md:hover:pl-5"
            >
              <div
                className="font-heading text-[32px] font-extrabold leading-[0.9] tracking-[-0.04em] text-transparent md:text-[44px]"
                style={{ WebkitTextStrokeWidth: '1.5px', WebkitTextStrokeColor: 'var(--rf-stroke)', transition: '-webkit-text-stroke-color .3s' }}
                aria-hidden="true"
              >
                {item.n ?? String(i + 1).padStart(2, '0')}
              </div>
              <div className="min-w-0">
                <h3 className="font-heading text-[21px] font-extrabold leading-[1.1] tracking-[-0.024em] text-ink md:text-[24px]">
                  <E p={`services.items.${i}.t`}>{item.t}</E>
                </h3>
                {item.tag && (
                  <span className="mt-2 block text-[11.5px] font-bold uppercase tracking-[0.12em] text-accent">
                    <E p={`services.items.${i}.tag`}>{item.tag}</E>
                  </span>
                )}
              </div>
              {item.d?.trim() && (
                <p className="col-start-2 mt-2.5 text-[15px] leading-[1.62] text-inkSoft md:col-start-auto md:mt-0 md:pt-1 md:text-[15.5px]">
                  <E p={`services.items.${i}.d`}>{item.d}</E>
                </p>
              )}
              <svg
                className="hidden shrink-0 justify-self-end pt-2 text-[color:var(--rf-stroke)] transition-[color,transform] duration-300 group-hover:translate-x-1.5 md:block"
                width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
                aria-hidden="true"
              >
                <path d="M9 6l6 6-6 6" />
              </svg>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
