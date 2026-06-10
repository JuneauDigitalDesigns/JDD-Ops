'use client';
import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CONTENT } from '@/data/site';
import { useCountUp } from '@/lib/useCountUp';

export const meta = {
  id: 'about-feature',
  category: 'about',
  label: 'About / Mission-led',
  consumes: ['about.eyebrow', 'about.title', 'about.body', 'about.stats', 'images.about.feature'],
  sharedDeps: ['framer-motion', '@/lib/useCountUp'],
} as const;

function StatItem({ n, l, run, reduce, idx }: { n: string; l: string; run: boolean; reduce: boolean; idx: number }) {
  const v = useCountUp(n, run, reduce, idx * 80);
  return (
    <div className="text-center">
      <p className="font-heading text-3xl font-bold text-accent">{v}</p>
      <p className="mt-0.5 text-sm text-inkSoft">{l}</p>
    </div>
  );
}

export default function AboutFeature() {
  const reduce = useReducedMotion() ?? false;
  const { about, images } = CONTENT;
  const statsRef = useRef<HTMLDivElement>(null);
  const [statsIn, setStatsIn] = useState(false);
  const img = images.about.feature;

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

  return (
    <section id="about" className="bg-bgSoft py-24">
      <div className="mx-auto max-w-5xl px-6">
        {/* Mission statement centerpiece */}
        <motion.div
          className="text-center"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">{about.eyebrow}</p>
          <h2 className="mx-auto mt-6 max-w-3xl font-heading text-2xl leading-snug text-ink md:text-3xl lg:text-4xl">
            {about.title}
          </h2>
          <p className="mx-auto mt-5 max-w-2xl leading-relaxed text-inkSoft">{about.body}</p>
        </motion.div>

        {/* Supporting image */}
        <motion.div
          className="mt-12 overflow-hidden rounded-3xl bg-bg"
          initial={reduce ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.08 }}
        >
          {img ? (
            <img
              src={img}
              alt={`${CONTENT.brand.name} team`}
              loading="lazy"
              className="h-full w-full object-cover"
              style={{ aspectRatio: '16/7' }}
            />
          ) : (
            <div
              className="flex w-full items-center justify-center bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(0,0,0,0.03)_10px,rgba(0,0,0,0.03)_20px)]"
              style={{ aspectRatio: '16/7' }}
            >
              <span className="font-sans text-xs uppercase tracking-widest text-inkSoft">Team photo</span>
            </div>
          )}
        </motion.div>

        {/* Stats row */}
        {about.stats.length > 0 && (
          <div ref={statsRef} className="mt-12 grid grid-cols-2 gap-6 sm:grid-cols-4">
            {about.stats.map((s, i) => (
              <StatItem key={s.l} n={s.n} l={s.l} run={statsIn} reduce={reduce} idx={i} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
