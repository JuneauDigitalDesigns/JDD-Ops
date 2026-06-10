'use client';
import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Star } from '@phosphor-icons/react';
import { CONTENT } from '@/data/site';

export const meta = {
  id: 'testimonials-rotator',
  category: 'testimonials',
  label: 'Testimonials / Rotator',
  consumes: ['testimonials.eyebrow', 'testimonials.title', 'testimonials.items'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react'],
} as const;

export default function TestimonialsRotator() {
  const reduce = useReducedMotion() ?? false;
  const { testimonials } = CONTENT;
  if (!testimonials.items.length) return null;
  const [idx, setIdx] = useState(0);
  const t = testimonials.items[idx];

  return (
    <section id="testimonials" className="bg-bg py-20">
      <div className="mx-auto max-w-3xl px-6">
        <motion.div
          className="mb-10 text-center"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">{testimonials.eyebrow}</p>
          <h2 className="mt-2 font-heading text-3xl text-ink">{testimonials.title}</h2>
        </motion.div>

        {/* Dot nav */}
        <div className="mb-8 flex justify-center gap-2">
          {testimonials.items.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)} aria-label={`Testimonial ${i + 1}`}
              className={`h-2 rounded-full transition-all duration-200 ${
                i === idx ? 'w-6 bg-accent' : 'w-2 bg-rule hover:bg-inkSoft'
              }`} />
          ))}
        </div>

        {/* Quote */}
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            className="text-center"
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex justify-center gap-0.5 mb-5">
              {Array.from({ length: 5 }, (_, i) => (
                <Star key={i} size={18} weight={i < t.stars ? 'fill' : 'regular'}
                  className={i < t.stars ? 'text-accent' : 'text-rule'} />
              ))}
            </div>
            <p className="text-xl leading-relaxed text-ink">&ldquo;{t.q}&rdquo;</p>
            <div className="mt-6">
              <p className="font-semibold text-ink">{t.a}</p>
              <p className="mt-0.5 text-sm text-inkSoft">
                {t.r}{t.company ? `, ${t.company}` : ''}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
