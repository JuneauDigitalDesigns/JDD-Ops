'use client';
// ─────────────────────────────────────────────────────────────────────────────
// RoofingTrust — "structural / weatherproof" coverage section, mirrored 1:1 (#roofing .area /
// .towns). A 4-column RULED town index (not HVAC's chip wrap) under a faint pitched-roof
// watermark. Reads extensions.serviceArea; empty -> section omitted (same as HvacServiceArea).
// Fixed design, no skin.
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
    <section className="relative overflow-hidden bg-bgSoft py-[88px]">
      {/* Pitched-roof watermark, bottom-right */}
      <svg
        viewBox="0 0 200 140"
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-30px] right-[-60px] w-[520px] max-w-[48%] text-[#241E1B] opacity-[0.07]"
        fill="currentColor"
      >
        <path d="M0 90L60 30l60 60V140H0zM110 90l45-42 45 42v50h-90z" />
      </svg>

      <div className="relative mx-auto max-w-[1160px] px-6">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-end">
          <div>
            <div className="text-[12px] font-bold uppercase tracking-[0.2em] text-accent">Coverage</div>
            <h2 className="mt-3.5 font-heading text-[38px] font-extrabold leading-[0.98] tracking-[-0.024em] text-ink">
              Where our crews work.
            </h2>
          </div>
          <p className="text-[16px] leading-[1.6] text-inkSoft">
            Outside the list? Call anyway — we travel for full replacements and commercial work.
          </p>
        </div>

        <div className="relative mt-10 grid grid-cols-2 gap-x-9 md:grid-cols-4">
          {towns.map((town, i) => (
            <span key={town} className="flex items-center gap-[10px] border-b border-rule py-[13px] text-[15.5px] font-semibold text-ink">
              <span className="h-[6px] w-[6px] shrink-0 bg-accent" aria-hidden="true" />
              <E p={`extensions.serviceArea.${i}`}>{town}</E>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
