'use client';
import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Quotes, Star } from '@phosphor-icons/react';
import { CONTENT } from '@/data/site';

export const meta = {
  id: 'testimonials-carousel',
  category: 'testimonials',
  label: 'Testimonials / Carousel',
  consumes: ['testimonials.eyebrow', 'testimonials.title', 'testimonials.items'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react'],
} as const;

function StarRow({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} size={15} weight={i < count ? 'fill' : 'regular'}
          className={i < count ? 'text-accent' : 'text-rule'} />
      ))}
    </div>
  );
}

export default function TestimonialsCarousel() {
  const reduce = useReducedMotion() ?? false;
  const [index, setIndex] = useState(0);
  if (!CONTENT.testimonials?.items?.length) return null;
  const { testimonials } = CONTENT;
  const { items } = testimonials;
  const t = items[index];
  const initial = t.a.charAt(0).toUpperCase();

  return (
    <section id="testimonials" className="bg-bgSoft px-6 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">{testimonials.eyebrow}</p>
          <h2 className="mt-2 font-heading text-3xl font-bold text-ink">{testimonials.title}</h2>
        </motion.div>

        <div className="mt-10">
          <Quotes size={48} className="mx-auto text-rule" aria-hidden="true" />

          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="mt-4 flex justify-center"><StarRow count={t.stars ?? 5} /></div>
              <p className="mt-5 text-xl italic leading-relaxed text-ink">&ldquo;{t.q}&rdquo;</p>
              <div className="mt-8 flex items-center justify-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-bgSoft text-sm font-semibold text-accent ring-2 ring-rule">
                  {initial}
                </div>
                <div className="text-left">
                  <p className="font-semibold text-ink">{t.a}</p>
                  {(t.r || t.company) && (
                    <p className="text-sm text-inkSoft">{t.r}{t.company ? `, ${t.company}` : ''}</p>
                  )}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {items.length > 1 && (
          <div className="mt-8 flex flex-col items-center gap-5">
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => setIndex((i) => (i - 1 + items.length) % items.length)}
                aria-label="Previous testimonial"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-rule bg-bg text-ink transition-colors hover:bg-bgSoft">
                <ArrowLeft size={18} />
              </button>
              <span className="text-sm text-inkSoft">{index + 1} of {items.length}</span>
              <button type="button" onClick={() => setIndex((i) => (i + 1) % items.length)}
                aria-label="Next testimonial"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-rule bg-bg text-ink transition-colors hover:bg-bgSoft">
                <ArrowRight size={18} />
              </button>
            </div>
            <div className="flex items-center gap-2" role="tablist">
              {items.map((_, i) => (
                <button key={i} type="button" role="tab" aria-selected={i === index} aria-label={`Testimonial ${i + 1}`}
                  onClick={() => setIndex(i)}
                  className={`h-2 rounded-full transition-all duration-200 ${i === index ? 'w-4 bg-accent' : 'w-2 bg-rule hover:bg-inkSoft'}`} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
