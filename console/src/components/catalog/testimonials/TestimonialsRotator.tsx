'use client';
import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Star } from '@phosphor-icons/react';
import { CONTENT } from '@/data/site';
import type { SiteContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'testimonials-rotator',
  category: 'testimonials',
  label: 'Testimonials / Rotator',
  consumes: ['testimonials.eyebrow', 'testimonials.title', 'testimonials.items'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react'],
} as const;

export default function TestimonialsRotator({ content = CONTENT }: { content?: SiteContent }) {
  const reduce = useReducedMotion() ?? false;
  const { testimonials } = content;
  const [idx, setIdx] = useState(0);
  if (!testimonials.items.length) return null;
  const safeIdx = idx < testimonials.items.length ? idx : 0;
  const t = testimonials.items[safeIdx];

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
          <p className="text-xs font-semibold uppercase tracking-widest text-accent"><E p="testimonials.eyebrow">{testimonials.eyebrow}</E></p>
          <h2 className="mt-2 font-heading text-3xl text-ink"><E p="testimonials.title">{testimonials.title}</E></h2>
        </motion.div>

        {/* Dot nav */}
        <div className="mb-8 flex justify-center gap-2">
          {testimonials.items.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)} aria-label={`Testimonial ${i + 1}`}
              className={`h-2 rounded-full transition-all duration-200 ${
                i === safeIdx ? 'w-6 bg-accent' : 'w-2 bg-rule hover:bg-inkSoft'
              }`} />
          ))}
        </div>

        {/* Quote */}
        <AnimatePresence mode="wait">
          <motion.div
            key={safeIdx}
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
            <p className="text-xl leading-relaxed text-ink">&ldquo;<E p={`testimonials.items.${safeIdx}.q`}>{t.q}</E>&rdquo;</p>
            <div className="mt-6">
              <p className="font-semibold text-ink"><E p={`testimonials.items.${safeIdx}.a`}>{t.a}</E></p>
              <p className="mt-0.5 text-sm text-inkSoft">
                <E p={`testimonials.items.${safeIdx}.r`}>{t.r}</E>{t.company ? <>, <E p={`testimonials.items.${safeIdx}.company`}>{t.company}</E></> : ''}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
