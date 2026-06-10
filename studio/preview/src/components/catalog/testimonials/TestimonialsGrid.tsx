'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { Quotes, Star } from '@phosphor-icons/react';
import { CONTENT } from '@/data/site';

export const meta = {
  id: 'testimonials-grid',
  category: 'testimonials',
  label: 'Testimonials / Grid',
  consumes: ['testimonials.eyebrow', 'testimonials.title', 'testimonials.items', 'images.testimonials.avatars'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react'],
} as const;

function StarRow({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} size={14} weight={i < count ? 'fill' : 'regular'}
          className={i < count ? 'text-accent' : 'text-rule'} />
      ))}
    </div>
  );
}

export default function TestimonialsGrid() {
  const reduce = useReducedMotion() ?? false;
  if (!CONTENT.testimonials?.items?.length) return null;
  const { testimonials, images } = CONTENT;
  const avatars = images.testimonials.avatars;
  return (
    <section id="testimonials" className="bg-bgSoft px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">{testimonials.eyebrow}</p>
          <h2 className="mt-2 font-heading text-3xl text-ink md:text-4xl">{testimonials.title}</h2>
        </motion.div>

        <ul className="mt-10 grid gap-6 md:grid-cols-2">
          {testimonials.items.map((t, i) => {
            const initial = t.a.charAt(0).toUpperCase();
            const avatar = avatars?.[i];
            return (
              <motion.li
                key={i}
                className="flex flex-col justify-between rounded-xl border border-rule bg-bg p-7 transition-shadow hover:shadow-md"
                initial={reduce ? false : { opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: i * 0.06 }}
              >
                <div>
                  <Quotes size={32} className="text-rule" aria-hidden="true" />
                  <div className="mt-3"><StarRow count={t.stars ?? 5} /></div>
                  <p className="mt-3 leading-relaxed text-ink">&ldquo;{t.q}&rdquo;</p>
                </div>
                <div className="mt-6 flex items-center gap-3">
                  {avatar ? (
                    <img src={avatar} alt={t.a} loading="lazy"
                      className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-rule" />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bgSoft text-sm font-semibold text-accent ring-1 ring-rule">
                      {initial}
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-ink">{t.a}</p>
                    {(t.r || t.company) && (
                      <p className="text-sm text-inkSoft">{t.r}{t.company ? `, ${t.company}` : ''}</p>
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
