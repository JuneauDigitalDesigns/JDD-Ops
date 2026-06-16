'use client';
import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CheckCircle, PhoneCall } from '@phosphor-icons/react';
import { CONTENT } from '@/data/site';
import type { SiteContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'finalcta-split',
  category: 'finalCta',
  label: 'Final CTA / Split',
  consumes: ['finalCta.eyebrow', 'finalCta.headline', 'finalCta.sub', 'finalCta.cta', 'finalCta.secondary', 'finalCta.frictionReducers', 'brand.phoneHref'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react'],
} as const;

type Status = 'idle' | 'loading' | 'done' | 'error';

export default function FinalCtaSplit({ content = CONTENT }: { content?: SiteContent }) {
  const reduce = useReducedMotion() ?? false;
  const { finalCta, brand } = content;
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
    <section id="cta" className="bg-bg py-20">
      <div className="mx-auto max-w-5xl px-6">
        <div className="grid gap-12 rounded-2xl border border-rule bg-bgSoft p-10 lg:grid-cols-2 lg:items-center">
          {/* Copy */}
          <motion.div
            initial={reduce ? false : { opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-accent"><E p="finalCta.eyebrow">{finalCta.eyebrow}</E></p>
            <h2 className="mt-3 font-heading text-3xl text-ink"><E p="finalCta.headline">{finalCta.headline}</E></h2>
            <p className="mt-4 leading-relaxed text-inkSoft"><E p="finalCta.sub">{finalCta.sub}</E></p>

            {finalCta.frictionReducers.length > 0 && (
              <ul className="mt-6 space-y-2">
                {finalCta.frictionReducers.map((r, i) => (
                  <li key={r} className="flex items-center gap-2 text-sm text-inkSoft">
                    <CheckCircle size={15} weight="fill" className="text-accent" />
                    <E p={`finalCta.frictionReducers.${i}`}>{r}</E>
                  </li>
                ))}
              </ul>
            )}

            {finalCta.secondary && (
              <a href={brand.phoneHref} className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-ink hover:text-accent">
                <PhoneCall size={16} weight="bold" className="text-accent" />
                <E p="finalCta.secondary">{finalCta.secondary}</E>
              </a>
            )}
          </motion.div>

          {/* Form */}
          <motion.div
            initial={reduce ? false : { opacity: 0, x: 16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.07 }}
          >
            {status === 'done' ? (
              <div className="rounded-xl bg-accent/10 p-8 text-center">
                <p className="font-heading text-lg font-semibold text-ink">We'll be in touch soon.</p>
                <p className="mt-2 text-sm text-inkSoft">Expect a call within the hour.</p>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink">Your name</label>
                  <input type="text" required placeholder="Jane Smith" value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg border border-rule bg-bg px-4 py-3 text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-ink">Phone number</label>
                  <input type="tel" required placeholder="(907) 555-0100" value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-lg border border-rule bg-bg px-4 py-3 text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent" />
                </div>
                <button type="submit" disabled={status === 'loading'}
                  className="w-full rounded-lg bg-accent px-6 py-3.5 font-semibold text-accentFg transition-opacity hover:opacity-90 disabled:opacity-60">
                  {status === 'loading' ? 'Sending...' : <E p="finalCta.cta">{finalCta.cta}</E>}
                </button>
                {status === 'error' && (
                  <p className="text-center text-sm text-red-500">Something went wrong. Please try again.</p>
                )}
              </form>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
