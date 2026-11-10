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
// Service pages (Xander 2026-11-10, service-pages mockup `roofing`): a service with its own page
// is a link to it, the whole row, with "Details" and an arrow in the chevron's column (under the
// description on a phone); a section-only service is a plain row with nothing in that column,
// linked from nowhere. Every row carries id="<slug>". Edit paths use the ORIGINAL services.items
// index, so a blank item ahead of a filled one can't send an edit to the wrong service.
//
// Colours are palette tokens: the resting numeral stroke and chevron are an ink-soft/bg mix
// (the warm mid-grey the hardcoded #93847C was), hover is accent. Content schema-driven.
// ─────────────────────────────────────────────────────────────────────────────
import { ArrowRight } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { serviceRefs } from '@/lib/serviceLinks';

export const meta = {
  id: 'roofing-services',
  category: 'services',
  label: 'Roofing / Ruled-row services',
  consumes: ['services.eyebrow', 'services.title', 'services.sub', 'services.items', 'servicePages'],
  sharedDeps: ['@phosphor-icons/react', '@/lib/editable', '@/lib/serviceLinks'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

export default function RoofingServices({ content = CONTENT }: { content?: SiteContent }) {
  const { services } = content;
  const refs = serviceRefs(content);
  if (!refs.length) return null;

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
          {refs.map((ref, k) => {
            const i = ref.index;
            const item = services.items[i];
            const Row = ref.href ? 'a' : 'div';
            return (
              <Row
                key={ref.slug}
                id={ref.slug}
                {...(ref.href ? { href: ref.href } : {})}
                className={`group grid grid-cols-[56px_1fr] items-start [--rf-stroke:color-mix(in_srgb,var(--ink-soft)_70%,var(--bg))] hover:[--rf-stroke:var(--accent)] gap-x-4 border-b border-rule px-1 py-[22px] transition-[background-color,padding] duration-300 hover:bg-bgSoft md:gap-6 md:px-3 md:py-[30px] md:hover:pl-5 ${
                  ref.href ? 'md:grid-cols-[96px_1fr_1.25fr_auto]' : 'md:grid-cols-[96px_1fr_1.25fr_40px]'
                }`}
              >
                <div
                  className="font-heading text-[32px] font-extrabold leading-[0.9] tracking-[-0.04em] text-transparent md:text-[44px]"
                  style={{ WebkitTextStrokeWidth: '1.5px', WebkitTextStrokeColor: 'var(--rf-stroke)', transition: '-webkit-text-stroke-color .3s' }}
                  aria-hidden="true"
                >
                  {item.n ?? String(k + 1).padStart(2, '0')}
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
                {ref.href && (
                  <span className="col-start-2 mt-3 flex items-center gap-1.5 text-[14px] font-bold text-inkSoft transition-colors duration-300 group-hover:text-accent md:col-start-4 md:mt-0 md:justify-self-end md:pt-1.5">
                    Details
                    <ArrowRight size={16} weight="bold" aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1.5" />
                  </span>
                )}
              </Row>
            );
          })}
        </div>
      </div>
    </section>
  );
}
