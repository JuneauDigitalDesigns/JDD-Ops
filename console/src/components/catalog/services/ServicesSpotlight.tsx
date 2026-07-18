'use client';
// ─────────────────────────────────────────────────────────────────────────────
// ServicesSpotlight — recomposed as a stack of full-width glow panels
// (see DESIGN-LANGUAGE.md). Keeps its signature cursor-tracked accent glow, but
// trades the 3-column card grid for wide horizontal panels where the glow sweeps
// across a larger surface. Distinct structure from the other services variants.
// ─────────────────────────────────────────────────────────────────────────────
import { motion, useReducedMotion } from 'framer-motion';
import { Wrench, Lightning, Drop, Wind, Tree, HardHat, House, ArrowRight } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { skinClasses, type SkinId } from '@/lib/skins';
import { EASE, viewportOnce, stillFor } from '@/lib/motion';

export const meta = {
  id: 'services-spotlight',
  category: 'services',
  label: 'Services / Spotlight',
  consumes: ['services.eyebrow', 'services.title', 'services.sub', 'services.items'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react', '@/lib/skins', '@/lib/motion'],
  skins: ['contrast', 'editorial', 'quiet'],
} as const;

const TAG_ICONS: Record<string, Icon> = {
  electrical: Lightning, plumbing: Drop, hvac: Wind, landscaping: Tree,
  construction: HardHat, roofing: HardHat, flooring: House,
};
const getIcon = (tag: string | null | undefined): Icon => TAG_ICONS[(tag ?? '').toLowerCase()] ?? Wrench;

export default function ServicesSpotlight({
  content = CONTENT,
  skin = 'contrast',
}: {
  content?: SiteContent;
  skin?: SkinId;
}) {
  const reduce = useReducedMotion() ?? false;
  const still = stillFor(skin, reduce);
  const s = skinClasses(skin);
  const { services } = content;
  if (!services.items.length) return null;

  // Signature motion moment: cursor-tracked accent glow, now across a wide panel.
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (still) return;
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
  };

  return (
    <section id="services" className={`px-6 py-24 ${s.section}`}>
      <div className="mx-auto max-w-5xl">
        <div className="max-w-xl">
          <p className={`flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] ${s.eyebrow}`}>
            <span className="hidden h-px w-8 bg-accent sm:inline-block" />
            <E p="services.eyebrow">{services.eyebrow}</E>
          </p>
          <h2 className={`mt-4 font-heading text-4xl font-bold leading-[0.95] tracking-[-0.03em] ${s.heading} md:text-5xl`}><E p="services.title">{services.title}</E></h2>
          <p className={`mt-4 ${s.body}`}><E p="services.sub">{services.sub}</E></p>
        </div>

        <div className="mt-11 flex flex-col gap-4">
          {services.items.map((item, i) => {
            const IconComp = getIcon(item.tag);
            const nn = String(item.n ?? i + 1).padStart(2, '0');
            return (
              <motion.div
                key={item.n ?? i}
                onMouseMove={onMove}
                className={`group relative overflow-hidden rounded-2xl border ${s.cardRule} ${s.card} p-7 sm:p-8`}
                style={still ? undefined : { backgroundImage: 'radial-gradient(420px circle at var(--mx,50%) var(--my,50%), color-mix(in srgb, var(--accent) 20%, transparent), transparent 72%)' }}
                initial={still ? false : { opacity: 0, y: 20 }}
                whileInView={still ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.45, ease: EASE, delay: still ? 0 : i * 0.05 }}
              >
                <div className="flex items-start gap-5 sm:gap-7">
                  <div className="inline-flex shrink-0 rounded-xl bg-accent/15 p-3"><IconComp size={30} className="text-accent" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="text-xs font-medium uppercase tracking-widest text-accent"><E p={`services.items.${i}.tag`}>{item.tag}</E></span>
                      <span className={`font-heading text-3xl font-black leading-none tabular-nums ${s.heading} opacity-15`}>{nn}</span>
                    </div>
                    <h3 className={`mt-1.5 font-heading text-2xl font-bold tracking-[-0.02em] ${s.heading}`}><E p={`services.items.${i}.t`}>{item.t}</E></h3>
                    <p className={`mt-2 max-w-2xl ${s.body}`}><E p={`services.items.${i}.d`}>{item.d}</E></p>
                    <div className="mt-4 flex items-center gap-1 text-sm font-medium text-accent opacity-0 transition-opacity group-hover:opacity-100">
                      <span>Learn more</span><ArrowRight size={14} weight="bold" />
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
