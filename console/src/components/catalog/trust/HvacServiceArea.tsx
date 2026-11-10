'use client';
// ─────────────────────────────────────────────────────────────────────────────
// HvacServiceArea — Northstar "Home — Standard" service-area section, premium pass (2026-11-09,
// approved mockup). A steel-tint band with a low-opacity map silhouette bleeding off the right.
// Left: the steel eyebrow, a display heading with a pin, the lede, and the accent phone link.
// Right: a wrap of town chips (first carries a pin) that fill steel-soft on hover; on a phone they
// become a two-column list. Reads extensions.serviceArea + brand phone; returns null with no towns
// (d5-degradation). Every colour is a palette token: the band is --accent-2-soft.
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

export default function HvacServiceArea({ content = CONTENT }: { content?: SiteContent }) {
  const { brand } = content;
  const towns = content.extensions.serviceArea ?? [];
  if (!towns.length) return null;

  return (
    <section id="areas" className="relative overflow-hidden bg-[color:var(--accent-2-soft)] py-14 lg:py-[72px]">
      {/* Map silhouette, bleeding off the right edge */}
      <svg
        viewBox="0 0 200 200"
        aria-hidden="true"
        className="pointer-events-none absolute right-[-40px] top-1/2 w-[560px] max-w-[52%] -translate-y-1/2 text-[color:var(--accent-2)] opacity-[0.10]"
        fill="currentColor"
      >
        <path d="M40 20l30 6 28-10 34 8 26 18-8 30 10 28-20 24-30 6-26-14-28 4-22-20 6-28-14-26 10-28z" />
      </svg>

      <div className="relative mx-auto grid max-w-[1120px] items-center gap-9 px-5 sm:px-6 lg:grid-cols-[1fr_1.25fr] lg:gap-12">
        <div>
          <div className="flex items-center gap-2.5 text-[12px] font-bold uppercase tracking-[0.14em] text-[color:var(--accent-2)]">
            <span className="accent-bar !h-[3px] !w-7" aria-hidden="true" />
            Service area
          </div>
          <h2 className="mt-4 flex items-center gap-3 font-heading text-[30px] font-semibold leading-[1.04] text-ink lg:text-[36px]">
            <MapPin size={28} weight="fill" className="text-accent" aria-hidden="true" />
            Where we work
          </h2>
          <p className="mt-4 max-w-[52ch] text-[17px] leading-[1.65] text-inkSoft">
            Not on the list? Call and ask — we travel for bigger jobs across the region.
          </p>
          <a href={brand.phoneHref} className="mt-4 inline-flex items-center gap-2 font-heading text-[21px] font-semibold text-accent">
            <E p="brand.phone">{brand.phone}</E>
          </a>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-[10px]">
          {towns.map((town, i) => (
            <span
              key={town}
              className="shadow-brand-1 flex items-center gap-[7px] rounded-[10px] border border-rule bg-bg px-[15px] py-[10px] text-[14.5px] font-bold text-ink transition-[background-color,border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-[color:var(--accent-2)] hover:bg-[color:var(--accent-2-soft)] sm:text-[15px]"
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
