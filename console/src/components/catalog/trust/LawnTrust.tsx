'use client';
// ─────────────────────────────────────────────────────────────────────────────
// LawnTrust — "seasonal / organic / airy" coverage section, premium pass (2026-11-09, approved
// mockup). Two-up over the soft green band and its faint repeating MOW-STRIPE field (the one
// graphic motif this template allows): accent eyebrow "Coverage", the hardcoded heading and
// routing lede, the accent phone link, and on the right the town chips (the first carries a
// pin) that tint on hover. Reads extensions.serviceArea + brand phone; empty -> section omitted
// (same as HvacServiceArea). Every colour is a palette token: the band and the stripes are the
// accent mixed into bg / transparency. Fixed design, no skin.
// ─────────────────────────────────────────────────────────────────────────────
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'lawn-trust',
  category: 'trust',
  label: 'Lawn / Mow-stripe coverage',
  consumes: ['extensions.serviceArea', 'brand.phone', 'brand.phoneHref'],
  sharedDeps: ['@/lib/editable'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

export default function LawnTrust({ content = CONTENT }: { content?: SiteContent }) {
  const { brand } = content;
  const towns = content.extensions.serviceArea ?? [];
  if (!towns.length) return null;

  return (
    <section
      className="relative overflow-hidden py-14 lg:py-[92px]"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--accent) 12%, var(--bg))',
        backgroundImage:
          'repeating-linear-gradient(90deg, color-mix(in srgb, var(--accent) 6%, transparent) 0 46px, transparent 46px 92px)',
      }}
    >
      <div className="relative mx-auto grid max-w-[1120px] items-center gap-9 px-5 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:gap-[52px]">
        <div>
          <div className="flex items-center gap-2.5 text-[12px] font-bold uppercase tracking-[0.14em] text-accent">
            <span className="accent-bar !h-[3px] !w-7" aria-hidden="true" />
            Coverage
          </div>
          <h2 className="mt-3.5 font-heading text-[30px] font-extrabold leading-[1.04] tracking-[-0.02em] text-ink lg:text-[36px]">
            Neighbourhoods we mow every week.
          </h2>
          <p className="mt-3.5 max-w-[52ch] text-[17px] leading-[1.65] text-inkSoft">
            We route by neighbourhood, so your crew is already nearby. That's how the same day
            every week actually holds.
          </p>
          <a href={brand.phoneHref} className="mt-[18px] inline-flex items-center gap-2 font-heading text-[17px] font-extrabold text-accent">
            <E p="brand.phone">{brand.phone}</E>
          </a>
        </div>

        <div className="flex flex-wrap gap-2 sm:gap-[10px]">
          {towns.map((town, i) => (
            <span
              key={town}
              className="shadow-brand-1 flex items-center gap-[7px] rounded-[14px] border border-rule bg-bg px-[15px] py-[10px] text-[14.5px] font-bold text-ink transition-[background-color,border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-accent sm:text-[15px]"
            >
              {i === 0 && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="shrink-0 text-accent" aria-hidden="true">
                  <path d="M12 2a7 7 0 00-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 00-7-7z" />
                </svg>
              )}
              <E p={`extensions.serviceArea.${i}`}>{town}</E>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
