'use client';
import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { PhoneCall, CaretRight } from '@phosphor-icons/react';
import { CONTENT } from '@/data/site';
import type { SiteContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'faq-two-pane',
  category: 'faq',
  label: 'FAQ / Two-pane',
  consumes: ['faq.eyebrow', 'faq.title', 'faq.sub', 'faq.items', 'brand.phone', 'brand.phoneHref'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react'],
} as const;

export default function FaqStickyAside({ content = CONTENT }: { content?: SiteContent }) {
  const reduce = useReducedMotion() ?? false;
  const { faq, brand } = content;
  const [active, setActive] = useState(0);
  if (!faq.items.length) return null;
  const current = faq.items[active];

  return (
    <section id="faq" className="bg-bg py-20">
      <div className="mx-auto max-w-5xl px-6">
        <motion.div
          className="max-w-xl"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-accent"><E p="faq.eyebrow">{faq.eyebrow}</E></p>
          <h2 className="mt-2 font-heading text-3xl text-ink md:text-4xl"><E p="faq.title">{faq.title}</E></h2>
          <p className="mt-3 text-inkSoft"><E p="faq.sub">{faq.sub}</E></p>
        </motion.div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-start">
          {/* Left: question list */}
          <ul className="space-y-1">
            {faq.items.map((f, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => setActive(i)}
                  aria-expanded={active === i}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl px-5 py-4 text-left transition-colors ${
                    i === active ? 'bg-bgSoft text-ink' : 'text-inkSoft hover:bg-bgSoft/60'
                  }`}
                >
                  <span className="font-heading text-sm font-semibold">{f.q}</span>
                  <CaretRight
                    size={16}
                    className={`shrink-0 transition-transform ${i === active ? 'translate-x-0 text-accent' : '-translate-x-1 text-rule'}`}
                  />
                </button>
              </li>
            ))}
          </ul>

          {/* Right: answer pane */}
          <div className="lg:sticky lg:top-24">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                className="rounded-2xl border border-rule bg-bgSoft p-8"
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              >
                <h3 className="font-heading text-xl font-semibold text-ink"><E p={`faq.items.${active}.q`}>{current.q}</E></h3>
                <p className="mt-3 leading-relaxed text-inkSoft"><E p={`faq.items.${active}.a`}>{current.a}</E></p>
                <a
                  href={brand.phoneHref}
                  className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline"
                >
                  <PhoneCall size={15} weight="bold" />
                  Still unsure? Call <E p="brand.phone">{brand.phone}</E>
                </a>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
