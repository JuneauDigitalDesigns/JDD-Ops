'use client';
// ─────────────────────────────────────────────────────────────────────────────
// FaqIndex — editorial-index over faq.items (see the Phase 5 specimen 14). The third use
// of editorial-index, in a third category, drawn to read as its own thing: a question
// index where the row is the question at card-title weight with the answer directly
// beneath and a NEUTRAL dot in place of a numeral, so it does not echo ServicesShowcase's
// service numerals. No media reveal.
// ─────────────────────────────────────────────────────────────────────────────
import { motion, useReducedMotion } from 'framer-motion';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { skinClasses, type SkinId } from '@/lib/skins';
import { EASE, viewportOnce, stillFor } from '@/lib/motion';

export const meta = {
  id: 'faq-index',
  category: 'faq',
  label: 'FAQ / Index',
  consumes: ['faq.eyebrow', 'faq.title', 'faq.sub', 'faq.items'],
  sharedDeps: ['framer-motion', '@/lib/skins', '@/lib/motion'],
  skins: ['default', 'soft', 'inverted'],
  /** Structural archetype, from src/lib/archetypes.ts. Unique within the category. */
  archetype: 'editorial-index',
  signature: false,
} as const;

export default function FaqIndex({
  content = CONTENT,
  skin = 'default',
}: {
  content?: SiteContent;
  skin?: SkinId;
}) {
  const reduce = useReducedMotion() ?? false;
  const still = stillFor(skin, reduce);
  const s = skinClasses(skin);
  const faq = content.faq;
  const items = faq?.items ?? [];
  if (!items.length) return null;

  // Brand-tinted (accent2) depth; color-mix keeps it live against a per-section accent2 edit.
  const cardShadow =
    '0 1px 2px color-mix(in srgb, var(--accent-2) 9%, transparent), 0 12px 26px -14px color-mix(in srgb, var(--accent-2) 28%, transparent)';

  return (
    <section id="faq" className={`py-20 lg:py-24 ${s.section}`}>
      <div className="mx-auto max-w-5xl px-6">
        <div className="max-w-2xl">
          <h2 className={`font-heading text-3xl font-bold tracking-[-0.01em] ${s.heading} md:text-4xl`}><E p="faq.title">{faq?.title ?? ''}</E></h2>
          <span className="accent-bar mt-5" aria-hidden="true" />
          {faq?.sub && <p className={`mt-4 ${s.body}`}><E p="faq.sub">{faq.sub}</E></p>}
        </div>
        {/* Two-column grid of bordered cells (was a single-column index). */}
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {items.map((it, i) => (
            <motion.div
              key={i}
              className={`rounded-2xl border p-6 ${s.card} ${s.cardRule}`}
              style={{ boxShadow: cardShadow }}
              initial={still ? false : { opacity: 0, y: 10 }}
              whileInView={still ? undefined : { opacity: 1, y: 0 }}
              viewport={viewportOnce}
              transition={{ duration: 0.4, ease: EASE, delay: still ? 0 : (i % 2) * 0.05 }}
            >
              <div className="flex items-start gap-2.5">
                <span aria-hidden className="font-heading text-sm font-bold tabular-nums text-[color:var(--accent-2)]">{String(i + 1).padStart(2, '0')}</span>
                <h3 className={`font-heading text-[17px] font-semibold leading-snug tracking-[-0.01em] ${s.heading}`}><E p={`faq.items.${i}.q`}>{it.q}</E></h3>
              </div>
              <p className={`mt-2.5 pl-[26px] text-[14.5px] leading-relaxed ${s.body}`}><E p={`faq.items.${i}.a`}>{it.a}</E></p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
