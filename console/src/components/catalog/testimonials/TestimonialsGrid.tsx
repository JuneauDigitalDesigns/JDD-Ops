'use client';
// ─────────────────────────────────────────────────────────────────────────────
// TestimonialsGrid — recomposed as a Quote Mosaic (see DESIGN-LANGUAGE.md).
// Asymmetric hero-first grid: one wide featured pull-quote + supporting cards,
// grid-flow-dense so it never gaps. Distinct from the rotator/marquee/carousel.
// ─────────────────────────────────────────────────────────────────────────────
import { motion, useReducedMotion } from 'framer-motion';
import { Quotes, Star } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { skinClasses, type SkinId } from '@/lib/skins';
import { EASE, viewportOnce, stillFor } from '@/lib/motion';

export const meta = {
  id: 'testimonials-grid',
  category: 'testimonials',
  label: 'Testimonials / Grid',
  consumes: ['testimonials.eyebrow', 'testimonials.title', 'testimonials.items', 'images.testimonials.avatars'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react', '@/lib/skins', '@/lib/motion'],
  skins: ['editorial', 'contrast'],
} as const;

function StarRow({ count, muted }: { count: number; muted: string }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} size={14} weight={i < count ? 'fill' : 'regular'}
          className={i < count ? 'text-accent' : muted} />
      ))}
    </div>
  );
}

export default function TestimonialsGrid({
  content = CONTENT,
  skin = 'editorial',
}: {
  content?: SiteContent;
  skin?: SkinId;
}) {
  const reduce = useReducedMotion() ?? false;
  const still = stillFor(skin, reduce);
  const s = skinClasses(skin);
  const { testimonials, images } = content;
  if (!testimonials?.items?.length) return null;
  const avatars = images.testimonials.avatars;
  const muted = skin === 'contrast' ? 'text-ruleInk' : 'text-rule';
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

        <ul className="mt-11 grid grid-flow-dense gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.items.map((t, i) => {
            const initial = t.a.charAt(0).toUpperCase();
            const avatar = avatars?.[i];
            const featured = i === 0;
            return (
              <motion.li
                key={i}
                className={`flex flex-col justify-between rounded-2xl border ${s.cardRule} ${s.card} p-7 transition-shadow hover:shadow-md ${featured ? 'sm:col-span-2' : ''}`}
                initial={still ? false : { opacity: 0, y: 16 }}
                whileInView={still ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ duration: 0.45, ease: EASE, delay: still ? 0 : i * 0.06 }}
              >
                <div>
                  <Quotes size={featured ? 48 : 32} weight="fill" className="text-accent/30" aria-hidden="true" />
                  <div className="mt-3"><StarRow count={t.stars ?? 5} muted={muted} /></div>
                  <p className={`mt-3 leading-relaxed ${s.heading} ${featured ? 'font-heading text-2xl font-medium leading-snug tracking-[-0.01em] md:text-3xl' : ''}`}>&ldquo;<E p={`testimonials.items.${i}.q`}>{t.q}</E>&rdquo;</p>
                </div>
                <div className="mt-6 flex items-center gap-3">
                  {avatar ? (
                    <img src={avatar} alt={t.a} loading="lazy"
                      className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-accent/20" />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent ring-1 ring-accent/20">
                      {initial}
                    </div>
                  )}
                  <div>
                    <p className={`font-semibold ${s.heading}`}><E p={`testimonials.items.${i}.a`}>{t.a}</E></p>
                    {(t.r || t.company) && (
                      <p className={`text-sm ${s.body}`}><E p={`testimonials.items.${i}.r`}>{t.r}</E>{t.company ? <>, <E p={`testimonials.items.${i}.company`}>{t.company}</E></> : ''}</p>
                    )}
                  </div>
                </div>
              </motion.li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
