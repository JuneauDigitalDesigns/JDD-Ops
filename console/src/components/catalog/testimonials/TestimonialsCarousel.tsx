'use client';
// ─────────────────────────────────────────────────────────────────────────────
// TestimonialsCarousel — recomposed as a horizontal multi-card carousel
// (see DESIGN-LANGUAGE.md). A scroll-snap row showing several quote cards at once
// with arrow nudge controls. Leans into its "Carousel" label; distinct from the
// mosaic (Grid), the giant spotlight (Marquee), and the reviewer-rail (Rotator).
// ─────────────────────────────────────────────────────────────────────────────
import { useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Quotes, Star } from '@phosphor-icons/react';
import { CONTENT } from '@/data/site';
import type { SiteContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'testimonials-carousel',
  category: 'testimonials',
  label: 'Testimonials / Carousel',
  consumes: ['testimonials.eyebrow', 'testimonials.title', 'testimonials.items'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react'],
} as const;

function StarRow({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} size={15} weight={i < count ? 'fill' : 'regular'}
          className={i < count ? 'text-accent' : 'text-rule'} />
      ))}
    </div>
  );
}

export default function TestimonialsCarousel({ content = CONTENT }: { content?: SiteContent }) {
  const reduce = useReducedMotion() ?? false;
  const { testimonials } = content;
  const { items } = testimonials;
  const trackRef = useRef<HTMLDivElement>(null);
  if (!items?.length) return null;

  const nudge = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: reduce ? 'auto' : 'smooth' });
  };

  return (
    <section id="testimonials" className="bg-bgSoft py-20">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          className="flex items-end justify-between gap-6"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="max-w-xl">
            <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] text-accent">
              <span className="hidden h-px w-8 bg-accent sm:inline-block" />
              <E p="testimonials.eyebrow">{testimonials.eyebrow}</E>
            </p>
            <h2 className="mt-4 font-heading text-4xl font-bold leading-[0.95] tracking-[-0.03em] text-ink md:text-5xl"><E p="testimonials.title">{testimonials.title}</E></h2>
          </div>
          {items.length > 1 && (
            <div className="hidden shrink-0 items-center gap-2 sm:flex">
              <button type="button" onClick={() => nudge(-1)} aria-label="Previous"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-rule bg-bg text-ink transition-colors hover:border-accent hover:text-accent">
                <ArrowLeft size={18} />
              </button>
              <button type="button" onClick={() => nudge(1)} aria-label="Next"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-rule bg-bg text-ink transition-colors hover:border-accent hover:text-accent">
                <ArrowRight size={18} />
              </button>
            </div>
          )}
        </motion.div>

        <div
          ref={trackRef}
          className="no-scrollbar mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-pl-6 pb-2"
        >
          {items.map((t, i) => {
            const initial = t.a.charAt(0).toUpperCase();
            return (
              <motion.article
                key={i}
                className="flex w-[300px] shrink-0 snap-start flex-col justify-between rounded-2xl border border-rule bg-bg p-7 sm:w-[360px]"
                initial={reduce ? false : { opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: reduce ? 0 : i * 0.05 }}
              >
                <div>
                  <Quotes size={32} weight="fill" className="text-accent/30" aria-hidden="true" />
                  <div className="mt-3"><StarRow count={t.stars ?? 5} /></div>
                  <p className="mt-3 leading-relaxed text-ink">&ldquo;<E p={`testimonials.items.${i}.q`}>{t.q}</E>&rdquo;</p>
                </div>
                <div className="mt-6 flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent ring-1 ring-accent/20">
                    {initial}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink"><E p={`testimonials.items.${i}.a`}>{t.a}</E></p>
                    {(t.r || t.company) && (
                      <p className="truncate text-sm text-inkSoft"><E p={`testimonials.items.${i}.r`}>{t.r}</E>{t.company ? <>, <E p={`testimonials.items.${i}.company`}>{t.company}</E></> : ''}</p>
                    )}
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
