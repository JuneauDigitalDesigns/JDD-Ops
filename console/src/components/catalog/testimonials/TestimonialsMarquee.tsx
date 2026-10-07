'use client';
// ─────────────────────────────────────────────────────────────────────────────
// TestimonialsMarquee — the marquee archetype (see DESIGN-LANGUAGE.md and the Phase 5
// specimen). A drag and scroll driven rail, NOT an autoplaying marquee: SPEC §9's
// autoplay ban survives decision 21, so there is no setInterval. Because it neither
// autoplays nor shows arrows, it needs a VISIBLE scroll affordance (a progress track)
// or an idle rail looks broken.
// ─────────────────────────────────────────────────────────────────────────────
import { useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Quotes, Star } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { skinClasses, type SkinId } from '@/lib/skins';

export const meta = {
  id: 'testimonials-marquee',
  category: 'testimonials',
  label: 'Testimonials / Marquee',
  consumes: ['testimonials.eyebrow', 'testimonials.title', 'testimonials.items'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react', '@/lib/skins'],
  skins: ['soft', 'default'],
  /** Structural archetype, from src/lib/archetypes.ts. Unique within the category. */
  archetype: 'marquee',
  signature: false,
} as const;

function StarRow({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5" aria-hidden="true">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} size={15} weight={i < count ? 'fill' : 'regular'} className={i < count ? 'text-accent' : 'text-rule'} />
      ))}
    </div>
  );
}

export default function TestimonialsMarquee({
  content = CONTENT,
  skin = 'soft',
}: {
  content?: SiteContent;
  skin?: SkinId;
}) {
  const reduce = useReducedMotion() ?? false;
  const s = skinClasses(skin);
  const { testimonials } = content;
  const items = testimonials.items;
  const trackRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  if (!items?.length) return null;

  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setProgress(max > 0 ? el.scrollLeft / max : 0);
  };

  return (
    <section id="testimonials" className={`py-20 ${s.section}`}>
      <div className="mx-auto max-w-6xl px-6">
        <motion.h2
          className={`max-w-xl font-heading text-3xl font-bold tracking-[-0.01em] ${s.heading} md:text-4xl`}
          initial={reduce ? false : { opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <E p="testimonials.title">{testimonials.title}</E>
        </motion.h2>
      </div>

      <div
        ref={trackRef}
        onScroll={onScroll}
        className="no-scrollbar mt-9 flex cursor-grab snap-x snap-proximity gap-5 overflow-x-auto px-6 pb-2"
      >
        {items.map((t, i) => {
          const initial = (t.a ?? '').charAt(0).toUpperCase() || '★';
          return (
            <article
              key={i}
              className={`flex w-[82vw] shrink-0 snap-start flex-col justify-between rounded-2xl border p-7 sm:w-[48vw] lg:w-[31%] ${s.card} ${s.cardRule}`}
            >
              <div>
                <Quotes size={30} weight="fill" className="text-accent/30" aria-hidden="true" />
                <div className="mt-3"><StarRow count={t.stars ?? 5} /></div>
                <p className={`mt-3 leading-relaxed ${s.heading}`}>&ldquo;<E p={`testimonials.items.${i}.q`}>{t.q}</E>&rdquo;</p>
              </div>
              <div className="mt-6">
                <p className={`font-semibold ${s.heading}`}><E p={`testimonials.items.${i}.a`}>{t.a}</E></p>
                {(t.r || t.company) && (
                  <p className={`text-sm ${s.body}`}><E p={`testimonials.items.${i}.r`}>{t.r}</E>{t.company ? <>, <E p={`testimonials.items.${i}.company`}>{t.company}</E></> : ''}</p>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {/* Visible scroll affordance: without autoplay or arrows, the rail needs to show it moves. */}
      <div className="mx-auto mt-4 flex max-w-6xl items-center gap-3 px-6">
        <span className={`text-xs ${s.body}`}>Drag or scroll</span>
        <div className="relative h-[3px] flex-1 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--rule)' }}>
          {(() => {
            const w = Math.max(12, 100 / items.length);
            return (
              <div
                className="absolute inset-y-0 rounded-full"
                style={{ width: `${w}%`, left: `${progress * (100 - w)}%`, backgroundColor: 'var(--ink-soft)' }}
              />
            );
          })()}
        </div>
      </div>
    </section>
  );
}
