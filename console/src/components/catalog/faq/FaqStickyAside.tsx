'use client';
import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { PhoneCall, CaretRight } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { skinClasses, type SkinId } from '@/lib/skins';
import { EASE, viewportOnce, stillFor } from '@/lib/motion';

export const meta = {
  id: 'faq-two-pane',
  category: 'faq',
  label: 'FAQ / Two-pane',
  consumes: ['faq.eyebrow', 'faq.title', 'faq.sub', 'faq.items', 'brand.phone', 'brand.phoneHref'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react', '@/lib/skins', '@/lib/motion'],
  skins: ['editorial', 'quiet'],
} as const;

export default function FaqStickyAside({
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
  const [active, setActive] = useState(0);
  if (!faq.items.length) return null;
  const current = faq.items[active];

  return (
    <section id="faq" className={`py-24 ${s.section}`}>
      <div className="mx-auto max-w-5xl px-6">
        <motion.div
          className="max-w-xl"
          initial={still ? false : { opacity: 0, y: 14 }}
          whileInView={still ? undefined : { opacity: 1, y: 0 }}
          viewport={viewportOnce}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${s.eyebrow}`}><E p="faq.eyebrow">{faq.eyebrow}</E></p>
          <h2 className={`mt-3 font-heading text-3xl font-bold tracking-[-0.01em] ${s.heading} md:text-4xl`}><E p="faq.title">{faq.title}</E></h2>
          <p className={`mt-3 ${s.body}`}><E p="faq.sub">{faq.sub}</E></p>
        </motion.div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-start">
          {/* Left: question list */}
          <ul className="space-y-1">
            {faq.items.map((f, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => setActive(i)}
                  aria-expanded={active === i}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl px-5 py-4 text-left transition-colors ${
                    i === active ? `${s.card} ${s.heading}` : `${s.body} hover:bg-bgSoft`
                  }`}
                >
                  <span className="font-heading text-sm font-semibold"><E p={`faq.items.${i}.q`}>{f.q}</E></span>
                  <CaretRight
                    size={16}
                    className={`shrink-0 transition-transform ${i === active ? 'translate-x-0 text-accent' : '-translate-x-1 text-rule'}`}
                  />
                </button>
              </li>
            ))}
          </ul>

          {/* Right: answer pane */}
          <div className="lg:sticky lg:top-24">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                className={`rounded-2xl border ${s.cardRule} ${s.card} p-8`}
                initial={still ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={still ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: EASE }}
              >
                <h3 className={`font-heading text-xl font-bold ${s.heading}`}><E p={`faq.items.${active}.q`}>{current.q}</E></h3>
                <p className={`mt-3 leading-relaxed ${s.body}`}><E p={`faq.items.${active}.a`}>{current.a}</E></p>
                <a
                  href={brand.phoneHref}
                  className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline"
                >
                  <PhoneCall size={15} weight="bold" />
                  Still unsure? Call <E p="brand.phone">{brand.phone}</E>
                </a>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
