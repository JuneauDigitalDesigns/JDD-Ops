'use client';
import { useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { PhoneCall, CheckCircle } from '@phosphor-icons/react';
import { CONTENT } from '@/data/site';
import type { SiteContent } from '@/data/site';
import { E, useEditing } from '@/lib/editable';

export const meta = {
  id: 'hero-kinetic',
  category: 'hero',
  label: 'Hero / Kinetic',
  consumes: [
    'hero.eyebrow', 'hero.headline', 'hero.sub', 'hero.cta', 'hero.secondaryCta',
    'hero.frictionReducers', 'brand.phoneHref',
  ],
  sharedDeps: ['framer-motion', '@phosphor-icons/react'],
} as const;

export default function HeroKinetic({ content = CONTENT }: { content?: SiteContent }) {
  const reduce = useReducedMotion() ?? false;
  const editing = useEditing();
  const { hero, brand } = content;
  const ref = useRef<HTMLElement>(null);

  const onMove = (e: React.MouseEvent) => {
    if (reduce || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    ref.current.style.setProperty('--mx', `${e.clientX - r.left}px`);
    ref.current.style.setProperty('--my', `${e.clientY - r.top}px`);
  };

  const words = hero.headline.split(' ');
  return (
    <section
      ref={ref}
      onMouseMove={onMove}
      className="relative overflow-hidden bg-ink px-6 py-24 text-center"
      style={{ backgroundImage: 'radial-gradient(400px circle at var(--mx,50%) var(--my,40%), color-mix(in srgb, var(--accent) 28%, transparent), transparent 70%)' }}
    >
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-widest text-accent"><E p="hero.eyebrow">{hero.eyebrow}</E></p>
        <h1 className="mt-4 font-heading text-4xl leading-tight text-bg md:text-6xl">
          {editing ? (
            <E p="hero.headline" fit>{hero.headline}</E>
          ) : (
            <span className="inline-flex flex-wrap justify-center gap-x-3">
              {words.map((w, i) => (
                <motion.span
                  key={`${w}-${i}`}
                  initial={reduce ? false : { opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: i * 0.06 }}
                >
                  {w}
                </motion.span>
              ))}
            </span>
          )}
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-bg/70"><E p="hero.sub">{hero.sub}</E></p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <a href="#cta" className="inline-flex items-center gap-2 rounded-lg bg-accent px-7 py-3.5 font-medium text-accentFg transition-transform hover:-translate-y-0.5">
            <E p="hero.cta">{hero.cta}</E>
          </a>
          {hero.secondaryCta && (
            <a href={brand.phoneHref} className="inline-flex items-center gap-2 rounded-lg border border-bg/25 px-7 py-3.5 font-medium text-bg hover:border-accent hover:text-accent">
              <PhoneCall size={18} weight="bold" /><E p="hero.secondaryCta">{hero.secondaryCta}</E>
            </a>
          )}
        </div>
        {hero.frictionReducers.length > 0 && (
          <div className="mt-6 flex flex-wrap justify-center gap-5">
            {hero.frictionReducers.map((s, i) => (
              <span key={s} className="flex items-center gap-1.5 text-sm text-bg/70">
                <CheckCircle size={14} weight="fill" className="text-accent" /><E p={`hero.frictionReducers.${i}`}>{s}</E>
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
