'use client';
// ─────────────────────────────────────────────────────────────────────────────
// DifferentiatorsPanels — stacked-panels over about.pillars (see the Phase 5 specimen
// 9). Shares the archetype with ServicesSpotlight but differs deliberately: here every
// panel is the SAME height (a claim ledger, not a feature hierarchy), the claim phrase
// leads at display-3 weight with its evidence as a quiet trailing line. No image.
// ─────────────────────────────────────────────────────────────────────────────
import { motion, useReducedMotion } from 'framer-motion';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { skinClasses, type SkinId } from '@/lib/skins';
import { EASE, viewportOnce, stillFor } from '@/lib/motion';

export const meta = {
  id: 'differentiators-panels',
  category: 'differentiators',
  label: 'Differentiators / Panels',
  consumes: ['about.pillars'],
  sharedDeps: ['framer-motion', '@/lib/skins', '@/lib/motion'],
  skins: ['soft', 'default', 'inverted'],
  /** Structural archetype, from src/lib/archetypes.ts. Unique within the category. */
  archetype: 'stacked-panels',
  signature: false,
} as const;

export default function DifferentiatorsPanels({
  content = CONTENT,
  skin = 'soft',
}: {
  content?: SiteContent;
  skin?: SkinId;
}) {
  const reduce = useReducedMotion() ?? false;
  const still = stillFor(skin, reduce);
  const s = skinClasses(skin);
  const pillars = content.about?.pillars ?? [];
  if (!pillars.length) return null;

  return (
    <section id="differentiators" className={`py-20 ${s.section}`}>
      <div className="mx-auto max-w-5xl px-6">
        <h2 className={`max-w-xl font-heading text-3xl font-bold tracking-[-0.01em] ${s.heading} md:text-4xl`}><E p="about.title">{content.about?.title ?? ''}</E></h2>
        <div className="mt-8">
          {pillars.map((p, i) => {
            const last = i === pillars.length - 1;
            return (
              <motion.div
                key={i}
                className={`grid gap-1 border-t ${s.rule} py-6 sm:grid-cols-[1fr_auto] sm:items-baseline sm:gap-6 ${last ? `border-b ${s.rule}` : ''}`}
                initial={still ? false : { opacity: 0, y: 10 }}
                whileInView={still ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.4, ease: EASE, delay: still ? 0 : i * 0.04 }}
              >
                <h3 className={`font-heading text-xl font-semibold tracking-[-0.01em] ${s.heading} md:text-2xl`}><E p={`about.pillars.${i}.t`}>{p.t}</E></h3>
                <p className={`text-sm ${s.body} sm:text-right`}><E p={`about.pillars.${i}.d`}>{p.d}</E></p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
