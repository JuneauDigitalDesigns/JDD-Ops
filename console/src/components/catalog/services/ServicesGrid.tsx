'use client';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Wrench, Lightning, Drop, PaintBrush, Wind, Tree, HardHat,
  Broom, Scissors, Hammer, House, ArrowRight,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { CONTENT } from '@/data/site';
import type { SiteContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'services-grid',
  category: 'services',
  label: 'Services / Grid',
  consumes: ['services.eyebrow', 'services.title', 'services.sub', 'services.items'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react'],
} as const;

const TAG_ICONS: Record<string, Icon> = {
  cleaning: Broom, electrical: Lightning, plumbing: Drop, painting: PaintBrush,
  hvac: Wind, landscaping: Tree, construction: HardHat, roofing: HardHat,
  flooring: House, trimming: Scissors, carpentry: Hammer,
  general: Wrench, repair: Wrench, maintenance: Wrench,
};
function getIcon(tag: string): Icon { return TAG_ICONS[tag.toLowerCase()] ?? Wrench; }

export default function ServicesGrid({ content = CONTENT }: { content?: SiteContent }) {
  const reduce = useReducedMotion() ?? false;
  const { services } = content;
  if (!services.items.length) return null;
  return (
    <section id="services" className="bg-bg px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <motion.div
          className="max-w-xl"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-accent"><E p="services.eyebrow">{services.eyebrow}</E></p>
          <h2 className="mt-2 font-heading text-3xl text-ink md:text-4xl"><E p="services.title">{services.title}</E></h2>
          <p className="mt-3 text-inkSoft"><E p="services.sub">{services.sub}</E></p>
        </motion.div>

        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.items.map((s, i) => {
            const IconComp = getIcon(s.tag);
            return (
              <motion.li
                key={s.n}
                className="group flex flex-col overflow-hidden rounded-xl border border-rule bg-bg transition-all hover:border-accent hover:shadow-md"
                initial={reduce ? false : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: i * 0.06 }}
              >
                {s.image?.url ? (
                  <div className="relative overflow-hidden" style={{ aspectRatio: '16/9' }}>
                    <img src={s.image.url} alt={s.image.alt} loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  </div>
                ) : null}
                <div className="flex flex-1 flex-col p-7">
                  <div className="inline-flex w-fit rounded-lg bg-bgSoft p-2.5">
                    <IconComp size={24} className="text-accent" />
                  </div>
                  <span className="mt-4 text-xs font-medium uppercase tracking-widest text-accent"><E p={`services.items.${i}.tag`}>{s.tag}</E></span>
                  <h3 className="mt-2 font-heading text-xl text-ink"><E p={`services.items.${i}.t`}>{s.t}</E></h3>
                  <p className="mt-2 flex-1 text-inkSoft"><E p={`services.items.${i}.d`}>{s.d}</E></p>
                  <div className="mt-5 flex items-center gap-1 text-sm font-medium text-accent">
                    <span>Contact for pricing</span>
                    <ArrowRight size={14} className="transition-transform duration-150 group-hover:translate-x-0.5" />
                  </div>
                </div>
              </motion.li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
