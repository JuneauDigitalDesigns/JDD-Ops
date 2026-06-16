'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { CONTENT } from '@/data/site';
import type { SiteContent } from '@/data/site';
import { E, useEditing } from '@/lib/editable';

export const meta = {
  id: 'hero-slideshow',
  category: 'hero',
  label: 'Hero / Slideshow',
  consumes: ['hero.headline', 'hero.headlineEmphasis', 'hero.sub', 'hero.cta', 'images.hero.slides'],
  sharedDeps: ['framer-motion'],
} as const;

function Headline({ text, emphasis }: { text: string; emphasis: string | null }) {
  if (!emphasis) return <>{text}</>;
  const idx = text.indexOf(emphasis);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span className="text-accent">{emphasis}</span>
      {text.slice(idx + emphasis.length)}
    </>
  );
}

export default function HeroSlideshow({ content = CONTENT }: { content?: SiteContent }) {
  const reduce = useReducedMotion() ?? false;
  const editing = useEditing();
  const { hero, images } = content;
  const slides = images.hero.slides ?? [];
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (reduce || slides.length < 2) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % slides.length), 5000);
    return () => clearInterval(id);
  }, [reduce, slides.length]);

  const current = slides[idx];

  return (
    <section className="relative min-h-[100dvh] overflow-hidden bg-ink">
      {/* Slide background */}
      <AnimatePresence initial={false}>
        {current?.url ? (
          <motion.img
            key={idx}
            src={current.url}
            alt={current.alt}
            className="absolute inset-0 h-full w-full object-cover"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? undefined : { opacity: 0 }}
            transition={{ duration: 0.8 }}
          />
        ) : (
          <div className="absolute inset-0 bg-ink bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(255,255,255,0.02)_10px,rgba(255,255,255,0.02)_20px)]" />
        )}
      </AnimatePresence>

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-ink/60" />

      {/* Content */}
      <div className="relative flex h-full items-center">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-accent"><E p="hero.eyebrow">{hero.eyebrow}</E></p>
            <h1 className="font-heading text-4xl text-bg md:text-5xl lg:text-6xl">
              {editing
                ? <E p="hero.headline" fit>{hero.headline}</E>
                : <Headline text={hero.headline} emphasis={hero.headlineEmphasis} />}
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg text-bg/80"><E p="hero.sub">{hero.sub}</E></p>
            <div className="mt-8">
              <a href="#cta"
                className="inline-block rounded-lg bg-accent px-8 py-4 font-semibold text-accentFg transition-opacity hover:opacity-90">
                <E p="hero.cta">{hero.cta}</E>
              </a>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Dot indicators */}
      {slides.length > 1 && !reduce && (
        <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2">
          {slides.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)} aria-label={`Slide ${i + 1}`}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === idx ? 'w-6 bg-accent' : 'w-1.5 bg-bg/50'}`} />
          ))}
        </div>
      )}
    </section>
  );
}
