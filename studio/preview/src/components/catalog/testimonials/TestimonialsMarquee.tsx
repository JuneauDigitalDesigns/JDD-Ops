'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { Star } from '@phosphor-icons/react';
import { CONTENT } from '@/data/site';

export const meta = {
  id: 'testimonials-marquee',
  category: 'testimonials',
  label: 'Testimonials / Marquee',
  consumes: ['testimonials.eyebrow', 'testimonials.title', 'testimonials.items'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react'],
} as const;

function QuoteCard({ q, a, r, company, stars }: { q: string; a: string; r: string; company?: string; stars: number }) {
  return (
    <div className="w-72 shrink-0 rounded-xl border border-rule bg-bg p-5">
      <div className="flex gap-0.5 mb-3">
        {Array.from({ length: 5 }, (_, i) => (
          <Star key={i} size={13} weight={i < stars ? 'fill' : 'regular'}
            className={i < stars ? 'text-accent' : 'text-rule'} />
        ))}
      </div>
      <p className="text-sm leading-relaxed text-ink line-clamp-4">&ldquo;{q}&rdquo;</p>
      <div className="mt-4 border-t border-rule pt-3">
        <p className="text-xs font-semibold text-ink">{a}</p>
        <p className="text-xs text-inkSoft">{r}{company ? `, ${company}` : ''}</p>
      </div>
    </div>
  );
}

export default function TestimonialsMarquee() {
  const reduce = useReducedMotion() ?? false;
  const { testimonials } = CONTENT;
  if (!testimonials.items.length) return null;

  const items = testimonials.items;
  const row1 = [...items, ...items];
  const row2 = [...items, ...items].reverse();

  if (reduce) {
    return (
      <section id="testimonials" className="bg-bgSoft py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-8 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-accent">{testimonials.eyebrow}</p>
            <h2 className="mt-2 font-heading text-3xl font-bold text-ink">{testimonials.title}</h2>
          </div>
          <div className="flex flex-wrap gap-4 justify-center">
            {items.map((t, i) => <QuoteCard key={i} {...t} />)}
          </div>
        </div>
      </section>
    );
  }

  const maskStyle = {
    WebkitMaskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
    maskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
  };

  return (
    <section id="testimonials" className="bg-bgSoft py-16 overflow-hidden">
      <div className="mx-auto max-w-6xl px-6 mb-10 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">{testimonials.eyebrow}</p>
        <h2 className="mt-2 font-heading text-3xl font-bold text-ink">{testimonials.title}</h2>
      </div>

      <div className="space-y-4">
        <div className="overflow-hidden" style={maskStyle}>
          <motion.div className="flex gap-4" style={{ width: 'max-content' }}
            animate={{ x: ['0%', '-50%'] }}
            transition={{ duration: 30, ease: 'linear', repeat: Infinity }}>
            {row1.map((t, i) => <QuoteCard key={i} {...t} />)}
          </motion.div>
        </div>

        <div className="overflow-hidden" style={maskStyle}>
          <motion.div className="flex gap-4" style={{ width: 'max-content' }}
            animate={{ x: ['-50%', '0%'] }}
            transition={{ duration: 35, ease: 'linear', repeat: Infinity }}>
            {row2.map((t, i) => <QuoteCard key={i} {...t} />)}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
