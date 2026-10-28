'use client';
// ─────────────────────────────────────────────────────────────────────────────
// LawnTrust — "seasonal / organic / airy" coverage section, mirrored 1:1 (#lawn .area / .tags).
// Two-up over a faint repeating mow-stripe field (the one graphic motif this template allows),
// with pill tags (not roofing's ruled index or HVAC's chip wrap). Reads extensions.serviceArea;
// empty -> section omitted (same as HvacServiceArea). Fixed design, no skin.
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
      className="relative overflow-hidden py-[92px]"
      style={{ backgroundColor: '#E2EDDB', backgroundImage: 'repeating-linear-gradient(90deg, rgba(47,122,51,0.055) 0 46px, transparent 46px 92px)' }}
    >
      <div className="relative mx-auto grid max-w-[1140px] items-center gap-[52px] px-6 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <div className="text-[12px] font-bold uppercase tracking-[0.14em] text-accent">Coverage</div>
          <h2 className="mt-3 font-heading text-[38px] font-extrabold leading-[1.04] tracking-[-0.02em] text-ink">
            Neighbourhoods we mow every week.
          </h2>
          <p className="mt-4 max-w-[48ch] text-[17px] leading-[1.62] text-inkSoft">
            We route by neighbourhood, so your crew is already nearby — that's how the same day
            every week actually holds.
          </p>
          <a href={brand.phoneHref} className="mt-[18px] inline-flex items-center gap-2 font-heading text-[17px] font-extrabold text-accent">
            <E p="brand.phone">{brand.phone}</E>
          </a>
        </div>

        <div className="flex flex-wrap gap-[10px]">
          {towns.map((town, i) => (
            <span
              key={town}
              className="flex items-center gap-2 rounded-full border border-rule bg-bg px-[19px] py-[11px] text-[14.5px] font-bold text-ink"
            >
              {i === 0 && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-accent" aria-hidden="true">
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
