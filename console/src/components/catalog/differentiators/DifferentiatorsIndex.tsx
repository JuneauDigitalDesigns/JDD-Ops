'use client';
// ─────────────────────────────────────────────────────────────────────────────
// DifferentiatorsIndex — editorial-index over about.pillars (see the Phase 5 specimen
// 8). Shares the archetype with ServicesShowcase but reads as a DIFFERENT structure:
// a claim + evidence pair per row, laid out two-up on desktop, with no image reveal.
// Numerals NEUTRAL (decision 10). No new schema field: it reads about.pillars {k,t,d}.
// ─────────────────────────────────────────────────────────────────────────────
import { motion, useReducedMotion } from 'framer-motion';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { skinClasses, type SkinId } from '@/lib/skins';
import { EASE, viewportOnce, stillFor } from '@/lib/motion';

export const meta = {
  id: 'differentiators-index',
  category: 'differentiators',
  label: 'Differentiators / Index',
  consumes: ['about.pillars'],
  sharedDeps: ['framer-motion', '@/lib/skins', '@/lib/motion'],
  skins: ['default', 'soft'],
  /** Structural archetype, from src/lib/archetypes.ts. Unique within the category. */
  archetype: 'editorial-index',
  signature: false,
} as const;

export default function DifferentiatorsIndex({
  content = CONTENT,
  skin = 'default',
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
      <div className="mx-auto max-w-6xl px-6">
        <h2 className={`max-w-xl font-heading text-3xl font-bold tracking-[-0.01em] ${s.heading} md:text-4xl`}><E p="about.title">{content.about?.title ?? ''}</E></h2>
        <div className="mt-10 grid gap-x-10 lg:grid-cols-2">
          {pillars.map((p, i) => (
            <motion.div
              key={i}
              className={`grid grid-cols-[2.5rem_1fr] items-baseline gap-4 border-t ${s.rule} py-6`}
              initial={still ? false : { opacity: 0, y: 12 }}
              whileInView={still ? undefined : { opacity: 1, y: 0 }}
              viewport={viewportOnce}
              transition={{ duration: 0.4, ease: EASE, delay: still ? 0 : (i % 2) * 0.05 }}
            >
              <span aria-hidden className={`font-heading text-base font-bold tabular-nums ${s.body}`}>{String(i + 1).padStart(2, '0')}</span>
              <div>
                <h3 className={`font-heading text-lg font-semibold tracking-[-0.01em] ${s.heading}`}><E p={`about.pillars.${i}.t`}>{p.t}</E></h3>
                <p className={`mt-1 text-sm ${s.body}`}><E p={`about.pillars.${i}.d`}>{p.d}</E></p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
