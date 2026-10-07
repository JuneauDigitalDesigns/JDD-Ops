'use client';
// ─────────────────────────────────────────────────────────────────────────────
// StatsLedger — numbered-ledger over about.stats (see the Phase 5 specimen 12).
// Shares its data with StatsBand but is the opposite STRUCTURE: left-aligned rows on
// hairline rules, read top to bottom like an account, with the figure at the right.
// It does NOT count up: only StatsBand carries that one amended moment (decision 18).
// Figures NEUTRAL (decision 10).
// ─────────────────────────────────────────────────────────────────────────────
import { motion, useReducedMotion } from 'framer-motion';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { skinClasses, type SkinId } from '@/lib/skins';
import { EASE, viewportOnce, stillFor } from '@/lib/motion';

export const meta = {
  id: 'stats-ledger',
  category: 'stats',
  label: 'Stats / Ledger',
  consumes: ['about.stats'],
  sharedDeps: ['framer-motion', '@/lib/skins', '@/lib/motion'],
  skins: ['default', 'soft'],
  /** Structural archetype, from src/lib/archetypes.ts. Unique within the category. */
  archetype: 'numbered-ledger',
  signature: false,
} as const;

export default function StatsLedger({
  content = CONTENT,
  skin = 'default',
}: {
  content?: SiteContent;
  skin?: SkinId;
}) {
  const reduce = useReducedMotion() ?? false;
  const still = stillFor(skin, reduce);
  const s = skinClasses(skin);
  const stats = content.about?.stats ?? [];
  if (!stats.length) return null;

  return (
    <section id="stats" className={`py-20 ${s.section}`}>
      <div className="mx-auto max-w-3xl px-6">
        <div>
          {stats.map((st, i) => {
            const last = i === stats.length - 1;
            return (
              <motion.div
                key={i}
                className={`grid grid-cols-[2.5rem_1fr_auto] items-baseline gap-4 border-t ${s.rule} py-5 ${last ? `border-b ${s.rule}` : ''}`}
                initial={still ? false : { opacity: 0, y: 10 }}
                whileInView={still ? undefined : { opacity: 1, y: 0 }}
                viewport={viewportOnce}
                transition={{ duration: 0.4, ease: EASE, delay: still ? 0 : i * 0.05 }}
              >
                <span aria-hidden className={`font-heading text-base font-bold tabular-nums ${s.body}`}>{String(i + 1).padStart(2, '0')}</span>
                <span className={`text-sm ${s.body}`}><E p={`about.stats.${i}.l`}>{st.l}</E></span>
                <span className={`font-heading text-2xl font-bold tabular-nums tracking-[-0.01em] ${s.heading}`}><E p={`about.stats.${i}.n`} fit>{st.n}</E></span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
