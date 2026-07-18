'use client';
// ─────────────────────────────────────────────────────────────────────────────
// FinalCtaBanner — recomposed as a dark banner with an inline form bar
// (see DESIGN-LANGUAGE.md). A giant left-aligned headline over a single-row
// name/phone/submit bar. Growth/enterprise: phone capture.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CheckCircle } from '@phosphor-icons/react';
import { CONTENT } from '@/data/site';
import type { SiteContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'finalcta-banner',
  category: 'finalCta',
  label: 'Final CTA / Banner',
  consumes: ['finalCta.eyebrow', 'finalCta.headline', 'finalCta.sub', 'finalCta.cta', 'finalCta.frictionReducers', 'brand.phoneHref'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react'],
  leadMode: 'phone',
} as const;

type Status = 'idle' | 'loading' | 'done' | 'error';

export default function FinalCtaBanner({ content = CONTENT }: { content?: SiteContent }) {
  const reduce = useReducedMotion() ?? false;
  const { finalCta } = content;
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
    <section id="cta" className="relative isolate overflow-hidden bg-ink py-24">
      {/* Accent washes (driven by the client's accent, no hardcoded color) */}
      <div className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(60% 80% at 28% 0%, color-mix(in srgb, var(--accent) 30%, transparent), transparent 70%)' }} />
      <div className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(50% 70% at 100% 100%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 70%)' }} />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-accent/50" />

      <div className="relative mx-auto max-w-5xl px-6">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] text-accent">
            <span className="hidden h-px w-8 bg-accent sm:inline-block" />
            <E p="finalCta.eyebrow">{finalCta.eyebrow}</E>
          </p>
          <h2 className="mt-4 max-w-3xl font-heading text-5xl font-bold leading-[0.92] tracking-[-0.03em] text-bg md:text-6xl"><E p="finalCta.headline">{finalCta.headline}</E></h2>
          <p className="mt-5 max-w-xl text-balance text-bg/70"><E p="finalCta.sub">{finalCta.sub}</E></p>
        </motion.div>

        <motion.div
          className="mt-10"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
        >
          {status === 'done' ? (
            <div className="max-w-lg rounded-xl bg-white/10 p-8">
              <p className="font-heading text-lg font-semibold text-bg">We&apos;ll be in touch soon.</p>
              <p className="mt-2 text-sm text-bg/70">Expect a call or message within the hour.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                type="text" placeholder="Your name" required value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full flex-1 rounded-lg border border-white/20 bg-white/10 px-4 py-3.5 text-bg placeholder-bg/50 outline-none focus:border-accent focus:ring-1 focus:ring-accent"
              />
              <input
                type="tel" placeholder="Phone number" required value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full flex-1 rounded-lg border border-white/20 bg-white/10 px-4 py-3.5 text-bg placeholder-bg/50 outline-none focus:border-accent focus:ring-1 focus:ring-accent"
              />
              <button
                type="submit" disabled={status === 'loading'}
                className="shrink-0 rounded-sm bg-accent px-7 py-3.5 font-semibold text-accentFg transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60"
                style={{ boxShadow: '4px 4px 0px 0px rgba(255,255,255,0.14)' }}
              >
                {status === 'loading' ? 'Sending...' : <E p="finalCta.cta">{finalCta.cta}</E>}
              </button>
            </form>
          )}

          {finalCta.frictionReducers.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-4">
              {finalCta.frictionReducers.map((r, i) => (
                <span key={r} className="flex items-center gap-1.5 text-xs text-bg/60">
                  <CheckCircle size={13} weight="fill" className="text-accent" />
                  <E p={`finalCta.frictionReducers.${i}`}>{r}</E>
                </span>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
