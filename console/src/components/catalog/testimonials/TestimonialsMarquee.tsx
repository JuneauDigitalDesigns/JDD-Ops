'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Star, Quotes } from '@phosphor-icons/react';
import { CONTENT } from '@/data/site';
import type { SiteContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'testimonials-spotlight',
  category: 'testimonials',
  label: 'Testimonials / Spotlight',
  consumes: ['testimonials.eyebrow', 'testimonials.title', 'testimonials.items'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react'],
} as const;

export default function TestimonialsMarquee({ content = CONTENT }: { content?: SiteContent }) {
  const reduce = useReducedMotion() ?? false;
  const { testimonials } = content;
  const items = testimonials.items;
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (reduce || items.length < 2) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % items.length), 6000);
    return () => clearInterval(id);
  }, [reduce, items.length]);

  if (!items.length) return null;
  const safeIdx = idx < items.length ? idx : 0;
  const t = items[safeIdx];

  return (
    <section id="testimonials" className="bg-bgSoft py-24">
      <div className="mx-auto max-w-4xl px-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent"><E p="testimonials.eyebrow">{testimonials.eyebrow}</E></p>
        <h2 className="mt-2 font-heading text-3xl text-ink"><E p="testimonials.title">{testimonials.title}</E></h2>

        <Quotes size={44} weight="fill" className="mx-auto mt-10 text-accent/25" aria-hidden="true" />

        <AnimatePresence mode="wait">
          <motion.blockquote
            key={safeIdx}
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
              &ldquo;<E p={`testimonials.items.${safeIdx}.q`}>{t.q}</E>&rdquo;
            </p>
            <footer className="mt-8">
              <p className="font-semibold text-ink"><E p={`testimonials.items.${safeIdx}.a`}>{t.a}</E></p>
              {(t.r || t.company) && (
                <p className="text-sm text-inkSoft"><E p={`testimonials.items.${safeIdx}.r`}>{t.r}</E>{t.company ? <>, <E p={`testimonials.items.${safeIdx}.company`}>{t.company}</E></> : ''}</p>
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
                className={`h-2 rounded-full transition-all duration-200 ${i === safeIdx ? 'w-6 bg-accent' : 'w-2 bg-rule hover:bg-inkSoft'}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
