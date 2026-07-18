'use client';
// ─────────────────────────────────────────────────────────────────────────────
// TestimonialsMarquee (id: testimonials-spotlight) — recomposed as a Giant
// Pull-Quote (see DESIGN-LANGUAGE.md). One enormous editorial quote framed by an
// oversized glyph, auto-rotating. Leans into its "Spotlight" label; distinct from
// the mosaic (Grid), the reviewer-rail (Rotator), and the card carousel (Carousel).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Star } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { skinClasses, type SkinId } from '@/lib/skins';
import { EASE, stillFor } from '@/lib/motion';

export const meta = {
  id: 'testimonials-spotlight',
  category: 'testimonials',
  label: 'Testimonials / Spotlight',
  consumes: ['testimonials.eyebrow', 'testimonials.title', 'testimonials.items'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react', '@/lib/skins', '@/lib/motion'],
  skins: ['editorial', 'quiet'],
} as const;

export default function TestimonialsMarquee({
  content = CONTENT,
  skin = 'editorial',
}: {
  content?: SiteContent;
  skin?: SkinId;
}) {
  const reduce = useReducedMotion() ?? false;
  const still = stillFor(skin, reduce);
  const s = skinClasses(skin);
  const { testimonials } = content;
  const items = testimonials.items;
  const [idx, setIdx] = useState(0);

  // 'quiet' (and reduced motion) stop the auto-rotate — static single testimonial.
  useEffect(() => {
    if (still || items.length < 2) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % items.length), 6000);
    return () => clearInterval(id);
  }, [still, items.length]);

  if (!items.length) return null;
  const safeIdx = idx < items.length ? idx : 0;
  const t = items[safeIdx];

  return (
    <section id="testimonials" className={`relative isolate overflow-hidden py-28 ${s.section}`}>
      {/* Oversized quotation glyph — the spotlight's signature backdrop */}
      <span aria-hidden className="pointer-events-none absolute -top-10 left-1/2 -z-0 -translate-x-1/2 select-none font-heading text-[22rem] font-black leading-none text-accent/[0.07] md:text-[30rem]">
        &rdquo;
      </span>

      <div className="relative z-10 mx-auto max-w-5xl px-6 text-center">
        <p className={`flex items-center justify-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] ${s.eyebrow}`}>
          <span className="hidden h-px w-8 bg-accent sm:inline-block" />
          <E p="testimonials.eyebrow">{testimonials.eyebrow}</E>
          <span className="hidden h-px w-8 bg-accent sm:inline-block" />
        </p>
        <h2 className={`mt-4 font-heading text-2xl font-bold tracking-[-0.02em] ${s.heading} md:text-3xl`}><E p="testimonials.title">{testimonials.title}</E></h2>

        <AnimatePresence mode="wait">
          <motion.blockquote
            key={safeIdx}
            initial={still ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={still ? undefined : { opacity: 0, y: -12 }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            <div className="mt-12 flex justify-center gap-1">
              {Array.from({ length: 5 }, (_, i) => (
                <Star key={i} size={20} weight="fill" className={i < (t.stars ?? 5) ? 'text-accent' : 'text-rule'} />
              ))}
            </div>
            <p className={`mx-auto mt-8 max-w-4xl font-heading text-3xl font-bold leading-[1.08] tracking-[-0.02em] ${s.heading} md:text-5xl lg:text-6xl`}>
              &ldquo;<E p={`testimonials.items.${safeIdx}.q`}>{t.q}</E>&rdquo;
            </p>
            <footer className="mt-10">
              <p className={`text-lg font-semibold ${s.heading}`}><E p={`testimonials.items.${safeIdx}.a`}>{t.a}</E></p>
              {(t.r || t.company) && (
                <p className={`mt-1 text-sm uppercase tracking-wider ${s.body}`}><E p={`testimonials.items.${safeIdx}.r`}>{t.r}</E>{t.company ? <>, <E p={`testimonials.items.${safeIdx}.company`}>{t.company}</E></> : ''}</p>
              )}
            </footer>
          </motion.blockquote>
        </AnimatePresence>

        {items.length > 1 && (
          <div className="mt-12 flex justify-center gap-2">
            {items.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIdx(i)}
                aria-label={`Testimonial ${i + 1}`}
                className={`h-2 rounded-full transition-all duration-200 ${i === safeIdx ? 'w-6 bg-accent' : 'w-2 bg-rule hover:bg-accent/50'}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
