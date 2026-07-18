'use client';
// ─────────────────────────────────────────────────────────────────────────────
// AboutStatBand — recomposed as an oversized stat stack (see DESIGN-LANGUAGE.md).
// The stats are the centerpiece: huge count-up numerals as hairline-divided rows,
// with the narrative alongside and pillars as an inline chip row. Stats-led;
// distinct from the story split / image feature / pillar index.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ShieldCheck, Clock, Tag, Star } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { useCountUp } from '@/lib/useCountUp';
import { skinClasses, type SkinId } from '@/lib/skins';
import { EASE, viewportOnce, stillFor } from '@/lib/motion';

export const meta = {
  id: 'about-stat-band',
  category: 'about',
  label: 'About / Stat band',
  consumes: ['about.eyebrow', 'about.title', 'about.body', 'about.stats', 'about.pillars'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react', '@/lib/useCountUp', '@/lib/skins', '@/lib/motion'],
  skins: ['contrast', 'editorial'],
} as const;

const ICON_MAP: Record<string, React.ComponentType<{ size?: number | string; className?: string }>> = {
  shield: ShieldCheck,
  clock: Clock,
  tag: Tag,
  star: Star,
};

export default function AboutStatBand({
  content = CONTENT,
  skin = 'contrast',
}: {
  content?: SiteContent;
  skin?: SkinId;
}) {
  const reduce = useReducedMotion() ?? false;
  const still = stillFor(skin, reduce);
  const s = skinClasses(skin);
  const { about } = content;
  const bandRef = useRef<HTMLDivElement>(null);
  const [bandIn, setBandIn] = useState(false);

  useEffect(() => {
    const el = bandRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setBandIn(true); io.disconnect(); } },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const dark = skin === 'contrast';

  return (
    <section id="about" className={`px-6 py-24 ${s.section}`}>
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16 lg:items-start">
        {/* Header + pillars */}
        <motion.div
          className="lg:sticky lg:top-24 lg:self-start"
          initial={still ? false : { opacity: 0, y: 16 }}
          whileInView={still ? undefined : { opacity: 1, y: 0 }}
          viewport={viewportOnce}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <p className={`flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] ${s.eyebrow}`}>
            <span className="hidden h-px w-8 bg-accent sm:inline-block" />
            <E p="about.eyebrow">{about.eyebrow}</E>
          </p>
          <h2 className={`mt-4 font-heading text-4xl font-bold leading-[0.95] tracking-[-0.03em] ${s.heading} md:text-5xl`}><E p="about.title">{about.title}</E></h2>
          <p className={`mt-5 leading-relaxed ${s.body}`}><E p="about.body">{about.body}</E></p>

          {about.pillars.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-3">
              {about.pillars.map((p, i) => {
                const Icon = ICON_MAP[p.k];
                return (
                  <span key={p.k} className={`flex items-center gap-2 text-sm font-medium ${s.heading}`}>
                    {Icon && <Icon size={18} className="text-accent" />}
                    <E p={`about.pillars.${i}.t`}>{p.t}</E>
                  </span>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Oversized stat stack */}
        {about.stats.length > 0 && (
          <div ref={bandRef} className={`border-t ${dark ? 'divide-y divide-ruleInk' : 'divide-y divide-rule'} ${s.rule}`}>
            {about.stats.map((st, i) => (
              <StatRow key={st.l} n={st.n} l={st.l} np={`about.stats.${i}.n`} lp={`about.stats.${i}.l`} run={bandIn && !still} reduce={reduce} idx={i} still={still} s={s} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function StatRow({
  n, l, np, lp, run, reduce, idx, still, s,
}: { n: string; l: string; np: string; lp: string; run: boolean; reduce: boolean; idx: number; still: boolean; s: ReturnType<typeof skinClasses> }) {
  const val = useCountUp(n, run, reduce, idx * 80);
  return (
    <motion.div
      className="flex items-baseline justify-between gap-6 py-6"
      initial={still ? false : { opacity: 0, y: 12 }}
      whileInView={still ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.5 }}
      transition={{ duration: 0.45, ease: EASE, delay: still ? 0 : idx * 0.06 }}
    >
      <p className="font-heading text-5xl font-black leading-none tabular-nums text-accent md:text-6xl"><E p={np} fit>{val}</E></p>
      <p className={`max-w-[42%] text-right text-sm uppercase tracking-wide ${s.body}`}><E p={lp}>{l}</E></p>
    </motion.div>
  );
}
