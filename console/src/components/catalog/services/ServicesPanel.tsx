'use client';
// ─────────────────────────────────────────────────────────────────────────────
// ServicesPanel (Bento) — recomposed as an intensified dense mosaic
// (see DESIGN-LANGUAGE.md). A 4-column grid with grid-flow-dense and dramatic,
// varied tile spans (tall feature, wide bands) so imagery interlocks like a
// magazine mosaic. The image-forward archetype; distinct from the other variants.
// ─────────────────────────────────────────────────────────────────────────────
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from '@phosphor-icons/react';
import { CONTENT } from '@/data/site';
import type { SiteContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'services-bento',
  category: 'services',
  label: 'Services / Bento',
  consumes: ['services.eyebrow', 'services.title', 'services.sub', 'services.items'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react'],
} as const;

/** Deterministic mosaic spans; grid-flow-dense backfills any holes so it never gaps. */
function spanFor(i: number): string {
  if (i === 0) return 'sm:col-span-2 sm:row-span-2';       // tall feature
  if (i % 5 === 2) return 'sm:col-span-2';                 // wide band
  if (i % 5 === 4) return 'sm:row-span-2';                 // tall column
  return '';                                               // 1×1
}

export default function ServicesPanel({ content = CONTENT }: { content?: SiteContent }) {
  const reduce = useReducedMotion() ?? false;
  const { services } = content;
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
          <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] text-accent">
            <span className="hidden h-px w-8 bg-accent sm:inline-block" />
            <E p="services.eyebrow">{services.eyebrow}</E>
          </p>
          <h2 className="mt-4 font-heading text-4xl font-bold leading-[0.95] tracking-[-0.03em] text-ink md:text-5xl"><E p="services.title">{services.title}</E></h2>
          <p className="mt-4 text-inkSoft"><E p="services.sub">{services.sub}</E></p>
        </motion.div>

        <div className="grid grid-flow-dense auto-rows-[190px] grid-cols-2 gap-3 sm:grid-cols-4">
          {items.map((item, i) => {
            const feature = i === 0;
            const tall = spanFor(i).includes('row-span-2');
            const big = feature || tall;
            const nn = String(item.n ?? i + 1).padStart(2, '0');
            return (
              <motion.article
                key={item.n ?? i}
                className={`group relative isolate flex flex-col justify-end overflow-hidden rounded-2xl ${spanFor(i)}`}
                initial={reduce ? false : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: i * 0.05 }}
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

                {/* Heavy numeral index */}
                <span aria-hidden className="absolute left-6 top-5 font-heading text-3xl font-black leading-none text-bg/35">
                  {nn}
                </span>
                {/* Geometric cut — accent corner on the feature tile */}
                {feature && (
                  <div aria-hidden className="pointer-events-none absolute right-0 top-0 h-16 w-16 bg-accent"
                    style={{ clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }} />
                )}

                <div className="p-6">
                  <span className="text-xs font-semibold uppercase tracking-wider text-bg/70"><E p={`services.items.${i}.tag`}>{item.tag}</E></span>
                  <h3 className={`mt-1 font-heading font-semibold text-bg ${feature ? 'text-2xl' : 'text-lg'}`}>
                    <E p={`services.items.${i}.t`}>{item.t}</E>
                  </h3>
                  {big && <p className="mt-2 max-w-md text-sm leading-relaxed text-bg/80"><E p={`services.items.${i}.d`}>{item.d}</E></p>}
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
