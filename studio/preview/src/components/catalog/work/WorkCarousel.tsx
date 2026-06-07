'use client';
import { useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight } from '@phosphor-icons/react';
import { CONTENT } from '@/data/site';

export const meta = {
  id: 'work-carousel',
  category: 'work',
  label: 'Work / Carousel',
  consumes: ['work.eyebrow', 'work.title', 'work.sub', 'work.projects', 'work.hidden'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react'],
} as const;

export default function WorkCarousel() {
  const reduce = useReducedMotion() ?? false;
  const { work } = CONTENT;
  if (work.hidden) return null;
  if (!work.projects.length) return null;

  const trackRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [active, setActive] = useState(0);

  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setProgress(max ? el.scrollLeft / max : 0);
    const card = el.firstElementChild as HTMLElement | null;
    const w = card?.getBoundingClientRect().width ?? 1;
    setActive(Math.round(el.scrollLeft / (w + 24)));
  };

  const nudge = (dir: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * (el.clientWidth * 0.72), behavior: 'smooth' });
  };

  return (
    <section id="work" className="bg-bgSoft py-20">
      <div className="mx-auto max-w-6xl px-6">
        {/* Header row */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-accent">{work.eyebrow}</p>
            <h2 className="mt-2 font-heading text-3xl font-bold text-ink md:text-4xl">{work.title}</h2>
            <p className="mt-2 text-inkSoft">{work.sub}</p>
          </motion.div>

          <div className="flex items-center gap-3">
            <span className="font-heading text-sm text-inkSoft">
              {String(active + 1).padStart(2, '0')} / {String(work.projects.length).padStart(2, '0')}
            </span>
            <button onClick={() => nudge(-1)} aria-label="Previous project"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-rule bg-bg text-ink transition-colors hover:border-accent hover:text-accent">
              <ArrowLeft size={16} />
            </button>
            <button onClick={() => nudge(1)} aria-label="Next project"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-rule bg-bg text-ink transition-colors hover:border-accent hover:text-accent">
              <ArrowRight size={16} />
            </button>
          </div>
        </div>

        {/* Track */}
        <div className="mt-8 overflow-hidden">
          <div
            ref={trackRef}
            onScroll={onScroll}
            className="flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4 scrollbar-hide"
            style={{ scrollbarWidth: 'none' }}
          >
            {work.projects.map((p, i) => (
              <motion.article
                key={i}
                className="group w-[320px] flex-shrink-0 snap-start overflow-hidden rounded-xl bg-bg"
                initial={reduce ? false : { opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: i * 0.05 }}
              >
                <div className="relative overflow-hidden" style={{ aspectRatio: '4/3' }}>
                  {p.image?.url ? (
                    <img src={p.image.url} alt={p.image.alt} loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-bgSoft bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(0,0,0,0.03)_10px,rgba(0,0,0,0.03)_20px)]">
                      <span className="font-sans text-xs uppercase tracking-widest text-inkSoft">{p.caption}</span>
                    </div>
                  )}
                  <div className="absolute left-3 top-3">
                    <span className="rounded-full bg-ink/70 px-2.5 py-1 text-xs font-medium text-bg backdrop-blur-sm">{p.scope}</span>
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-heading text-base font-semibold leading-snug text-ink">{p.t}</h3>
                    {p.yr && <span className="shrink-0 text-xs text-inkSoft">{p.yr}</span>}
                  </div>
                  <div className="mt-3 space-y-1 text-xs text-inkSoft">
                    <div className="flex gap-2"><span className="font-medium text-ink">Location</span><span>{p.loc}</span></div>
                    <div className="flex gap-2"><span className="font-medium text-ink">Size</span><span>{p.size}</span></div>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-0.5 overflow-hidden rounded-full bg-rule">
          <div className="h-full bg-accent transition-all duration-200" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
    </section>
  );
}
