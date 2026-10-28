'use client';
// ─────────────────────────────────────────────────────────────────────────────
// RoofingStats — "structural / weatherproof" stat band, mirrored 1:1 (#roofing .ledger). A
// dark bitumen ledger bar sitting flush against the hero (not four floating white tiles like
// HVAC's stat band) — four cells, amber numerals, hairline dividers. Reads about.stats,
// client-supplied only (D4); empty -> not rendered.
// ─────────────────────────────────────────────────────────────────────────────
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'roofing-stats',
  category: 'stats',
  label: 'Roofing / Ledger bar',
  consumes: ['about.stats'],
  sharedDeps: ['@/lib/editable'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

export default function RoofingStats({ content = CONTENT }: { content?: SiteContent }) {
  const stats = (content.about.stats ?? []).filter((s) => s.n?.trim());
  if (!stats.length) return null;

  return (
    <section className="-mt-px bg-[#17110F]">
      <div className="mx-auto max-w-[1160px] px-6">
        <div className="grid grid-cols-2 gap-y-6 py-[34px] lg:grid-cols-4 lg:gap-y-0">
          {stats.map((s, i) => (
            <div key={s.l || i} className={`px-7 ${i === 0 ? 'border-l-0 pl-0' : 'border-l border-[rgba(255,255,255,0.1)]'}`}>
              <div className="font-heading text-[42px] font-extrabold leading-none tracking-[-0.03em] text-[#E8A33D]">
                <E p={`about.stats.${i}.n`}>{s.n}</E>
              </div>
              <div className="mt-[9px] text-[12.5px] font-semibold uppercase tracking-[0.07em] text-[#A2938A]">
                <E p={`about.stats.${i}.l`}>{s.l}</E>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
