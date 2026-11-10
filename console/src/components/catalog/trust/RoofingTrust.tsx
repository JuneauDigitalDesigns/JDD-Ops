'use client';
// ─────────────────────────────────────────────────────────────────────────────
// RoofingTrust — "structural / weatherproof" coverage section, premium pass (2026-11-09,
// approved mockup). A 4-column RULED town index (not HVAC's chip wrap; 2 columns on a phone)
// under a faint pitched-roof watermark, with the two-column head (eyebrow with the accent-bar
// tick + heading / lede). A town turns accent on hover. Reads extensions.serviceArea; empty ->
// section omitted (same as HvacServiceArea). Copy here is fixed, not schema.
//
// Colours are palette tokens: the band is bgSoft, the watermark ink-panel-2 at 7%, the square
// bullets accent.
// ─────────────────────────────────────────────────────────────────────────────
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'roofing-trust',
  category: 'trust',
  label: 'Roofing / Coverage index',
  consumes: ['extensions.serviceArea'],
  sharedDeps: ['@/lib/editable'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

export default function RoofingTrust({ content = CONTENT }: { content?: SiteContent }) {
  const towns = content.extensions.serviceArea ?? [];
  if (!towns.length) return null;

  return (
    <section className="relative overflow-hidden bg-bgSoft py-14 lg:py-[88px]">
      {/* Pitched-roof watermark, bottom-right */}
      <svg
        viewBox="0 0 200 140"
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-30px] right-[-60px] w-[520px] max-w-[48%] text-inkPanel2 opacity-[0.07]"
        fill="currentColor"
      >
        <path d="M0 90L60 30l60 60V140H0zM110 90l45-42 45 42v50h-90z" />
      </svg>

      <div className="relative mx-auto max-w-[1120px] px-5 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-2 lg:items-end lg:gap-12">
          <div>
            <div className="flex items-center gap-2.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-accent">
              <span className="accent-bar !h-[3px] !w-7 !rounded-[2px]" aria-hidden="true" />
              Coverage
            </div>
            <h2 className="mt-4 font-heading text-[clamp(30px,3.2vw,36px)] font-extrabold leading-[1.02] tracking-[-0.024em] text-ink">
              Where our crews work.
            </h2>
          </div>
          <p className="max-w-[52ch] text-[17px] leading-[1.65] text-inkSoft">
            Outside the list? Call anyway. We travel for full replacements and commercial work.
          </p>
        </div>

        <div className="relative mt-10 grid grid-cols-2 gap-x-5 md:grid-cols-4 md:gap-x-9">
          {towns.map((town, i) => (
            <span
              key={town}
              className="flex min-w-0 items-center gap-[10px] border-b border-rule py-[13px] text-[15px] font-semibold leading-[1.2] text-ink transition-colors duration-200 hover:text-accent md:text-[15.5px]"
            >
              <span className="h-[6px] w-[6px] shrink-0 bg-accent" aria-hidden="true" />
              <E p={`extensions.serviceArea.${i}`}>{town}</E>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
