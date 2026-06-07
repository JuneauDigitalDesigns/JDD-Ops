'use client';
import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { CONTENT } from '@/data/site';

export const meta = {
  id: 'services-panel',
  category: 'services',
  label: 'Services / Preview panel',
  consumes: ['services.eyebrow', 'services.title', 'services.sub', 'services.items'],
  sharedDeps: ['framer-motion'],
} as const;

export default function ServicesPanel() {
  const reduce = useReducedMotion() ?? false;
  const { services } = CONTENT;
  const [active, setActive] = useState(0);
  if (!services.items.length) return null;

  const current = services.items[active];

  return (
    <section id="services" className="bg-bg py-20">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          className="mb-10 max-w-xl"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">{services.eyebrow}</p>
          <h2 className="mt-2 font-heading text-3xl font-bold text-ink md:text-4xl">{services.title}</h2>
          <p className="mt-3 text-inkSoft">{services.sub}</p>
        </motion.div>

        <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr] lg:items-start">
          {/* Left list */}
          <ul className="space-y-2">
            {services.items.map((item, i) => (
              <li key={item.n}>
                <button
                  type="button"
                  onClick={() => setActive(i)}
                  className={`w-full rounded-xl px-5 py-4 text-left transition-all ${
                    i === active
                      ? 'bg-accent text-bg shadow-md'
                      : 'bg-bgSoft text-ink hover:bg-bgSoft/80'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className={`text-xs font-medium ${i === active ? 'text-bg/70' : 'text-accent'}`}>{item.tag}</span>
                      <p className={`mt-0.5 font-heading font-semibold ${i === active ? 'text-bg' : 'text-ink'}`}>{item.t}</p>
                    </div>
                    <span className={`text-lg ${i === active ? 'text-bg' : 'text-rule'}`}>→</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>

          {/* Right preview */}
          <div className="sticky top-24">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                className="overflow-hidden rounded-2xl bg-bgSoft"
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="relative" style={{ aspectRatio: '4/3' }}>
                  {current.image?.url ? (
                    <img src={current.image.url} alt={current.image.alt} loading="lazy"
                      className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-bgSoft bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(0,0,0,0.03)_10px,rgba(0,0,0,0.03)_20px)]">
                      <span className="font-sans text-xs uppercase tracking-widest text-inkSoft">{current.tag}</span>
                    </div>
                  )}
                </div>
                <div className="p-6">
                  <span className="text-xs font-medium text-accent">{current.tag}</span>
                  <h3 className="mt-1 font-heading text-xl font-bold text-ink">{current.t}</h3>
                  <p className="mt-3 leading-relaxed text-inkSoft">{current.d}</p>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
