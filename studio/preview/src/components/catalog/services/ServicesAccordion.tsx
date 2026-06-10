'use client';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Wrench, Lightning, Drop, PaintBrush, Wind, Tree, HardHat,
  Broom, Scissors, Hammer, House, CaretDown, ArrowRight,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { CONTENT } from '@/data/site';

export const meta = {
  id: 'services-accordion',
  category: 'services',
  label: 'Services / Accordion',
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

export default function ServicesAccordion() {
  const reduce = useReducedMotion() ?? false;
  const { services } = CONTENT;
  if (!services.items.length) return null;
  return (
    <section id="services" className="bg-bgSoft px-6 py-20">
      <div className="mx-auto max-w-3xl">
        <motion.div
          className="max-w-xl"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">{services.eyebrow}</p>
          <h2 className="mt-2 font-heading text-3xl text-ink md:text-4xl">{services.title}</h2>
          <p className="mt-3 text-inkSoft">{services.sub}</p>
        </motion.div>

        <div className="mt-10 space-y-2">
          {services.items.map((s, i) => {
            const IconComp = getIcon(s.tag);
            return (
              <motion.details
                key={s.n}
                className="group rounded-xl border border-rule bg-bg"
                initial={reduce ? false : { opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: i * 0.05 }}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 hover:bg-bgSoft">
                  <div className="flex items-center gap-3">
                    <IconComp size={20} className="shrink-0 text-accent" />
                    <span className="text-xs font-medium uppercase tracking-widest text-accent">{s.n}</span>
                    <h3 className="font-heading text-lg text-ink">{s.t}</h3>
                  </div>
                  <CaretDown size={18} className="shrink-0 text-inkSoft transition-transform duration-200 group-open:-rotate-180" aria-hidden="true" />
                </summary>
                <div className="grid grid-rows-[0fr] overflow-hidden transition-[grid-template-rows] duration-200 group-open:grid-rows-[1fr]">
                  <div className="overflow-hidden">
                    <div className="px-5 pb-5 pt-1 text-inkSoft">
                      <p>{s.d}</p>
                      <a href="#contact" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent">
                        Get a free quote
                        <ArrowRight size={13} />
                      </a>
                    </div>
                  </div>
                </div>
              </motion.details>
            );
          })}
        </div>
      </div>
    </section>
  );
}
