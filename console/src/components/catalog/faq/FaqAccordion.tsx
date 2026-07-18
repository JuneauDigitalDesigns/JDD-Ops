'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { Plus, Minus, PhoneCall } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { skinClasses, type SkinId } from '@/lib/skins';
import { EASE, viewportOnce, stillFor } from '@/lib/motion';

export const meta = {
  id: 'faq-accordion',
  category: 'faq',
  label: 'FAQ / Accordion',
  consumes: ['faq.eyebrow', 'faq.title', 'faq.sub', 'faq.items', 'brand.phone', 'brand.phoneHref'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react', '@/lib/skins', '@/lib/motion'],
  skins: ['editorial', 'contrast', 'quiet'],
} as const;

export default function FaqAccordion({
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
  return (
    <section id="faq" className={`px-6 py-24 ${s.section}`}>
      <div className="mx-auto max-w-3xl">
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

        <div className="mt-10 space-y-3">
          {faq.items.map((f, i) => (
            <motion.details
              key={i}
              className={`group rounded-2xl border ${s.cardRule} ${s.card}`}
              initial={still ? false : { opacity: 0, y: 8 }}
              whileInView={still ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.4, ease: EASE, delay: still ? 0 : i * 0.04 }}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
                <span className={`font-semibold ${s.heading}`}><E p={`faq.items.${i}.q`}>{f.q}</E></span>
                <span className="shrink-0 text-accent" aria-hidden="true">
                  <Plus size={18} className="block group-open:hidden" />
                  <Minus size={18} className="hidden group-open:block" />
                </span>
              </summary>
              <div className="grid grid-rows-[0fr] overflow-hidden transition-[grid-template-rows] duration-200 group-open:grid-rows-[1fr]">
                <div className="overflow-hidden">
                  <p className={`px-5 pb-5 pt-1 leading-relaxed ${s.body}`}><E p={`faq.items.${i}.a`}>{f.a}</E></p>
                </div>
              </div>
            </motion.details>
          ))}
        </div>

        <div className={`mt-10 flex items-center justify-between rounded-2xl border ${s.cardRule} ${s.card} px-6 py-4`}>
          <p className={`text-sm font-medium ${s.heading}`}>Still have questions?</p>
          <a href={brand.phoneHref} className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline">
            <PhoneCall size={15} weight="bold" />
            Call us directly
          </a>
        </div>
      </div>
    </section>
  );
}
