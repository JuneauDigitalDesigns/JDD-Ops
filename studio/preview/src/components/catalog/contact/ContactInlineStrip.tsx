'use client';
import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { PhoneCall } from '@phosphor-icons/react';
import { CONTENT } from '@/data/site';

export const meta = {
  id: 'contact-inline-strip',
  category: 'contact',
  label: 'Contact / Inline strip',
  consumes: ['finalCta.eyebrow', 'finalCta.cta', 'brand.phone', 'brand.phoneHref'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react'],
} as const;

type Status = 'idle' | 'loading' | 'done' | 'error';

export default function ContactInlineStrip() {
  const reduce = useReducedMotion() ?? false;
  const { finalCta, brand } = CONTENT;
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, phone }),
      });
      if (!res.ok) throw new Error();
      setStatus('done');
    } catch {
      setStatus('error');
    }
  }

  return (
    <section id="contact" className="border-y border-rule bg-bgSoft py-12">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          className="flex flex-wrap items-center gap-6"
          initial={reduce ? false : { opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="shrink-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-accent">{finalCta.eyebrow}</p>
            <a href={brand.phoneHref}
              className="mt-1 flex items-center gap-1.5 font-heading text-lg font-bold text-ink hover:text-accent">
              <PhoneCall size={20} weight="bold" className="text-accent" />
              {brand.phone}
            </a>
          </div>

          <div className="h-10 w-px bg-rule hidden sm:block" />

          {status === 'done' ? (
            <p className="font-semibold text-accent">We'll call you shortly.</p>
          ) : (
            <form onSubmit={submit} className="flex flex-1 flex-wrap gap-3">
              <input type="text" aria-label="Your name" placeholder="Your name" required value={name}
                onChange={(e) => setName(e.target.value)}
                className="min-w-[140px] flex-1 rounded-lg border border-rule bg-bg px-4 py-2.5 text-sm text-ink outline-none focus:border-accent" />
              <input type="tel" aria-label="Phone number" placeholder="Phone number" required value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="min-w-[140px] flex-1 rounded-lg border border-rule bg-bg px-4 py-2.5 text-sm text-ink outline-none focus:border-accent" />
              <button type="submit" disabled={status === 'loading'}
                className="rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-accentFg transition-opacity hover:opacity-90 disabled:opacity-60">
                {status === 'loading' ? '...' : finalCta.cta}
              </button>
            </form>
          )}
        </motion.div>
        {status === 'error' && <p className="mt-3 text-sm text-red-500">Something went wrong. Please try again.</p>}
      </div>
    </section>
  );
}
