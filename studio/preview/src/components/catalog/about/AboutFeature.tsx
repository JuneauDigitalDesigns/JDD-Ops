'use client';
import { useEffect, useRef, useState } from 'react';
import { motion, animate, useReducedMotion } from 'framer-motion';
import { CONTENT } from '@/data/site';

export const meta = {
  id: 'about-feature',
  category: 'about',
  label: 'About / Feature image',
  consumes: ['about.eyebrow', 'about.title', 'about.body', 'about.stats', 'images.about.feature'],
  sharedDeps: ['framer-motion'],
} as const;

function useCountUp(target: string, run: boolean, reduce: boolean): string {
  const [val, setVal] = useState(target);
  useEffect(() => {
    if (!run || reduce) { setVal(target); return; }
    const m = target.match(/([^\d.]*)(\d+(?:\.\d+)?)([^\d.].*|$)/);
    if (!m) { setVal(target); return; }
    const [, pre, numStr, post] = m;
    const end = parseFloat(numStr);
    const controls = animate(0, end, {
      duration: 1.2,
      ease: [0.16, 1, 0.3, 1],
      onUpdate(v: number) {
        const fmt = end >= 100 ? Math.round(v).toString() : v.toFixed(numStr.includes('.') ? 1 : 0);
        setVal(`${pre}${fmt}${post}`);
      },
    });
    return () => controls.stop();
  }, [run, target, reduce]);
  return val;
}

function StatItem({ n, l, run, reduce }: { n: string; l: string; run: boolean; reduce: boolean }) {
  const v = useCountUp(n, run, reduce);
  return (
    <div>
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
    <section id="about" className="bg-bgSoft py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          {/* Left: copy + stats */}
          <motion.div
            initial={reduce ? false : { opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-accent">{about.eyebrow}</p>
            <h2 className="mt-3 font-heading text-3xl font-bold text-ink md:text-4xl">{about.title}</h2>
            <p className="mt-4 leading-relaxed text-inkSoft">{about.body}</p>

            {about.stats.length > 0 && (
              <div ref={statsRef} className="mt-8 grid grid-cols-2 gap-6 border-t border-rule pt-8">
                {about.stats.map((s) => (
                  <StatItem key={s.l} n={s.n} l={s.l} run={statsIn} reduce={reduce} />
                ))}
              </div>
            )}
          </motion.div>

          {/* Right: feature image */}
          <motion.div
            className="relative aspect-[4/3] overflow-hidden rounded-2xl"
            initial={reduce ? false : { opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: 0.08 }}
          >
            {img ? (
              <img
                src={img}
                alt={`${CONTENT.brand.name} team`}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-bgSoft bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(0,0,0,0.03)_10px,rgba(0,0,0,0.03)_20px)]">
                <span className="font-sans text-xs uppercase tracking-widest text-inkSoft">Team photo</span>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
