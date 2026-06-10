'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Star, Quotes } from '@phosphor-icons/react';
import { CONTENT } from '@/data/site';

export const meta = {
  id: 'testimonials-spotlight',
  category: 'testimonials',
  label: 'Testimonials / Spotlight',
  consumes: ['testimonials.eyebrow', 'testimonials.title', 'testimonials.items'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react'],
} as const;

export default function TestimonialsMarquee() {
  const reduce = useReducedMotion() ?? false;
  const { testimonials } = CONTENT;
  const items = testimonials.items;
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (reduce || items.length < 2) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % items.length), 6000);
    return () => clearInterval(id);
  }, [reduce, items.length]);

  if (!items.length) return null;
  const t = items[idx] ?? items[0];

  return (
    <section id="testimonials" className="bg-bgSoft py-24">
      <div className="mx-auto max-w-4xl px-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">{testimonials.eyebrow}</p>
        <h2 className="mt-2 font-heading text-3xl text-ink">{testimonials.title}</h2>

        <Quotes size={44} weight="fill" className="mx-auto mt-10 text-accent/25" aria-hidden="true" />

        <AnimatePresence mode="wait">
          <motion.blockquote
            key={idx}
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -10 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="mt-4 flex justify-center gap-0.5">
              {Array.from({ length: 5 }, (_, i) => (
                <Star key={i} size={18} weight="fill" className={i < (t.stars ?? 5) ? 'text-accent' : 'text-rule'} />
              ))}
            </div>
            <p className="mx-auto mt-6 max-w-3xl font-heading text-2xl leading-snug text-ink md:text-3xl">
              &ldquo;{t.q}&rdquo;
            </p>
            <footer className="mt-8">
              <p className="font-semibold text-ink">{t.a}</p>
              {(t.r || t.company) && (
                <p className="text-sm text-inkSoft">{t.r}{t.company ? `, ${t.company}` : ''}</p>
              )}
            </footer>
          </motion.blockquote>
        </AnimatePresence>

        {items.length > 1 && (
          <div className="mt-10 flex justify-center gap-2">
            {items.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIdx(i)}
                aria-label={`Testimonial ${i + 1}`}
                className={`h-2 rounded-full transition-all duration-200 ${i === idx ? 'w-6 bg-accent' : 'w-2 bg-rule hover:bg-inkSoft'}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
