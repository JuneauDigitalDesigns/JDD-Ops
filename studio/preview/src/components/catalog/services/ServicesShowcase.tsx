'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { CONTENT } from '@/data/site';

export const meta = {
  id: 'services-showcase',
  category: 'services',
  label: 'Services / Showcase',
  consumes: ['services.eyebrow', 'services.title', 'services.sub', 'services.items'],
  sharedDeps: ['framer-motion'],
} as const;

export default function ServicesShowcase() {
  const reduce = useReducedMotion() ?? false;
  const { services } = CONTENT;
  if (!services.items.length) return null;

  return (
    <section id="services" className="bg-bgSoft py-20">
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

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {services.items.map((item, i) => (
            <motion.article
              key={item.n}
              className="group overflow-hidden rounded-xl bg-bg"
              initial={reduce ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: i * 0.06 }}
            >
              <div className="relative overflow-hidden" style={{ aspectRatio: '4/3' }}>
                {item.image?.url ? (
                  <img src={item.image.url} alt={item.image.alt} loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-bgSoft bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(0,0,0,0.03)_10px,rgba(0,0,0,0.03)_20px)]">
                    <span className="font-sans text-xs uppercase tracking-widest text-inkSoft">{item.tag}</span>
                  </div>
                )}
              </div>
              <div className="p-5">
                <span className="text-xs font-semibold uppercase tracking-wider text-accent">{item.tag}</span>
                <h3 className="mt-1 font-heading text-base font-semibold text-ink">{item.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-inkSoft">{item.d}</p>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
