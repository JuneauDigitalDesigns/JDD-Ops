'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { CONTENT } from '@/data/site';

export const meta = {
  id: 'trust-logo-grid',
  category: 'trust',
  label: 'Trust / Logo grid',
  consumes: ['trust.label', 'trust.logos'],
  sharedDeps: ['framer-motion'],
} as const;

export default function TrustLogoGrid() {
  const reduce = useReducedMotion() ?? false;
  const { trust } = CONTENT;
  if (!trust.logos.length) return null;

  return (
    <section className="bg-bg py-14">
      <div className="mx-auto max-w-5xl px-6">
        <p className="mb-8 text-center text-xs font-semibold uppercase tracking-widest text-inkSoft">
          {trust.label}
        </p>
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-7">
          {trust.logos.map((logo, i) => (
            <motion.div
              key={logo}
              className="flex items-center justify-center rounded-lg border border-rule bg-bgSoft px-3 py-3 text-center"
              initial={reduce ? false : { opacity: 0, scale: 0.92 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: i * 0.04 }}
            >
              <span className="text-xs font-medium leading-tight text-inkSoft">{logo}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
