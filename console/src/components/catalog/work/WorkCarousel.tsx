'use client';
import { useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { skinClasses, type SkinId } from '@/lib/skins';
import { EASE, viewportOnce, stillFor } from '@/lib/motion';

export const meta = {
  id: 'work-carousel',
  category: 'work',
  label: 'Work / Carousel',
  consumes: ['work.eyebrow', 'work.title', 'work.sub', 'work.projects', 'work.hidden'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react', '@/lib/skins', '@/lib/motion'],
  skins: ['editorial', 'quiet'],
} as const;

export default function WorkCarousel({
  content = CONTENT,
  skin = 'editorial',
}: {
  content?: SiteContent;
  skin?: SkinId;
}) {
  const reduce = useReducedMotion() ?? false;
  const still = stillFor(skin, reduce);
  const s = skinClasses(skin);
  const { work } = content;
  const trackRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setProgress(max ? el.scrollLeft / max : 0);
  };

  // 'quiet' disables the smooth-scroll animation on nudge — instant jump instead.
  const nudge = (dir: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * (el.clientWidth * 0.72), behavior: skin === 'quiet' ? 'auto' : 'smooth' });
  };

  if (work.hidden) return null;
  if (!work.projects.length) return null;

  return (
    <section id="work" className={`py-24 ${s.section}`}>
      <div className="mx-auto max-w-6xl px-6">
        {/* Header row */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <motion.div
            initial={still ? false : { opacity: 0, y: 14 }}
            whileInView={still ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${s.eyebrow}`}><E p="work.eyebrow">{work.eyebrow}</E></p>
            <h2 className={`mt-3 font-heading text-3xl font-bold tracking-[-0.01em] ${s.heading} md:text-4xl`}><E p="work.title">{work.title}</E></h2>
            <p className={`mt-2 ${s.body}`}><E p="work.sub">{work.sub}</E></p>
          </motion.div>

          <div className="flex items-center gap-3">
            <button onClick={() => nudge(-1)} aria-label="Previous project"
              className={`flex h-9 w-9 items-center justify-center rounded-full border ${s.rule} ${s.card} ${s.heading} transition-colors hover:border-accent hover:text-accent`}>
              <ArrowLeft size={16} />
            </button>
            <button onClick={() => nudge(1)} aria-label="Next project"
              className={`flex h-9 w-9 items-center justify-center rounded-full border ${s.rule} ${s.card} ${s.heading} transition-colors hover:border-accent hover:text-accent`}>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>

        {/* Track */}
        <div className="mt-9 overflow-hidden">
          <div
            ref={trackRef}
            onScroll={onScroll}
            className="flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4 scrollbar-hide"
            style={{ scrollbarWidth: 'none' }}
          >
            {work.projects.map((p, i) => (
              <motion.article
                key={i}
                className={`group w-[320px] flex-shrink-0 snap-start overflow-hidden rounded-2xl border ${s.cardRule} ${s.card}`}
                initial={still ? false : { opacity: 0, y: 16 }}
                whileInView={still ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.45, ease: EASE, delay: still ? 0 : i * 0.05 }}
              >
                <div className="relative overflow-hidden" style={{ aspectRatio: '4/3' }}>
                  {p.image?.url ? (
                    <img src={p.image.url} alt={p.image.alt} loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="relative flex h-full w-full items-center justify-center bg-accent-grad">
                      <span className="font-heading text-4xl font-black leading-none text-white/25">{String(i + 1).padStart(2, '0')}</span>
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <span className="text-xs font-medium uppercase tracking-wider text-accent"><E p={`work.projects.${i}.scope`}>{p.scope}</E></span>
                  <div className="mt-1 flex items-start justify-between gap-2">
                    <h3 className={`font-heading text-base font-bold leading-snug ${s.heading}`}><E p={`work.projects.${i}.t`}>{p.t}</E></h3>
                    {p.yr && <span className={`shrink-0 text-xs ${s.body}`}><E p={`work.projects.${i}.yr`}>{p.yr}</E></span>}
                  </div>
                  <div className={`mt-3 space-y-1 text-xs ${s.body}`}>
                    <div className="flex gap-2"><span className={`font-medium ${s.heading}`}>Location</span><span><E p={`work.projects.${i}.loc`}>{p.loc}</E></span></div>
                    <div className="flex gap-2"><span className={`font-medium ${s.heading}`}>Size</span><span><E p={`work.projects.${i}.size`}>{p.size}</E></span></div>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        </div>

        {/* Progress bar */}
        <div className={`mt-4 h-0.5 overflow-hidden rounded-full ${skin === 'contrast' ? 'bg-ruleInk' : 'bg-rule'}`}>
          <div className="h-full bg-accent transition-all duration-200" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
    </section>
  );
}
