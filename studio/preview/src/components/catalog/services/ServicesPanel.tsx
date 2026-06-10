'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from '@phosphor-icons/react';
import { CONTENT } from '@/data/site';

export const meta = {
  id: 'services-bento',
  category: 'services',
  label: 'Services / Bento',
  consumes: ['services.eyebrow', 'services.title', 'services.sub', 'services.items'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react'],
} as const;

export default function ServicesPanel() {
  const reduce = useReducedMotion() ?? false;
  const { services } = CONTENT;
  const items = services.items;
  if (!items.length) return null;

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
          <h2 className="mt-2 font-heading text-3xl text-ink md:text-4xl">{services.title}</h2>
          <p className="mt-3 text-inkSoft">{services.sub}</p>
        </motion.div>

        {/* Bento: item 0 is the feature; a trailing odd item also goes full-width so the
            grid never has an empty cell. */}
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((item, i) => {
            const feature = i === 0;
            const lastOdd = i === items.length - 1 && (items.length - 1) % 2 === 1;
            const wide = feature || lastOdd;
            return (
              <motion.article
                key={item.n}
                className={`group relative isolate flex flex-col justify-end overflow-hidden rounded-2xl ${
                  wide ? 'sm:col-span-2' : ''
                } ${feature ? 'min-h-[300px]' : 'min-h-[210px]'}`}
                initial={reduce ? false : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: i * 0.06 }}
              >
                {/* Base + image + legibility gradient */}
                <div className="absolute inset-0 -z-10 bg-ink" />
                {item.image?.url && (
                  <img
                    src={item.image.url}
                    alt={item.image.alt}
                    loading="lazy"
                    className="absolute inset-0 -z-10 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                )}
                <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink/90 via-ink/45 to-ink/10" />

                <div className="p-6">
                  <span className="text-xs font-semibold uppercase tracking-wider text-bg/70">{item.tag}</span>
                  <h3 className={`mt-1 font-heading font-semibold text-bg ${feature ? 'text-2xl' : 'text-lg'}`}>
                    {item.t}
                  </h3>
                  {feature && <p className="mt-2 max-w-md text-sm leading-relaxed text-bg/80">{item.d}</p>}
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-bg/90">
                    Learn more
                    <ArrowRight size={14} className="transition-transform duration-150 group-hover:translate-x-0.5" />
                  </span>
                </div>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
