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

  return (
    <section id="faq" className={`py-24 ${s.section}`}>
      <div className="mx-auto max-w-4xl px-6">
        <h2 className={`font-heading text-3xl font-bold tracking-[-0.01em] ${s.heading} md:text-4xl`}><E p="faq.title">{faq?.title ?? ''}</E></h2>
        {faq?.sub && <p className={`mt-3 ${s.body}`}><E p="faq.sub">{faq.sub}</E></p>}
        <div className="mt-8">
          {items.map((it, i) => {
            const last = i === items.length - 1;
            return (
              <motion.div
                key={i}
                className={`grid grid-cols-[1.25rem_1fr] items-baseline gap-4 border-t ${s.rule} py-6 ${last ? `border-b ${s.rule}` : ''}`}
                initial={still ? false : { opacity: 0, y: 10 }}
                whileInView={still ? undefined : { opacity: 1, y: 0 }}
                viewport={viewportOnce}
                transition={{ duration: 0.4, ease: EASE, delay: still ? 0 : i * 0.04 }}
              >
                <span aria-hidden className={`font-heading text-xl leading-none ${s.body}`}>&middot;</span>
                <div>
                  <h3 className={`font-heading text-lg font-semibold tracking-[-0.01em] ${s.heading}`}><E p={`faq.items.${i}.q`}>{it.q}</E></h3>
                  <p className={`mt-1.5 max-w-prose text-sm leading-relaxed ${s.body}`}><E p={`faq.items.${i}.a`}>{it.a}</E></p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
