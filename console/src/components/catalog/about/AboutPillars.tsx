'use client';
// ─────────────────────────────────────────────────────────────────────────────
// AboutPillars — recomposed as a numbered pillar index (see DESIGN-LANGUAGE.md).
// Full-width numbered pillar rows (big numerals, hairline rules) over a count-up
// stat band. Pillar-led editorial index; distinct from the story split / image
// feature / stat stack.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ShieldCheck, Clock, Tag, Star } from '@phosphor-icons/react';
import { CONTENT } from '@/data/site';
import type { SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { useCountUp } from '@/lib/useCountUp';

export const meta = {
  id: 'about-pillars',
  category: 'about',
  label: 'About / Pillars + stats',
  consumes: ['about.eyebrow', 'about.title', 'about.body', 'about.pillars', 'about.stats'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react', '@/lib/useCountUp'],
} as const;

const ICON_MAP: Record<string, React.ComponentType<{ size?: number | string; className?: string }>> = {
  shield: ShieldCheck,
  clock:  Clock,
  tag:    Tag,
  star:   Star,
};

function StatCell({ n, l, np, lp, run, reduce }: { n: string; l: string; np: string; lp: string; run: boolean; reduce: boolean }) {
  const v = useCountUp(n, run, reduce);
  return (
    <div className="px-8 py-8 text-center">
      <p className="font-heading text-4xl font-bold text-bg"><E p={np} fit>{v}</E></p>
      <p className="mt-1 text-sm text-bg/70"><E p={lp}>{l}</E></p>
    </div>
  );
}

export default function AboutPillars({ content = CONTENT }: { content?: SiteContent }) {
  const reduce = useReducedMotion() ?? false;
  const { about } = content;
  const statsRef = useRef<HTMLDivElement>(null);
  const [statsIn, setStatsIn] = useState(false);

  useEffect(() => {
    const el = statsRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setStatsIn(true); io.disconnect(); } },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (!about.pillars.length) return null;

  return (
    <section id="about" className="bg-bg py-20">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          className="max-w-2xl"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] text-accent">
            <span className="hidden h-px w-8 bg-accent sm:inline-block" />
            <E p="about.eyebrow">{about.eyebrow}</E>
          </p>
          <h2 className="mt-4 font-heading text-4xl font-bold leading-[0.95] tracking-[-0.03em] text-ink md:text-5xl"><E p="about.title">{about.title}</E></h2>
          <p className="mt-4 leading-relaxed text-inkSoft"><E p="about.body">{about.body}</E></p>
        </motion.div>

        {/* Numbered pillar index */}
        <div className="mt-12 border-t border-rule">
          {about.pillars.map((p, i) => {
            const Icon = ICON_MAP[p.k];
            return (
              <motion.div
                key={p.k}
                className="grid grid-cols-[auto_1fr] gap-5 border-b border-rule py-7 sm:gap-8"
                initial={reduce ? false : { opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: i * 0.05 }}
              >
                <span className="font-heading text-4xl font-black leading-none tabular-nums text-ink/20 sm:text-5xl">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <h3 className="flex items-center gap-2 font-heading text-lg font-bold text-ink">
                    {Icon && <Icon size={19} className="text-accent" />}
                    <E p={`about.pillars.${i}.t`}>{p.t}</E>
                  </h3>
                  <p className="mt-2 max-w-2xl leading-relaxed text-inkSoft"><E p={`about.pillars.${i}.d`}>{p.d}</E></p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {about.stats.length > 0 && (
          <div
            ref={statsRef}
            className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-ink/10 md:grid-cols-4"
          >
            {about.stats.map((s, i) => (
              <div key={s.l} className="bg-ink">
                <StatCell n={s.n} l={s.l} np={`about.stats.${i}.n`} lp={`about.stats.${i}.l`} run={statsIn} reduce={reduce} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
