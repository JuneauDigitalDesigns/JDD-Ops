'use client';
import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ShieldCheck, Clock, Tag, Star } from '@phosphor-icons/react';
import { CONTENT } from '@/data/site';
import { useCountUp } from '@/lib/useCountUp';

export const meta = {
  id: 'about-stat-band',
  category: 'about',
  label: 'About / Stat band',
  consumes: ['about.eyebrow', 'about.title', 'about.body', 'about.stats', 'about.pillars'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react', '@/lib/useCountUp'],
} as const;

const ICON_MAP: Record<string, React.ComponentType<{ size?: number | string; className?: string }>> = {
  shield: ShieldCheck,
  clock:  Clock,
  tag:    Tag,
  star:   Star,
};

export default function AboutStatBand() {
  const reduce = useReducedMotion() ?? false;
  const { about } = CONTENT;
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

  return (
    <section id="about" className="bg-bg py-20">
      <div className="mx-auto max-w-6xl px-6">
        {/* Header */}
        <motion.div
          className="max-w-xl"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">{about.eyebrow}</p>
          <h2 className="mt-3 font-heading text-3xl text-ink md:text-4xl">{about.title}</h2>
          <p className="mt-4 leading-relaxed text-inkSoft">{about.body}</p>
        </motion.div>

        {/* Stats band */}
        {about.stats.length > 0 && (
          <div
            ref={bandRef}
            className="mt-12 grid grid-cols-2 overflow-hidden rounded-2xl md:grid-cols-4"
          >
            {about.stats.map((s, i) => (
              <StatCell key={s.l} n={s.n} l={s.l} run={bandIn} reduce={reduce} idx={i} />
            ))}
          </div>
        )}

        {/* Pillars icon row */}
        {about.pillars.length > 0 && (
          <div className="mt-10 flex flex-wrap gap-6">
            {about.pillars.map((p, i) => {
              const Icon = ICON_MAP[p.k];
              return (
                <motion.div
                  key={p.k}
                  className="flex items-center gap-2"
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.5 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: i * 0.06 }}
                >
                  {Icon && <Icon size={18} className="text-accent" />}
                  <span className="text-sm font-medium text-ink">{p.t}</span>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function StatCell({ n, l, run, reduce, idx }: { n: string; l: string; run: boolean; reduce: boolean; idx: number }) {
  const val = useCountUp(n, run, reduce, idx * 80);
  return (
    <div className={`px-8 py-10 text-center ${idx % 2 === 0 ? 'bg-ink' : 'bg-ink/90'}`}>
      <p className="font-heading text-4xl font-bold text-bg">{val}</p>
      <p className="mt-1 text-sm text-bg/70">{l}</p>
    </div>
  );
}
