'use client';
// ─────────────────────────────────────────────────────────────────────────────
// HvacStatBand — Northstar "Home — Standard" stat band, premium pass (2026-11-09, approved mockup).
// Four white cards became ONE hairline ledger on the soft band: an accent-bar cap, then the stats
// on a shared baseline separated by vertical rules, 56px condensed numerals, supporting label.
// Phone: a 2×2 ledger instead of four stacked cards. Reads about.stats; returns null when empty
// (d5-degradation). Every colour is a palette token.
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
    <section className="bg-bgSoft py-10 lg:py-14">
      <div className="mx-auto max-w-[1120px] px-5 sm:px-6">
        <span className="accent-bar !h-1 !w-11 !rounded-b-[4px] !rounded-t-none" aria-hidden="true" />
        <div className="mt-5 grid grid-cols-2 border-y border-rule lg:grid-cols-4">
          {stats.map((s, i) => (
            <div
              key={s.l || i}
              className={`px-4 py-5 lg:px-7 lg:py-[26px] ${
                i % 2 === 0 ? 'pl-0' : 'border-l border-rule'
              } ${i >= 2 ? 'border-t border-rule' : ''} lg:border-t-0 ${i > 0 ? 'lg:border-l lg:border-rule' : ''} ${i === 0 ? '' : 'lg:pl-7'}`}
            >
              <div className="font-heading text-[42px] font-semibold leading-none tracking-[-0.01em] text-ink tabular-nums lg:text-[56px]">
                <E p={`about.stats.${i}.n`}>{s.n}</E>
              </div>
              <div className="mt-2.5 text-[13.5px] font-semibold leading-[1.3] text-inkSoft">
                <E p={`about.stats.${i}.l`}>{s.l}</E>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
