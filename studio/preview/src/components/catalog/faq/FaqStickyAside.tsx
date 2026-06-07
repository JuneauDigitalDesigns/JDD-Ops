'use client';
import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Plus, Minus } from '@phosphor-icons/react';
import { CONTENT } from '@/data/site';

export const meta = {
  id: 'faq-sticky-aside',
  category: 'faq',
  label: 'FAQ / Sticky aside',
  consumes: ['faq.eyebrow', 'faq.title', 'faq.sub', 'faq.items', 'brand.phone', 'brand.phoneHref'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react'],
} as const;

export default function FaqStickyAside() {
  const reduce = useReducedMotion() ?? false;
  const { faq, brand } = CONTENT;
  if (!faq.items.length) return null;
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="bg-bg py-20">
      <div className="mx-auto max-w-5xl px-6">
        <div className="grid gap-12 lg:grid-cols-[300px_1fr] lg:items-start">
          {/* Sticky aside */}
          <div className="lg:sticky lg:top-24">
            <p className="text-xs font-semibold uppercase tracking-widest text-accent">{faq.eyebrow}</p>
            <h2 className="mt-3 font-heading text-3xl font-bold text-ink">{faq.title}</h2>
            <p className="mt-4 leading-relaxed text-inkSoft">{faq.sub}</p>
            <a href={brand.phoneHref}
              className="mt-6 inline-block rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-bg transition-opacity hover:opacity-90">
              Call {brand.phone}
            </a>
          </div>

          {/* Accordion */}
          <div className="space-y-2">
            {faq.items.map((item, i) => (
              <div key={i} className="overflow-hidden rounded-xl border border-rule">
                <button
                  type="button"
                  onClick={() => setOpen(open === i ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                  aria-expanded={open === i}
                >
                  <span className="font-heading font-semibold text-ink">{item.q}</span>
                  {open === i
                    ? <Minus size={18} className="shrink-0 text-accent" />
                    : <Plus size={18} className="shrink-0 text-inkSoft" />}
                </button>
                <AnimatePresence initial={false}>
                  {open === i && (
                    <motion.div
                      initial={reduce ? false : { height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={reduce ? undefined : { height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <p className="px-6 pb-5 leading-relaxed text-inkSoft">{item.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
