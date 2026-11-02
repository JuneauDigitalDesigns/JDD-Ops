'use client';
// ─────────────────────────────────────────────────────────────────────────────
// PlumbingTrust — centred service-area section, mirrored 1:1 (#plumbing .area/.chips). Built
// around one oversized "24/7" promise rather than Hvac/RoofingTrust's map-silhouette-plus-list
// treatment, with the town chips centred below it. Reads extensions.serviceArea. Fixed design,
// no skin.
// ─────────────────────────────────────────────────────────────────────────────
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'plumbing-trust',
  category: 'trust',
  label: 'Plumbing / Centred coverage',
  consumes: ['extensions.serviceArea'],
  sharedDeps: ['@/lib/editable'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

export default function PlumbingTrust({ content = CONTENT }: { content?: SiteContent }) {
  const towns = content.extensions.serviceArea ?? [];
  if (!towns.length) return null;

  return (
    <section className="py-[84px] text-center" style={{ background: '#DBE9F2' }}>
      <div className="mx-auto max-w-[760px] px-6">
        <div className="text-[12px] font-bold uppercase tracking-[0.15em] text-accent">Coverage</div>
        <h2 className="mt-3 font-heading text-[clamp(30px,3.6vw,42px)] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink">
          Someone answers, every hour of
        </h2>
        <div className="mt-1.5 font-heading text-[clamp(46px,7vw,78px)] font-extrabold leading-none tracking-[-0.04em] text-accent">
          24/7
        </div>
        <p className="mx-auto mt-[18px] max-w-[52ch] text-[16px] leading-[1.6] text-inkSoft">
          Not on the list? Call — we&apos;ll tell you straight whether we can get to you.
        </p>
        <div className="mt-[34px] flex flex-wrap justify-center gap-[10px]">
          {towns.map((town, i) => (
            <span
              key={town}
              className="rounded-full border border-rule bg-bg px-[18px] py-[10px] text-[14.5px] font-bold text-ink shadow-[0_1px_2px_rgba(16,33,46,0.04)]"
            >
              <E p={`extensions.serviceArea.${i}`}>{town}</E>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
