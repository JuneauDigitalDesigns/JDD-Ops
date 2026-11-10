'use client';
// ─────────────────────────────────────────────────────────────────────────────
// DetailStats — thin hairline strip, premium pass (2026-11-09, approved mockup). Centred champagne
// numerals over tracked-uppercase labels, hairline-bordered top/bottom and between columns — no
// tiles, no background band (unlike every other vertical's stat treatment). On a phone the four
// cells fold into a 2×2 grid whose inner rules follow the fold (no stray left rule on cell 3).
// Reads about.stats. Every colour is a palette token: the label is ink-soft pulled toward bg.
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
      <div className="mx-auto grid max-w-[1120px] grid-cols-2 px-5 py-3 sm:grid-cols-4 sm:px-6 sm:py-[30px]">
        {stats.map((s, i) => (
          <div
            key={s.l || i}
            className={[
              'border-rule px-4 py-[18px] text-center sm:px-3 sm:py-0',
              // 2×2 on a phone: a left rule on the right-hand column, a top rule on the second row.
              i % 2 === 1 ? 'border-l' : '',
              i >= 2 ? 'border-t sm:border-t-0' : '',
              // One row on sm+: a left rule on every cell after the first.
              i > 0 && i % 2 === 0 ? 'sm:border-l' : '',
            ].join(' ')}
          >
            <div className="font-heading text-[34px] font-extrabold leading-none tracking-[-0.016em] text-accent sm:text-[42px]">
              <E p={`about.stats.${i}.n`}>{s.n}</E>
            </div>
            <div
              className="mt-2.5 text-[11px] font-bold uppercase leading-[1.3] tracking-[0.19em]"
              style={{ color: 'color-mix(in srgb, var(--ink-soft) 70%, var(--bg))' }}
            >
              <E p={`about.stats.${i}.l`}>{s.l}</E>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
