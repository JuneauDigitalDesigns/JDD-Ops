'use client';
// ─────────────────────────────────────────────────────────────────────────────
// DetailStats — thin hairline strip, mirrored 1:1 (#detail .strip). Centred gold numerals over
// tracked-uppercase labels, hairline-bordered top/bottom and between columns — no tiles, no
// background band (unlike every other vertical's stat treatment). Reads about.stats. Fixed
// design, no skin.
// ─────────────────────────────────────────────────────────────────────────────
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'detail-stats',
  category: 'stats',
  label: 'Car Detailing / Hairline strip',
  consumes: ['about.stats'],
  sharedDeps: ['@/lib/editable'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

export default function DetailStats({ content = CONTENT }: { content?: SiteContent }) {
  const stats = (content.about.stats ?? []).filter((s) => s.n?.trim());
  if (!stats.length) return null;

  return (
    <section className="border-y border-rule">
      <div className="mx-auto grid max-w-[1180px] grid-cols-2 gap-y-7 px-6 py-[30px] sm:grid-cols-4 sm:gap-y-0">
        {stats.map((s, i) => (
          <div key={s.l || i} className={`text-center ${i === 0 ? '' : 'border-l border-rule'}`}>
            <div className="font-heading text-[38px] font-extrabold leading-none tracking-[-0.03em] text-accent">
              <E p={`about.stats.${i}.n`}>{s.n}</E>
            </div>
            <div className="mt-2.5 text-[11px] font-bold uppercase tracking-[0.19em]" style={{ color: '#6C7686' }}>
              <E p={`about.stats.${i}.l`}>{s.l}</E>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
