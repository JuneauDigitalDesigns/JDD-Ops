'use client';
// ─────────────────────────────────────────────────────────────────────────────
// ServicesGrid — recomposed as a Feature + Rail (see DESIGN-LANGUAGE.md).
// Asymmetric split: a large feature panel showing the active service, and a rail
// listing every service. Hover / click a rail row to swap the feature.
// Adapts the swap pattern from catalog/faq/FaqStickyAside and the split from
// catalog/work/WorkSpotlight. Structure over decoration.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Wrench, Lightning, Drop, PaintBrush, Wind, Tree, HardHat,
  Broom, Scissors, Hammer, House, ArrowRight,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { skinClasses, type SkinId } from '@/lib/skins';
import { EASE, viewportOnce, stillFor } from '@/lib/motion';

export const meta = {
  id: 'services-grid',
  category: 'services',
  label: 'Services / Grid',
  consumes: ['services.eyebrow', 'services.title', 'services.sub', 'services.items'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react', '@/lib/skins', '@/lib/motion'],
  skins: ['editorial', 'contrast'],
} as const;

const TAG_ICONS: Record<string, Icon> = {
  cleaning: Broom, electrical: Lightning, plumbing: Drop, painting: PaintBrush,
  hvac: Wind, landscaping: Tree, construction: HardHat, roofing: HardHat,
  flooring: House, trimming: Scissors, carpentry: Hammer,
  general: Wrench, repair: Wrench, maintenance: Wrench,
};
function getIcon(tag: string | null | undefined): Icon { return TAG_ICONS[(tag ?? '').toLowerCase()] ?? Wrench; }

export default function ServicesGrid({
  content = CONTENT,
  skin = 'editorial',
}: {
  content?: SiteContent;
  skin?: SkinId;
}) {
  const reduce = useReducedMotion() ?? false;
  const still = stillFor(skin, reduce);
  const s = skinClasses(skin);
  const dark = skin === 'contrast';
  const { services } = content;
  const [active, setActive] = useState(0);
  if (!services.items.length) return null;

  const idx = Math.min(active, services.items.length - 1);
  const current = services.items[idx];
  const num = (n: string | number, i: number) => String(n ?? i + 1).padStart(2, '0');

  return (
    <section id="services" className={`px-6 py-24 ${s.section}`}>
      <div className="mx-auto max-w-6xl">
        {/* Section header — hairline eyebrow + scaled heading */}
        <motion.div
          className="max-w-xl"
          initial={still ? false : { opacity: 0, y: 14 }}
          whileInView={still ? undefined : { opacity: 1, y: 0 }}
          viewport={viewportOnce}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <p className={`flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] ${s.eyebrow}`}>
            <span className="hidden h-px w-8 bg-accent sm:inline-block" />
            <E p="services.eyebrow">{services.eyebrow}</E>
          </p>
          <h2 className={`mt-4 font-heading text-4xl font-bold leading-[0.95] tracking-[-0.03em] ${s.heading} md:text-5xl`}><E p="services.title">{services.title}</E></h2>
          <p className={`mt-4 ${s.body}`}><E p="services.sub">{services.sub}</E></p>
        </motion.div>

        <div className="mt-12 grid gap-8 lg:grid-cols-[1.35fr_minmax(300px,1fr)] lg:items-start">
          {/* Feature panel — swaps with the active rail selection */}
          <motion.div
            className={`overflow-hidden rounded-3xl border ${s.cardRule} ${s.card}`}
            initial={still ? false : { opacity: 0, x: -16 }}
            whileInView={still ? undefined : { opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.55, ease: EASE }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={idx}
                initial={still ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={still ? undefined : { opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: EASE }}
              >
                <div className="relative overflow-hidden" style={{ aspectRatio: '16/10' }}>
                  {current.image?.url ? (
                    <img src={current.image.url} alt={current.image.alt} loading="lazy"
                      className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-accent-grad">
                      <span className="font-heading text-8xl font-black leading-none text-white/25">{num(current.n, idx)}</span>
                    </div>
                  )}
                  {/* Geometric cut — hard diagonal seam where the image meets the panel body */}
                  <div aria-hidden className={`pointer-events-none absolute inset-x-0 bottom-0 h-8 ${s.card}`}
                    style={{ clipPath: 'polygon(0 100%, 100% 0, 100% 100%)' }} />
                </div>
                <div className="p-7 lg:p-9">
                  {/* tag + title are plain mirrors of the rail selection (editable in the rail) */}
                  <span className="text-xs font-semibold uppercase tracking-widest text-accent">{current.tag}</span>
                  <h3 className={`mt-2 font-heading text-3xl font-bold tracking-[-0.02em] ${s.heading}`}>{current.t}</h3>
                  <p className={`mt-3 max-w-prose leading-relaxed ${s.body}`}><E p={`services.items.${idx}.d`}>{current.d}</E></p>
                  <a href="#contact" className="group mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline">
                    Contact for pricing
                    <ArrowRight size={15} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
                  </a>
                </div>
              </motion.div>
            </AnimatePresence>
          </motion.div>

          {/* Rail — every service; the picker that drives the feature */}
          <motion.ul
            className={`border-t ${s.rule} ${dark ? 'divide-y divide-ruleInk' : 'divide-y divide-rule'}`}
            initial={still ? false : { opacity: 0, x: 16 }}
            whileInView={still ? undefined : { opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.55, ease: EASE }}
          >
            {services.items.map((item, i) => {
              const IconComp = getIcon(item.tag);
              const on = i === idx;
              return (
                <li key={item.n ?? i}>
                  <button
                    type="button"
                    onClick={() => setActive(i)}
                    onMouseEnter={() => setActive(i)}
                    aria-pressed={on}
                    className={`group flex w-full items-center gap-4 border-l-2 py-4 pl-4 pr-3 text-left transition-colors ${
                      on
                        ? `border-accent ${s.card}`
                        : `border-transparent ${dark ? 'hover:bg-inkPanel2' : 'hover:bg-bgSoft'}`
                    }`}
                  >
                    <span className={`font-heading text-2xl font-black leading-none tabular-nums ${on ? 'text-accent' : `${s.heading} opacity-30`}`}>
                      {num(item.n, i)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block font-heading text-base font-bold leading-snug ${s.heading}`}><E p={`services.items.${i}.t`}>{item.t}</E></span>
                      <span className="mt-0.5 block text-[11px] font-semibold uppercase tracking-wider text-accent"><E p={`services.items.${i}.tag`}>{item.tag}</E></span>
                    </span>
                    <IconComp size={20} className={`shrink-0 transition-colors ${on ? 'text-accent' : `${s.body} opacity-50`}`} />
                  </button>
                </li>
              );
            })}
          </motion.ul>
        </div>
      </div>
    </section>
  );
}
