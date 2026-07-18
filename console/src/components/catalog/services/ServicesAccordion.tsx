'use client';
// ─────────────────────────────────────────────────────────────────────────────
// ServicesAccordion — recomposed as a split accordion with a sticky image panel
// (see DESIGN-LANGUAGE.md). Left: a controlled single-open accordion of services.
// Right: a sticky image panel that swaps to the open service. Combines the
// accordion with an image-swap; distinct from the other services variants.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Wrench, Lightning, Drop, PaintBrush, Wind, Tree, HardHat,
  Broom, Scissors, Hammer, House, CaretDown, ArrowRight,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { CONTENT } from '@/data/site';
import type { SiteContent } from '@/data/site';
import { E } from '@/lib/editable';

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
function getIcon(tag: string | null | undefined): Icon { return TAG_ICONS[(tag ?? '').toLowerCase()] ?? Wrench; }

export default function ServicesAccordion({ content = CONTENT }: { content?: SiteContent }) {
  const reduce = useReducedMotion() ?? false;
  const { services } = content;
  const [open, setOpen] = useState(0);
  if (!services.items.length) return null;

  const openIdx = Math.min(open, services.items.length - 1);
  const cur = services.items[openIdx];
  const curNum = String(cur.n ?? openIdx + 1).padStart(2, '0');

  return (
    <section id="services" className="bg-bgSoft px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <motion.div
          className="max-w-xl"
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

        <div className="mt-10 grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-start">
          {/* Left: controlled accordion */}
          <ul className="border-y border-rule">
            {services.items.map((item, i) => {
              const IconComp = getIcon(item.tag);
              const on = i === openIdx;
              const nn = String(item.n ?? i + 1).padStart(2, '0');
              return (
                <li key={item.n ?? i} className="border-b border-rule last:border-b-0">
                  <button
                    type="button"
                    onClick={() => setOpen(i)}
                    aria-expanded={on}
                    className="flex w-full items-center gap-4 py-5 text-left"
                  >
                    <span className={`shrink-0 font-heading text-2xl font-black leading-none tabular-nums ${on ? 'text-accent' : 'text-ink/25'}`}>{nn}</span>
                    <IconComp size={20} className={`shrink-0 ${on ? 'text-accent' : 'text-inkSoft'}`} />
                    <h3 className="flex-1 font-heading text-lg text-ink"><E p={`services.items.${i}.t`}>{item.t}</E></h3>
                    <CaretDown size={18} className={`shrink-0 transition-transform duration-200 ${on ? '-rotate-180 text-accent' : 'text-inkSoft'}`} aria-hidden="true" />
                  </button>
                  <div className={`grid overflow-hidden transition-[grid-template-rows] duration-300 ${on ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                    <div className="overflow-hidden">
                      <div className="pb-5 pl-[2.75rem] text-inkSoft">
                        {/* Mobile-only image (desktop uses the sticky panel) */}
                        {item.image?.url && (
                          <img src={item.image.url} alt={item.image.alt} loading="lazy"
                            className="mb-3 aspect-[16/9] w-full rounded-lg object-cover lg:hidden" />
                        )}
                        <p><E p={`services.items.${i}.d`}>{item.d}</E></p>
                        <a href="#contact" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent">
                          Get a free quote
                          <ArrowRight size={13} />
                        </a>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Right: sticky image panel that follows the open service (desktop) */}
          <div className="hidden lg:sticky lg:top-24 lg:block">
            <div className="relative overflow-hidden rounded-2xl border border-rule bg-bg" style={{ aspectRatio: '4/3' }}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={openIdx}
                  className="absolute inset-0"
                  initial={reduce ? false : { opacity: 0, scale: 1.03 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={reduce ? undefined : { opacity: 0, scale: 1 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                >
                  {cur.image?.url ? (
                    <img src={cur.image.url} alt={cur.image.alt} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-accent-grad">
                      <span className="font-heading text-8xl font-black leading-none text-white/25">{curNum}</span>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
