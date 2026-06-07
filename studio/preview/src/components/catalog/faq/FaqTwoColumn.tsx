'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { Question, ArrowRight } from '@phosphor-icons/react';
import { CONTENT } from '@/data/site';

export const meta = {
  id: 'faq-two-column',
  category: 'faq',
  label: 'FAQ / Two-column',
  consumes: ['faq.eyebrow', 'faq.title', 'faq.sub', 'faq.items', 'brand.phone', 'brand.phoneHref'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react'],
} as const;

export default function FaqTwoColumn() {
  const reduce = useReducedMotion() ?? false;
  const { faq, brand } = CONTENT;
  if (!faq.items.length) return null;
  const mid = Math.ceil(faq.items.length / 2);
  const left = faq.items.slice(0, mid);
  const right = faq.items.slice(mid);
  return (
    <section id="faq" className="bg-bg px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">{faq.eyebrow}</p>
          <h2 className="mt-2 font-heading text-3xl font-bold text-ink md:text-4xl">{faq.title}</h2>
          <p className="mt-3 text-inkSoft">{faq.sub}</p>
        </motion.div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {[left, right].map((col, ci) => (
            <div key={ci} className="space-y-5">
              {col.map((f, i) => (
                <motion.div
                  key={i}
                  className="rounded-xl border border-rule bg-bgSoft p-6 transition-all hover:border-accent hover:shadow-sm"
                  initial={reduce ? false : { opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: (ci * mid + i) * 0.04 }}
                >
                  <div className="mb-3 inline-flex rounded-lg bg-bg p-1.5">
                    <Question size={18} className="text-accent" />
                  </div>
                  <p className="font-semibold text-ink">{f.q}</p>
                  <p className="mt-2 leading-relaxed text-inkSoft">{f.a}</p>
                </motion.div>
              ))}
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-rule bg-bgSoft px-6 py-4">
          <p className="text-sm text-inkSoft">Didn&apos;t find your answer?</p>
          <a href={brand.phoneHref} className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
            Call us directly
            <ArrowRight size={14} />
          </a>
        </div>
      </div>
    </section>
  );
}
