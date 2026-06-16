'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { PhoneCall } from '@phosphor-icons/react';
import { CONTENT } from '@/data/site';
import type { SiteContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'finalcta-gradient',
  category: 'finalCta',
  label: 'Final CTA / Gradient',
  consumes: ['finalCta.eyebrow', 'finalCta.headline', 'finalCta.sub', 'finalCta.cta', 'finalCta.secondary', 'brand.phoneHref'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react'],
} as const;

export default function FinalCtaGradient({ content = CONTENT }: { content?: SiteContent }) {
  const reduce = useReducedMotion() ?? false;
  const { finalCta, brand } = content;

  return (
    <section
      id="cta"
      className="relative overflow-hidden py-24 text-center"
      style={{ background: 'linear-gradient(135deg, var(--bg-soft) 0%, color-mix(in srgb, var(--accent) 8%, var(--bg)) 50%, var(--bg-soft) 100%)' }}
    >
      {/* Decorative accent ring */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/5" />

      <div className="relative mx-auto max-w-2xl px-6">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-accent"><E p="finalCta.eyebrow">{finalCta.eyebrow}</E></p>
          <h2 className="mt-4 font-heading text-4xl text-ink md:text-5xl"><E p="finalCta.headline">{finalCta.headline}</E></h2>
          <p className="mx-auto mt-5 max-w-lg leading-relaxed text-inkSoft"><E p="finalCta.sub">{finalCta.sub}</E></p>

          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <a
              href="#contact"
              className="inline-block rounded-lg bg-accent px-8 py-4 font-semibold text-accentFg shadow-lg shadow-accent/25 transition-all hover:opacity-90 hover:shadow-accent/40"
            >
              <E p="finalCta.cta">{finalCta.cta}</E>
            </a>
            {finalCta.secondary && (
              <a
                href={brand.phoneHref}
                className="inline-flex items-center gap-2 rounded-lg border border-rule bg-bg px-8 py-4 font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
              >
                <PhoneCall size={18} weight="bold" />
                <E p="finalCta.secondary">{finalCta.secondary}</E>
              </a>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
