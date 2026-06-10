'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { PhoneCall } from '@phosphor-icons/react';
import { CONTENT } from '@/data/site';

export const meta = {
  id: 'finalcta-simple',
  category: 'finalCta',
  label: 'Final CTA / Simple',
  consumes: ['finalCta.eyebrow', 'finalCta.headline', 'finalCta.sub', 'finalCta.cta', 'finalCta.secondary', 'brand.phoneHref'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react'],
} as const;

export default function FinalCtaSimple() {
  const reduce = useReducedMotion() ?? false;
  const { finalCta, brand } = CONTENT;

  return (
    <section id="cta" className="bg-bgSoft py-24 text-center">
      <div className="mx-auto max-w-2xl px-6">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">{finalCta.eyebrow}</p>
          <h2 className="mt-4 font-heading text-4xl text-ink md:text-5xl">{finalCta.headline}</h2>
          <p className="mx-auto mt-5 max-w-lg leading-relaxed text-inkSoft">{finalCta.sub}</p>

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <a
              href="#contact"
              className="inline-block rounded-lg bg-accent px-8 py-4 font-semibold text-accentFg transition-opacity hover:opacity-90"
            >
              {finalCta.cta}
            </a>
          </div>

          {finalCta.secondary && (
            <p className="mt-5 text-inkSoft">
              Or call us directly:{' '}
              <a href={brand.phoneHref} className="inline-flex items-center gap-1 font-semibold text-ink hover:text-accent">
                <PhoneCall size={16} weight="bold" />
                {finalCta.secondary.replace('Call ', '')}
              </a>
            </p>
          )}
        </motion.div>
      </div>
    </section>
  );
}
