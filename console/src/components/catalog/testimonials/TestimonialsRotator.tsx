'use client';
// ─────────────────────────────────────────────────────────────────────────────
// TestimonialsRotator — recomposed as Feature + Reviewer Rail (see DESIGN-LANGUAGE.md).
// Asymmetric split: a large active quote on the left, a rail of reviewers on the
// right; click/hover a reviewer to swap the quote. Interactive; distinct from the
// mosaic (Grid), the giant spotlight (Marquee), and the card carousel (Carousel).
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Star, Quotes } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { skinClasses, type SkinId } from '@/lib/skins';
import { EASE, viewportOnce, stillFor } from '@/lib/motion';

export const meta = {
  id: 'testimonials-rotator',
  category: 'testimonials',
  label: 'Testimonials / Rotator',
  consumes: ['testimonials.eyebrow', 'testimonials.title', 'testimonials.items'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react', '@/lib/skins', '@/lib/motion'],
  skins: ['editorial', 'contrast', 'quiet'],
} as const;

export default function TestimonialsRotator({
  content = CONTENT,
  skin = 'editorial',
}: {
  content?: SiteContent;
  skin?: SkinId;
}) {
  const reduce = useReducedMotion() ?? false;
  const still = stillFor(skin, reduce);
  const s = skinClasses(skin);
  const dark = skin === 'contrast';
  const { testimonials } = content;
  const [active, setActive] = useState(0);
  if (!testimonials.items.length) return null;

  const idx = Math.min(active, testimonials.items.length - 1);
  const t = testimonials.items[idx];

  return (
    <section id="testimonials" className={`px-6 py-24 ${s.section}`}>
      <div className="mx-auto max-w-6xl">
        <motion.div
          className="max-w-xl"
          initial={still ? false : { opacity: 0, y: 14 }}
          whileInView={still ? undefined : { opacity: 1, y: 0 }}
          viewport={viewportOnce}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <p className={`flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] ${s.eyebrow}`}>
            <span className="hidden h-px w-8 bg-accent sm:inline-block" />
            <E p="testimonials.eyebrow">{testimonials.eyebrow}</E>
          </p>
          <h2 className={`mt-4 font-heading text-4xl font-bold leading-[0.95] tracking-[-0.03em] ${s.heading} md:text-5xl`}><E p="testimonials.title">{testimonials.title}</E></h2>
        </motion.div>

        <div className="mt-11 grid gap-8 lg:grid-cols-[1.5fr_1fr] lg:items-start">
          {/* Active quote */}
          <div className={`relative overflow-hidden rounded-3xl border ${s.cardRule} ${s.card} p-8 lg:p-11`}>
            <Quotes size={40} weight="fill" className="text-accent/30" aria-hidden="true" />
            <AnimatePresence mode="wait">
              <motion.blockquote
                key={idx}
                initial={still ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={still ? undefined : { opacity: 0, y: -10 }}
                transition={{ duration: 0.35, ease: EASE }}
              >
                <div className="mt-4 flex gap-0.5">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star key={i} size={18} weight={i < (t.stars ?? 5) ? 'fill' : 'regular'}
                      className={i < (t.stars ?? 5) ? 'text-accent' : (dark ? 'text-ruleInk' : 'text-rule')} />
                  ))}
                </div>
                <p className={`mt-5 font-heading text-2xl font-medium leading-snug tracking-[-0.01em] ${s.heading} md:text-3xl`}>&ldquo;<E p={`testimonials.items.${idx}.q`}>{t.q}</E>&rdquo;</p>
                <footer className="mt-7">
                  <p className={`font-semibold ${s.heading}`}><E p={`testimonials.items.${idx}.a`}>{t.a}</E></p>
                  {(t.r || t.company) && (
                    <p className={`mt-0.5 text-sm ${s.body}`}><E p={`testimonials.items.${idx}.r`}>{t.r}</E>{t.company ? <>, <E p={`testimonials.items.${idx}.company`}>{t.company}</E></> : ''}</p>
                  )}
                </footer>
              </motion.blockquote>
            </AnimatePresence>
          </div>

          {/* Reviewer rail */}
          <ul className={`border-t ${s.rule} ${dark ? 'divide-y divide-ruleInk' : 'divide-y divide-rule'}`}>
            {testimonials.items.map((r, i) => {
              const on = i === idx;
              const rInitial = r.a.charAt(0).toUpperCase();
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => setActive(i)}
                    onMouseEnter={() => setActive(i)}
                    aria-pressed={on}
                    className={`group flex w-full items-center gap-3 border-l-2 py-4 pl-4 pr-3 text-left transition-colors ${
                      on ? `border-accent ${s.card}` : `border-transparent ${dark ? 'hover:bg-inkPanel2' : 'hover:bg-bgSoft'}`
                    }`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ring-1 ${on ? 'bg-accent text-accentFg ring-transparent' : `bg-accent/15 text-accent ring-accent/20`}`}>
                      {rInitial}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate font-semibold ${s.heading}`}><E p={`testimonials.items.${i}.a`}>{r.a}</E></span>
                      {(r.r || r.company) && (
                        <span className={`block truncate text-xs ${s.body}`}><E p={`testimonials.items.${i}.r`}>{r.r}</E>{r.company ? <>, <E p={`testimonials.items.${i}.company`}>{r.company}</E></> : ''}</span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
