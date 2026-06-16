'use client';
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
          <p className="text-xs font-semibold uppercase tracking-widest text-accent"><E p="about.eyebrow">{about.eyebrow}</E></p>
          <h2 className="mt-3 font-heading text-3xl text-ink md:text-4xl"><E p="about.title">{about.title}</E></h2>
          <p className="mt-4 leading-relaxed text-inkSoft"><E p="about.body">{about.body}</E></p>
        </motion.div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {about.pillars.map((p, i) => {
            const Icon = ICON_MAP[p.k];
            return (
              <motion.div
                key={p.k}
                className="rounded-xl border border-rule bg-bgSoft p-6"
                initial={reduce ? false : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: i * 0.06 }}
              >
                {Icon && (
                  <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                    <Icon size={20} className="text-accent" />
                  </div>
                )}
                <h3 className="font-heading text-base font-semibold text-ink"><E p={`about.pillars.${i}.t`}>{p.t}</E></h3>
                <p className="mt-2 text-sm leading-relaxed text-inkSoft"><E p={`about.pillars.${i}.d`}>{p.d}</E></p>
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
