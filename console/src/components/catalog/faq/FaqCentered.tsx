'use client';
import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { CONTENT } from '@/data/site';
import type { SiteContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'faq-centered',
  category: 'faq',
  label: 'FAQ / Centered',
  consumes: ['faq.eyebrow', 'faq.title', 'faq.sub', 'faq.items'],
  sharedDeps: ['framer-motion'],
} as const;

export default function FaqCentered({ content = CONTENT }: { content?: SiteContent }) {
  const reduce = useReducedMotion() ?? false;
  const { faq } = content;
  if (!faq.items.length) return null;
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="faq" className="bg-bgSoft py-24">
      <div className="mx-auto max-w-3xl px-6">
        <motion.div
          className="text-center"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-accent"><E p="faq.eyebrow">{faq.eyebrow}</E></p>
          <h2 className="mt-3 font-heading text-4xl text-ink"><E p="faq.title">{faq.title}</E></h2>
          <p className="mt-4 text-inkSoft"><E p="faq.sub">{faq.sub}</E></p>
        </motion.div>

        <div className="mt-12 space-y-3">
          {faq.items.map((item, i) => (
            <motion.div
              key={i}
              className="overflow-hidden rounded-2xl bg-bg"
              initial={reduce ? false : { opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: i * 0.04 }}
            >
              <button
                type="button"
                onClick={() => setOpen(open === i ? null : i)}
                className="flex w-full items-start gap-4 px-7 py-6 text-left"
                aria-expanded={open === i}
              >
                <span className="flex-1 font-heading text-lg font-semibold text-ink"><E p={`faq.items.${i}.q`}>{item.q}</E></span>
                <span className={`mt-1 text-xl text-inkSoft transition-transform duration-200 ${open === i ? 'rotate-45' : ''}`}>+</span>
              </button>
              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div
                    initial={reduce ? false : { height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={reduce ? undefined : { height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <p className="px-7 pb-6 leading-relaxed text-inkSoft"><E p={`faq.items.${i}.a`}>{item.a}</E></p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
