'use client';
// ─────────────────────────────────────────────────────────────────────────────
// HvacServiceArea — Northstar "Home — Standard" service-area section, mirrored 1:1 (`.area`).
// A faint brand-tint band with a low-opacity map silhouette bleeding off the right. Left: a
// display heading with a pin, a steel accent-bar, a lede, and an accent phone link. Right: a
// wrap of town chips (first carries a pin). Reads extensions.serviceArea + brand phone.
// Fixed design, no skin.
// ─────────────────────────────────────────────────────────────────────────────
import { MapPin } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'hvac-service-area',
  category: 'trust',
  label: 'HVAC / Service area',
  consumes: ['extensions.serviceArea', 'brand.phone', 'brand.phoneHref'],
  sharedDeps: ['@phosphor-icons/react', '@/lib/editable'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

const STEEL_BAR = 'linear-gradient(90deg,#8FB2D9,#4A6D96 55%,#1E3A5F)';

export default function HvacServiceArea({ content = CONTENT }: { content?: SiteContent }) {
  const { brand } = content;
  const towns = content.extensions.serviceArea ?? [];
  if (!towns.length) return null;

  return (
    <section id="areas" className="relative overflow-hidden bg-[#EAF1F8] py-[84px]">
      {/* Map silhouette, bleeding off the right edge */}
      <svg
        viewBox="0 0 200 200"
        aria-hidden="true"
        className="pointer-events-none absolute right-[-40px] top-1/2 w-[560px] max-w-[52%] -translate-y-1/2 text-[#4A6D96] opacity-[0.10]"
        fill="currentColor"
      >
        <path d="M40 20l30 6 28-10 34 8 26 18-8 30 10 28-20 24-30 6-26-14-28 4-22-20 6-28-14-26 10-28z" />
      </svg>

      <div className="relative mx-auto grid max-w-[1120px] items-center gap-12 px-6 lg:grid-cols-[1fr_1.25fr]">
        <div>
          <h2 className="flex items-center gap-3 font-heading text-[34px] font-semibold leading-[1.04] text-ink">
            <MapPin size={28} weight="fill" className="text-accent" aria-hidden="true" />
            Where we work
          </h2>
          <div className="mt-4 h-1 w-[68px] rounded-full" style={{ background: STEEL_BAR }} aria-hidden="true" />
          <p className="mt-4 max-w-[52ch] text-[17px] leading-[1.65] text-inkSoft">
            Not on the list? Call and ask — we travel for bigger jobs across the region.
          </p>
          <a href={brand.phoneHref} className="mt-4 inline-flex items-center gap-2 font-heading text-[21px] font-semibold text-accent">
            <E p="brand.phone">{brand.phone}</E>
          </a>
        </div>

        <div className="flex flex-wrap gap-[10px]">
          {towns.map((town, i) => (
            <span
              key={town}
              className="flex items-center gap-[7px] rounded-[10px] border border-rule bg-bg px-[15px] py-[10px] text-[15px] font-bold text-ink shadow-[0_1px_2px_rgba(19,41,63,0.06)] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_2px_6px_rgba(19,41,63,0.07),0_14px_30px_-12px_rgba(19,41,63,0.22)]"
            >
              {i === 0 && <MapPin size={14} weight="fill" className="text-accent" aria-hidden="true" />}
              <E p={`extensions.serviceArea.${i}`}>{town}</E>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
