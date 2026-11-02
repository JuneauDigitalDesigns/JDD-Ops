'use client';
// ─────────────────────────────────────────────────────────────────────────────
// HvacStatBand — Northstar "Home — Standard" stat band, mirrored 1:1 (`.statband`).
// A soft band of four white stat tiles sitting below the hero, each with a short steel bar
// capped at the top-left, a large condensed (Oswald) number, and a supporting label. Reads
// about.stats. Fixed design, no skin.
// ─────────────────────────────────────────────────────────────────────────────
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'hvac-stat-band',
  category: 'stats',
  label: 'HVAC / Stat band',
  consumes: ['about.stats'],
  sharedDeps: ['@/lib/editable'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

export default function HvacStatBand({ content = CONTENT }: { content?: SiteContent }) {
  const stats = (content.about.stats ?? []).filter((s) => s.n?.trim());
  if (!stats.length) return null;

  return (
    <section className="bg-[#F4F6F8] py-[56px]">
      <div className="mx-auto grid max-w-[1120px] gap-4 px-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => (
          <div
            key={s.l || i}
            className="relative overflow-hidden rounded-[16px] border border-rule bg-bg px-[22px] py-[26px] shadow-[0_2px_6px_rgba(19,41,63,0.07),0_14px_30px_-12px_rgba(19,41,63,0.22)]"
          >
            <span
              className="absolute left-[24px] top-0 h-1 w-[44px] rounded-b-[4px]"
              style={{ background: 'linear-gradient(90deg,#4A6D96,#1E3A5F)' }}
              aria-hidden="true"
            />
            <div className="font-heading text-[46px] font-bold leading-none tracking-[-0.01em] text-ink">
              <E p={`about.stats.${i}.n`}>{s.n}</E>
            </div>
            <div className="mt-2 text-[13.5px] font-semibold leading-[1.3] text-inkSoft">
              <E p={`about.stats.${i}.l`}>{s.l}</E>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
