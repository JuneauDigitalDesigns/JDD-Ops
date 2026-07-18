'use client';
// ─────────────────────────────────────────────────────────────────────────────
// AboutFeature — recomposed as an image-forward split (see DESIGN-LANGUAGE.md).
// A large feature image beside the mission statement + count-up stats. Image-led;
// distinct from the story split / stat stack / pillar index.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { useCountUp } from '@/lib/useCountUp';
import { skinClasses, type SkinId } from '@/lib/skins';
import { EASE, viewportOnce, stillFor } from '@/lib/motion';

export const meta = {
  id: 'about-feature',
  category: 'about',
  label: 'About / Mission-led',
  consumes: ['about.eyebrow', 'about.title', 'about.body', 'about.stats', 'images.about.feature', 'brand.short', 'brand.name'],
  sharedDeps: ['framer-motion', '@/lib/useCountUp', '@/lib/skins', '@/lib/motion'],
  skins: ['editorial', 'contrast', 'quiet'],
} as const;

function StatItem({
  n, l, np, lp, run, reduce, idx, s,
}: { n: string; l: string; np: string; lp: string; run: boolean; reduce: boolean; idx: number; s: ReturnType<typeof skinClasses> }) {
  const v = useCountUp(n, run, reduce, idx * 80);
  return (
    <div>
      <p className="font-heading text-4xl font-black text-accent"><E p={np} fit>{v}</E></p>
      <p className={`mt-1 text-sm ${s.body}`}><E p={lp}>{l}</E></p>
    </div>
  );
}

export default function AboutFeature({
  content = CONTENT,
  skin = 'editorial',
}: {
  content?: SiteContent;
  skin?: SkinId;
}) {
  const reduce = useReducedMotion() ?? false;
  const still = stillFor(skin, reduce);
  const s = skinClasses(skin);
  const { about, images, brand } = content;
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
    <section id="about" className={`px-6 py-24 ${s.section}`}>
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
        {/* Feature image — the dominant element */}
        <motion.div
          className="relative overflow-hidden rounded-[28px]"
          style={{ aspectRatio: '4/3' }}
          initial={still ? false : { opacity: 0, x: -16 }}
          whileInView={still ? undefined : { opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          {img ? (
            <img src={img} alt={`${brand.name} team`} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-accent-grad">
              <div
                className="absolute inset-0 opacity-[0.12]"
                style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)', backgroundSize: '22px 22px' }}
              />
              <span className="absolute -right-4 top-1/2 -translate-y-1/2 font-heading text-[9rem] font-black leading-none text-white/15">
                {brand.short?.[0] ?? brand.name?.[0] ?? '★'}
              </span>
              <span className="absolute left-8 top-1/2 -translate-y-1/2 text-xs uppercase tracking-widest text-white/85">
                {brand.short || brand.name}
              </span>
            </div>
          )}
        </motion.div>

        {/* Mission + count-up stats */}
        <motion.div
          initial={still ? false : { opacity: 0, x: 16 }}
          whileInView={still ? undefined : { opacity: 1, x: 0 }}
          viewport={viewportOnce}
          transition={{ duration: 0.55, ease: EASE, delay: 0.08 }}
        >
          <p className={`flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] ${s.eyebrow}`}>
            <span className="hidden h-px w-8 bg-accent sm:inline-block" />
            <E p="about.eyebrow">{about.eyebrow}</E>
          </p>
          <h2 className={`mt-4 font-heading text-3xl font-bold leading-[1.02] tracking-[-0.02em] ${s.heading} md:text-4xl`}>
            <E p="about.title">{about.title}</E>
          </h2>
          <p className={`mt-5 text-lg leading-relaxed ${s.body}`}><E p="about.body">{about.body}</E></p>

          {about.stats.length > 0 && (
            <div ref={statsRef} className={`mt-10 grid grid-cols-2 gap-6 border-t ${s.rule} pt-8`}>
              {about.stats.map((st, i) => (
                <StatItem key={st.l} n={st.n} l={st.l} np={`about.stats.${i}.n`} lp={`about.stats.${i}.l`} run={statsIn && !still} reduce={reduce} idx={i} s={s} />
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
