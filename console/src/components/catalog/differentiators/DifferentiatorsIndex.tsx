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

  // Brand-tinted (accent2) depth; derived via color-mix so a per-section accent2 edit recolours it.
  const cardShadow =
    '0 1px 2px color-mix(in srgb, var(--accent-2) 10%, transparent), 0 14px 30px -14px color-mix(in srgb, var(--accent-2) 30%, transparent)';

  return (
    <section id="differentiators" className={`py-20 lg:py-24 ${s.section}`}>
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-2xl">
          <h2 className={`font-heading text-3xl font-bold tracking-[-0.01em] md:text-4xl ${s.heading}`}><E p="about.title">{content.about?.title ?? ''}</E></h2>
          <span className="accent-bar mt-5" aria-hidden="true" />
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {pillars.map((p, i) => (
            <motion.div
              key={i}
              className={`group relative overflow-hidden rounded-2xl border p-7 ${s.card} ${s.cardRule}`}
              style={{ boxShadow: cardShadow }}
              initial={still ? false : { opacity: 0, y: 12 }}
              whileInView={still ? undefined : { opacity: 1, y: 0 }}
              viewport={viewportOnce}
              transition={{ duration: 0.4, ease: EASE, delay: still ? 0 : (i % 2) * 0.05 }}
            >
              {/* Accent-bar cap — the two-tone --accent-bar gradient. */}
              <span className="absolute left-7 top-0 h-1 w-11 rounded-b" style={{ background: 'var(--accent-bar)' }} aria-hidden="true" />
              <span aria-hidden className="font-heading text-sm font-bold tabular-nums text-[color:var(--accent-2)]">{String(i + 1).padStart(2, '0')}</span>
              <h3 className={`mt-3 font-heading text-xl font-semibold tracking-[-0.01em] ${s.heading}`}><E p={`about.pillars.${i}.t`}>{p.t}</E></h3>
              <p className={`mt-2 text-[15px] leading-relaxed ${s.body}`}><E p={`about.pillars.${i}.d`}>{p.d}</E></p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
