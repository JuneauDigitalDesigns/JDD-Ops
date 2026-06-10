'use client';
import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CheckCircle } from '@phosphor-icons/react';
import { CONTENT } from '@/data/site';

export const meta = {
  id: 'finalcta-banner',
  category: 'finalCta',
  label: 'Final CTA / Banner',
  consumes: ['finalCta.eyebrow', 'finalCta.headline', 'finalCta.sub', 'finalCta.cta', 'finalCta.frictionReducers', 'brand.phoneHref'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react'],
} as const;

type Status = 'idle' | 'loading' | 'done' | 'error';

export default function FinalCtaBanner() {
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
    <section id="cta" className="relative overflow-hidden bg-ink py-24">
      {/* Accent washes (driven by the client's accent, no hardcoded color) */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(60% 80% at 28% 0%, color-mix(in srgb, var(--accent) 30%, transparent), transparent 70%)' }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(50% 70% at 100% 100%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 70%)' }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-accent/50" />

      <div className="relative mx-auto max-w-3xl px-6">
        <motion.div
          className="text-center"
          initial={reduce ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">{finalCta.eyebrow}</p>
          <h2 className="mt-3 font-heading text-4xl text-bg md:text-5xl">{finalCta.headline}</h2>
          <p className="mx-auto mt-4 max-w-xl text-balance text-bg/70">{finalCta.sub}</p>
        </motion.div>

        <motion.div
          className="mx-auto mt-10 max-w-lg"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
        >
          {status === 'done' ? (
            <div className="rounded-xl bg-white/10 p-8 text-center">
              <p className="font-heading text-lg font-semibold text-bg">We'll be in touch soon.</p>
              <p className="mt-2 text-sm text-bg/70">Expect a call or message within the hour.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  type="text" placeholder="Your name" required value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-bg placeholder-bg/50 outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                />
                <input
                  type="tel" placeholder="Phone number" required value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-bg placeholder-bg/50 outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                />
              </div>
              <button
                type="submit" disabled={status === 'loading'}
                className="w-full rounded-lg bg-accent px-6 py-3.5 font-semibold text-accentFg transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {status === 'loading' ? 'Sending...' : finalCta.cta}
              </button>
              {status === 'error' && (
                <p className="text-center text-sm text-red-400">Something went wrong. Please try again.</p>
              )}
            </form>
          )}

          {finalCta.frictionReducers.length > 0 && (
            <div className="mt-5 flex flex-wrap justify-center gap-4">
              {finalCta.frictionReducers.map((r) => (
                <span key={r} className="flex items-center gap-1.5 text-xs text-bg/60">
                  <CheckCircle size={13} weight="fill" className="text-accent" />
                  {r}
                </span>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
