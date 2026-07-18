'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { Question, ArrowRight } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { skinClasses, type SkinId } from '@/lib/skins';
import { EASE, viewportOnce, stillFor } from '@/lib/motion';

export const meta = {
  id: 'faq-two-column',
  category: 'faq',
  label: 'FAQ / Two-column',
  consumes: ['faq.eyebrow', 'faq.title', 'faq.sub', 'faq.items', 'brand.phone', 'brand.phoneHref'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react', '@/lib/skins', '@/lib/motion'],
  skins: ['editorial', 'contrast'],
} as const;

export default function FaqTwoColumn({
  content = CONTENT,
  skin = 'editorial',
}: {
  content?: SiteContent;
  skin?: SkinId;
}) {
  const reduce = useReducedMotion() ?? false;
  const still = stillFor(skin, reduce);
  const s = skinClasses(skin);
  const { faq, brand } = content;
  if (!faq.items.length) return null;
  const mid = Math.ceil(faq.items.length / 2);
  const left = faq.items.slice(0, mid);
  const right = faq.items.slice(mid);
  return (
    <section id="faq" className={`px-6 py-24 ${s.section}`}>
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={still ? false : { opacity: 0, y: 14 }}
          whileInView={still ? undefined : { opacity: 1, y: 0 }}
          viewport={viewportOnce}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${s.eyebrow}`}><E p="faq.eyebrow">{faq.eyebrow}</E></p>
          <h2 className={`mt-3 font-heading text-3xl font-bold tracking-[-0.01em] ${s.heading} md:text-4xl`}><E p="faq.title">{faq.title}</E></h2>
          <p className={`mt-3 ${s.body}`}><E p="faq.sub">{faq.sub}</E></p>
        </motion.div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {[left, right].map((col, ci) => (
            <div key={ci} className="space-y-5">
              {col.map((f, i) => (
                <motion.div
                  key={i}
                  className={`rounded-2xl border ${s.cardRule} ${s.card} p-6 transition-all hover:border-accent hover:shadow-sm`}
                  initial={still ? false : { opacity: 0, y: 12 }}
                  whileInView={still ? undefined : { opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.4, ease: EASE, delay: still ? 0 : (ci * mid + i) * 0.04 }}
                >
                  <div className="mb-3 inline-flex rounded-lg bg-accent/10 p-1.5">
                    <Question size={18} className="text-accent" />
                  </div>
                  <p className={`font-semibold ${s.heading}`}><E p={`faq.items.${ci * mid + i}.q`}>{f.q}</E></p>
                  <p className={`mt-2 leading-relaxed ${s.body}`}><E p={`faq.items.${ci * mid + i}.a`}>{f.a}</E></p>
                </motion.div>
              ))}
            </div>
          ))}
        </div>

        <div className={`mt-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl border ${s.cardRule} ${s.card} px-6 py-4`}>
          <p className={`text-sm ${s.body}`}>Didn&apos;t find your answer?</p>
          <a href={brand.phoneHref} className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
            Call us directly
            <ArrowRight size={14} />
          </a>
        </div>
      </div>
    </section>
  );
}
