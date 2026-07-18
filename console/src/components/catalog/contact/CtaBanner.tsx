'use client';
import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CheckCircle, ArrowRight } from '@phosphor-icons/react';
import { CONTENT } from '@/data/site';
import type { SiteContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'cta-banner',
  category: 'contact',
  label: 'CTA / Banner with quick form',
  consumes: ['finalCta.eyebrow', 'finalCta.headline', 'finalCta.cta', 'finalCta.frictionReducers', 'brand.phone', 'brand.phoneHref'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react'],
  leadMode: 'phone',
} as const;

type Status = 'idle' | 'sending' | 'sent' | 'error';

export default function CtaBanner({ content = CONTENT }: { content?: SiteContent }) {
  const reduce = useReducedMotion() ?? false;
  const { brand, finalCta } = content;
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, phone }),
      });
      setStatus(res.ok ? 'sent' : 'error');
    } catch {
      setStatus('error');
    }
  }

  return (
    <section id="contact" className="bg-accent px-6 py-20">
      <div className="mx-auto max-w-4xl text-center">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-accentFg/70"><E p="finalCta.eyebrow">{finalCta.eyebrow}</E></p>
          <h2 className="mt-2 font-heading text-3xl text-accentFg"><E p="finalCta.headline">{finalCta.headline}</E></h2>
        </motion.div>

        <div className="mt-8" aria-live="polite" aria-atomic="true">
          {status === 'sent' ? (
            <p className="text-center text-lg font-medium text-accentFg">Thanks! We&apos;ll call you shortly.</p>
          ) : (
            <form onSubmit={handleSubmit} className="mx-auto max-w-2xl">
              <div className="flex flex-wrap items-end justify-center gap-4">
                <div>
                  <label className="mb-1 block text-left text-sm font-medium text-accentFg/90" htmlFor="cta-name">Name</label>
                  <input id="cta-name" type="text" required placeholder="Your name" value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="rounded-lg border border-bg bg-bg px-4 py-2.5 text-ink outline-none focus:ring-2 focus:ring-bg" />
                </div>
                <div>
                  <label className="mb-1 block text-left text-sm font-medium text-accentFg/90" htmlFor="cta-phone">Phone</label>
                  <input id="cta-phone" type="tel" required placeholder={brand.phone} value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="rounded-lg border border-bg bg-bg px-4 py-2.5 text-ink outline-none focus:ring-2 focus:ring-bg" />
                </div>
                <button type="submit" disabled={status === 'sending'}
                  className="inline-flex items-center gap-2 rounded-lg bg-bg px-6 py-2.5 font-semibold text-accent transition-opacity hover:opacity-90 disabled:opacity-50">
                  {status === 'sending' ? 'Sending...' : <E p="finalCta.cta">{finalCta.cta}</E>}
                  {status !== 'sending' && <ArrowRight size={16} />}
                </button>
              </div>
              {status === 'error' && (
                <p className="mt-4 text-sm text-accentFg/90">
                  Could not send. Call us at{' '}
                  <a href={brand.phoneHref} className="underline">{brand.phone}</a>.
                </p>
              )}
            </form>
          )}
        </div>

        {finalCta.frictionReducers.length > 0 && (
          <div className="mt-8 flex flex-wrap items-center justify-center gap-5">
            {finalCta.frictionReducers.map((r, i) => (
              <span key={r} className="flex items-center gap-1.5 text-sm text-accentFg/80">
                <CheckCircle size={15} weight="fill" />
                <E p={`finalCta.frictionReducers.${i}`}>{r}</E>
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
