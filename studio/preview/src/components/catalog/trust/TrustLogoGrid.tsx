'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { Star } from '@phosphor-icons/react';
import { CONTENT } from '@/data/site';

export const meta = {
  id: 'trust-credibility-band',
  category: 'trust',
  label: 'Trust / Credibility band',
  consumes: ['trust.label', 'trust.logos', 'extensions.reviewBadge'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react'],
} as const;

export default function TrustLogoGrid() {
  const reduce = useReducedMotion() ?? false;
  const { trust, extensions } = CONTENT;
  const review = extensions.reviewBadge;
  if (!trust.logos.length && !review) return null;

  return (
    <section className="border-y border-rule bg-bg py-10">
      <motion.div
        className="mx-auto grid max-w-6xl gap-8 px-6 lg:grid-cols-[auto_1fr] lg:items-center lg:gap-12"
        initial={reduce ? false : { opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Anchor: rating, or a partner-count statement */}
        <div className="lg:border-r lg:border-rule lg:pr-12">
          {review ? (
            <div className="flex items-center gap-3">
              <p className="font-heading text-4xl font-bold leading-none text-ink">{review.rating}</p>
              <div>
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star key={i} size={14} weight="fill" className={i < Math.round(review.rating) ? 'text-accent' : 'text-rule'} />
                  ))}
                </div>
                <p className="mt-0.5 text-xs text-inkSoft">{review.count}+ verified reviews</p>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-accent">{trust.label}</p>
              <p className="mt-1 font-heading text-2xl font-bold text-ink">
                {trust.logos.length}+ local partners
              </p>
            </div>
          )}
        </div>

        {/* Credential wordmarks separated by hairlines */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          {trust.logos.map((logo, i) => (
            <span
              key={i}
              className={`text-sm font-medium uppercase tracking-wide text-inkSoft ${
                i > 0 ? 'border-l border-rule pl-6' : ''
              }`}
            >
              {logo}
            </span>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
