'use client';
// ─────────────────────────────────────────────────────────────────────────────
// RoofingStats — "structural / weatherproof" stat band, premium pass (2026-11-09, approved
// mockup). Still a dark ledger bar sitting flush against the hero (not HVAC's light ledger):
// four cells, 52px tabular numerals in the emphasis colour, uppercase labels, hairline dividers.
// On a phone it becomes a 2×2 grid with hairlines between the cells. Reads about.stats,
// client-supplied only (D4); empty -> not rendered.
//
// Colours are palette tokens: the bar is ink-panel, numerals var(--accent-2) (the editable
// accent2 slot that replaced the hardcoded amber), labels on-ink-soft, dividers on-ink mixes.
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
  const rule = 'border-[color:color-mix(in_srgb,var(--on-ink)_12%,transparent)]';

  return (
    <section className="-mt-px bg-inkPanel text-onInk">
      <div className="mx-auto max-w-[1120px] px-5 sm:px-6">
        <div className="grid grid-cols-2 py-5 lg:grid-cols-4 lg:py-9">
          {stats.map((s, i) => (
            <div
              key={s.l || i}
              className={`${rule} px-4 py-[18px] lg:px-7 lg:py-0 ${i % 2 === 0 ? 'pl-0' : 'border-l'} ${
                i >= 2 ? 'border-t lg:border-t-0' : ''
              } ${i === 0 ? 'lg:border-l-0 lg:pl-0' : 'lg:border-l lg:pl-7'}`}
            >
              <div className="font-heading text-[38px] font-extrabold leading-none tracking-[-0.03em] text-[color:var(--accent-2)] tabular-nums lg:text-[52px]">
                <E p={`about.stats.${i}.n`}>{s.n}</E>
              </div>
              <div className="mt-2.5 text-[12.5px] font-semibold uppercase leading-[1.3] tracking-[0.07em] text-onInkSoft">
                <E p={`about.stats.${i}.l`}>{s.l}</E>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
