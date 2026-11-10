'use client';
// ─────────────────────────────────────────────────────────────────────────────
// PlumbingStats — inline hairline stat row, premium pass (2026-11-09, approved mockup). Still no
// tiles and no shadows: four columns on the soft band, each separated by a single hairline rule,
// with 44px accent numerals — deliberately quieter than Hvac/RoofingStats. Phone: a 2×2 ledger
// (rules between the pairs and between the rows, none on the outer edge). Reads about.stats;
// returns null when empty. Every colour is a palette token. Fixed design, no skin.
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
    <section className="border-b border-rule bg-bgSoft py-2 sm:py-[18px]">
      <div className="mx-auto grid max-w-[1120px] grid-cols-2 px-5 sm:grid-cols-4 sm:px-6">
        {stats.map((s, i) => (
          <div
            key={s.l || i}
            className={`py-[18px] pr-4 sm:py-2.5 sm:pr-[30px] ${i % 2 === 0 ? 'pl-0' : 'border-l border-rule pl-4'} ${
              i >= 2 ? 'border-t border-rule sm:border-t-0' : ''
            } ${i === 0 ? '' : 'sm:border-l sm:border-rule sm:pl-[30px]'}`}
          >
            <div className="font-heading text-[34px] font-extrabold leading-none tracking-[-0.02em] text-accent tabular-nums sm:text-[44px]">
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
