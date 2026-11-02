'use client';
// ─────────────────────────────────────────────────────────────────────────────
// PlumbingStats — inline hairline stat row, mirrored 1:1 (#plumbing .statrow). No tiles, no
// shadows: four columns on a soft band, each separated by a single hairline rule — deliberately
// quieter than Hvac/RoofingStats' card treatment. Reads about.stats. Fixed design, no skin.
// ─────────────────────────────────────────────────────────────────────────────
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'plumbing-stats',
  category: 'stats',
  label: 'Plumbing / Inline stat row',
  consumes: ['about.stats'],
  sharedDeps: ['@/lib/editable'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

export default function PlumbingStats({ content = CONTENT }: { content?: SiteContent }) {
  const stats = (content.about.stats ?? []).filter((s) => s.n?.trim());
  if (!stats.length) return null;

  return (
    <section className="bg-bgSoft py-[14px]">
      <div className="mx-auto grid max-w-[1160px] grid-cols-2 gap-y-5 px-6 sm:grid-cols-4 sm:gap-y-0">
        {stats.map((s, i) => (
          <div key={s.l || i} className={`px-[30px] py-2 ${i === 0 ? '' : 'border-l border-rule'} ${i === 0 ? 'pl-0' : ''}`}>
            <div className="font-heading text-[40px] font-extrabold leading-none tracking-[-0.03em] text-accent">
              <E p={`about.stats.${i}.n`}>{s.n}</E>
            </div>
            <div className="mt-[7px] text-[13.5px] font-semibold leading-[1.35] text-inkSoft">
              <E p={`about.stats.${i}.l`}>{s.l}</E>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
