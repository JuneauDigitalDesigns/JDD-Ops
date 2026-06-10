'use client';
import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CONTENT } from '@/data/site';
import type { Project } from '@/data/site';

export const meta = {
  id: 'work-horizontal',
  category: 'work',
  label: 'Work / Horizontal showcase',
  consumes: ['work.eyebrow', 'work.title', 'work.sub', 'work.projects', 'work.hidden'],
  sharedDeps: ['framer-motion', 'gsap'],
} as const;

function ProjectCard({ p }: { p: Project }) {
  return (
    <article className="w-[280px] shrink-0 overflow-hidden rounded-2xl border border-rule bg-bg sm:w-[360px]">
      <div className="relative overflow-hidden" style={{ aspectRatio: '4/3' }}>
        {p.image?.url ? (
          <img src={p.image.url} alt={p.image.alt} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-bgSoft bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(0,0,0,0.03)_10px,rgba(0,0,0,0.03)_20px)]">
            <span className="font-sans text-xs uppercase tracking-widest text-inkSoft">{p.caption}</span>
          </div>
        )}
      </div>
      <div className="p-5">
        <span className="text-xs font-medium uppercase tracking-wider text-accent">{p.scope}</span>
        <h3 className="mt-1 font-heading text-base font-semibold text-ink">{p.t}</h3>
        <p className="mt-1 text-xs text-inkSoft">{p.loc}{p.yr ? ` · ${p.yr}` : ''}</p>
      </div>
    </article>
  );
}

export default function WorkMasonry() {
  const reduce = useReducedMotion() ?? false;
  const { work } = CONTENT;
  const wrap = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const hidden = work.hidden || !work.projects.length;

  useEffect(() => {
    if (hidden || reduce || !wrap.current || !track.current) return;
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      const distance = () => track.current!.scrollWidth - window.innerWidth;
      if (distance() <= 0) return;
      gsap.to(track.current, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: wrap.current,
          start: 'top top',
          end: () => `+=${distance()}`,
          pin: true,
          scrub: 1,
          invalidateOnRefresh: true,
        },
      });
    }, wrap);
    return () => ctx.revert();
  }, [hidden, reduce]);

  if (hidden) return null;

  return (
    <section id="work" className="bg-bg">
      <div className="mx-auto max-w-6xl px-6 pt-20">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">{work.eyebrow}</p>
        <h2 className="mt-2 font-heading text-3xl text-ink md:text-4xl">{work.title}</h2>
        {work.sub && <p className="mt-3 max-w-xl text-inkSoft">{work.sub}</p>}
      </div>

      {reduce ? (
        // Reduced motion: a plain horizontal scroll-snap rail (no pin/scrub).
        <div className="mx-auto max-w-6xl overflow-x-auto px-6 py-12" style={{ scrollbarWidth: 'none' }}>
          <div className="flex gap-6" style={{ width: 'max-content' }}>
            {work.projects.map((p, i) => <ProjectCard key={i} p={p} />)}
          </div>
        </div>
      ) : (
        <div ref={wrap} className="relative mt-10 overflow-hidden">
          <div ref={track} className="flex h-[100dvh] items-center gap-6 px-6">
            {work.projects.map((p, i) => <ProjectCard key={i} p={p} />)}
          </div>
        </div>
      )}
    </section>
  );
}
