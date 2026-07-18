'use client';
// ─────────────────────────────────────────────────────────────────────────────
// FinalCtaStarterBanner — starter-tier (email) Final CTA, dark banner
// (see DESIGN-LANGUAGE.md). Full-bleed dark field with accent washes, a giant
// headline, and the email form in a translucent card. Distinct from the starter
// split / card / editorial variants.
// Email capture: name + email + phone (at least one of email/phone) + message.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CheckCircle } from '@phosphor-icons/react';
import { CONTENT } from '@/data/site';
import type { SiteContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'finalcta-starter-banner',
  category: 'finalCta',
  label: 'Final CTA / Starter — Banner',
  consumes: ['finalCta.eyebrow', 'finalCta.headline', 'finalCta.sub', 'finalCta.cta', 'finalCta.frictionReducers'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react'],
  leadMode: 'email',
} as const;

type Status = 'idle' | 'loading' | 'done' | 'error';

export default function FinalCtaStarterBanner({ content = CONTENT }: { content?: SiteContent }) {
  const reduce = useReducedMotion() ?? false;
  const { finalCta } = content;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [note, setNote] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() && !phone.trim()) {
      setNote('Add an email or phone so we can reach you back.');
      return;
    }
    setNote('');
    setStatus('loading');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, email, phone, message }),
      });
      if (!res.ok) throw new Error();
      setStatus('done');
    } catch {
      setStatus('error');
    }
  }

  const field = 'w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-bg placeholder-bg/50 outline-none focus:border-accent focus:ring-1 focus:ring-accent';

  return (
    <section id="cta" className="relative isolate overflow-hidden bg-ink py-24">
      <div className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(60% 80% at 22% 0%, color-mix(in srgb, var(--accent) 30%, transparent), transparent 70%)' }} />
      <div className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(50% 70% at 100% 100%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 70%)' }} />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-accent/50" />

      <div className="relative mx-auto grid max-w-5xl gap-10 px-6 lg:grid-cols-2 lg:items-center">
        <motion.div
          initial={reduce ? false : { opacity: 0, x: -16 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] text-accent">
            <span className="hidden h-px w-8 bg-accent sm:inline-block" />
            <E p="finalCta.eyebrow">{finalCta.eyebrow}</E>
          </p>
          <h2 className="mt-4 font-heading text-5xl font-bold leading-[0.92] tracking-[-0.03em] text-bg md:text-6xl"><E p="finalCta.headline">{finalCta.headline}</E></h2>
          <p className="mt-5 max-w-md text-bg/70"><E p="finalCta.sub">{finalCta.sub}</E></p>

          {finalCta.frictionReducers.length > 0 && (
            <div className="mt-7 flex flex-wrap gap-4">
              {finalCta.frictionReducers.map((r, i) => (
                <span key={r} className="flex items-center gap-1.5 text-xs text-bg/60">
                  <CheckCircle size={13} weight="fill" className="text-accent" />
                  <E p={`finalCta.frictionReducers.${i}`}>{r}</E>
                </span>
              ))}
            </div>
          )}
        </motion.div>

        <motion.div
          className="rounded-2xl border border-white/15 bg-white/[0.06] p-7 backdrop-blur-sm"
          initial={reduce ? false : { opacity: 0, x: 16 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
        >
          {status === 'done' ? (
            <div className="rounded-xl bg-white/10 p-8 text-center">
              <p className="font-heading text-lg font-semibold text-bg">Thanks — we&apos;ll email you back.</p>
              <p className="mt-2 text-sm text-bg/70">Usually within a business day.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3" noValidate>
              <input type="text" required placeholder="Your name" value={name}
                onChange={(e) => setName(e.target.value)} className={field} />
              <div className="grid gap-3 sm:grid-cols-2">
                <input type="email" placeholder="Email" value={email}
                  onChange={(e) => setEmail(e.target.value)} className={field} />
                <input type="tel" placeholder="Phone (optional)" value={phone}
                  onChange={(e) => setPhone(e.target.value)} className={field} />
              </div>
              <textarea rows={3} placeholder="How can we help?" value={message}
                onChange={(e) => setMessage(e.target.value)} className={`${field} resize-none`} />
              <button type="submit" disabled={status === 'loading'}
                className="w-full rounded-sm bg-accent px-6 py-3.5 font-semibold text-accentFg transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60"
                style={{ boxShadow: '4px 4px 0px 0px rgba(255,255,255,0.14)' }}>
                {status === 'loading' ? 'Sending...' : <E p="finalCta.cta">{finalCta.cta}</E>}
              </button>
              {note && <p className="text-center text-sm text-amber-300">{note}</p>}
              {status === 'error' && <p className="text-center text-sm text-red-400">Something went wrong. Please try again.</p>}
            </form>
          )}
        </motion.div>
      </div>
    </section>
  );
}
