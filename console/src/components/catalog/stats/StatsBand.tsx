'use client';
// ─────────────────────────────────────────────────────────────────────────────
// StatsBand — count-up-centerpiece over about.stats (see the Phase 5 specimen 11).
// The ONE component that counts up (decision 18 amends SPEC §9's blanket ban): it sits
// below the fold, so it does not touch LCP the way AboutFeature's old above-the-fold
// count-up did. Figures are NEUTRAL (decision 10). Gated on stillFor: when still it
// renders the final value immediately. signature:true (budgeted per page).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { useCountUp } from '@/lib/useCountUp';
import { skinClasses, type SkinId } from '@/lib/skins';
import { stillFor } from '@/lib/motion';

export const meta = {
  id: 'stats-band',
  category: 'stats',
  label: 'Stats / Band',
  consumes: ['about.stats'],
  sharedDeps: ['framer-motion', '@/lib/useCountUp', '@/lib/skins', '@/lib/motion'],
  skins: ['inverted', 'default'],
  /** Structural archetype, from src/lib/archetypes.ts. Unique within the category. */
  archetype: 'count-up-centerpiece',
  /** The one place SPEC §9's count-up ban is amended (decision 18). Budgeted per PAGE. */
  signature: true,
} as const;

function StatItem({
  n, l, np, lp, run, reduce, idx, s,
}: { n: string; l: string; np: string; lp: string; run: boolean; reduce: boolean; idx: number; s: ReturnType<typeof skinClasses> }) {
  const v = useCountUp(n, run, reduce, idx * 80);
  return (
    <div className="text-center">
      <p className={`font-heading text-4xl font-black leading-none tracking-[-0.02em] md:text-5xl ${s.heading}`}><E p={np} fit>{v}</E></p>
      <p className={`mt-2 text-sm ${s.body}`}><E p={lp}>{l}</E></p>
    </div>
  );
}

export default function StatsBand({
  content = CONTENT,
  skin = 'inverted',
}: {
  content?: SiteContent;
  skin?: SkinId;
}) {
  const reduce = useReducedMotion() ?? false;
  const still = stillFor(skin, reduce);
  const s = skinClasses(skin);
  const stats = content.about?.stats ?? [];
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setInView(true); io.disconnect(); } },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (!stats.length) return null;

  return (
    <section id="stats" className={`py-20 ${s.section}`}>
      <div ref={ref} className="mx-auto grid max-w-5xl grid-cols-2 gap-10 px-6 sm:grid-cols-4">
        {stats.map((st, i) => (
          <StatItem
            key={i}
            n={st.n}
            l={st.l}
            np={`about.stats.${i}.n`}
            lp={`about.stats.${i}.l`}
            run={inView}
            reduce={still}
            idx={i}
            s={s}
          />
        ))}
      </div>
    </section>
  );
}
