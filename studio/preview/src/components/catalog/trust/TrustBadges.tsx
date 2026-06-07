'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { SealCheck, Star } from '@phosphor-icons/react';
import { CONTENT } from '@/data/site';

export const meta = {
  id: 'trust-badges',
  category: 'trust',
  label: 'Trust / Badges',
  consumes: ['extensions.trustBadges', 'extensions.reviewBadge'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react'],
} as const;

export default function TrustBadges() {
  const reduce = useReducedMotion() ?? false;
  const { extensions } = CONTENT;
  const badges = extensions.trustBadges;
  const review = extensions.reviewBadge;

  if (!badges?.length && !review) return null;

  return (
    <section className="bg-bgSoft py-10">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-wrap items-center justify-center gap-4">
          {badges?.map((badge, i) => (
            <motion.div
              key={badge}
              className="flex items-center gap-2 rounded-full border border-rule bg-bg px-4 py-2 text-sm font-medium text-ink"
              initial={reduce ? false : { opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: i * 0.05 }}
            >
              <SealCheck size={16} className="text-accent" weight="fill" />
              {badge}
            </motion.div>
          ))}

          {review && (
            <motion.a
              href={review.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-full border border-rule bg-bg px-5 py-2 text-sm font-semibold text-ink transition-colors hover:border-accent"
              initial={reduce ? false : { opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: (badges?.length ?? 0) * 0.05 }}
            >
              <Star size={16} className="text-accent" weight="fill" />
              {review.rating} / 5
              <span className="text-inkSoft font-normal">({review.count} reviews)</span>
            </motion.a>
          )}
        </div>
      </div>
    </section>
  );
}
