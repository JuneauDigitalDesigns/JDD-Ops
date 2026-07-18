'use client';
// ─────────────────────────────────────────────────────────────────────────────
// ContactBannerStarter — starter-tier (email) Contact (see DESIGN-LANGUAGE.md).
// Full-bleed accent banner with an email quick form. Shown only for starter
// clients. Email capture: name + email + phone (at least one of email/phone)
// → /api/contact.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CheckCircle, ArrowRight } from '@phosphor-icons/react';
import { CONTENT } from '@/data/site';
import type { SiteContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'contact-banner-starter',
  category: 'contact',
  label: 'Contact / Banner — Starter (email)',
  consumes: ['finalCta.eyebrow', 'finalCta.headline', 'finalCta.cta', 'finalCta.frictionReducers', 'brand.email'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react'],
  leadMode: 'email',
} as const;

type Status = 'idle' | 'sending' | 'sent' | 'error';

export default function ContactBannerStarter({ content = CONTENT }: { content?: SiteContent }) {
  const reduce = useReducedMotion() ?? false;
  const { brand, finalCta } = content;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [note, setNote] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setNote('Name is required.'); return; }
    if (!email.trim() && !phone.trim()) { setNote('Add an email or phone so we can reach you back.'); return; }
    setNote('');
    setStatus('sending');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, email, phone }),
      });
      setStatus(res.ok ? 'sent' : 'error');
    } catch {
      setStatus('error');
    }
  }

  const field = 'w-full rounded-lg border border-bg bg-bg px-4 py-2.5 text-ink outline-none focus:ring-2 focus:ring-bg';

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
          <h2 className="mt-2 font-heading text-4xl font-bold tracking-[-0.02em] text-accentFg md:text-5xl"><E p="finalCta.headline">{finalCta.headline}</E></h2>
        </motion.div>

        <div className="mt-8" aria-live="polite" aria-atomic="true">
          {status === 'sent' ? (
            <p className="text-center text-lg font-medium text-accentFg">Thanks! We&apos;ll email you back shortly.</p>
          ) : (
            <form onSubmit={handleSubmit} className="mx-auto max-w-3xl" noValidate>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <input type="text" required aria-label="Your name" placeholder="Your name" value={name}
                  onChange={(e) => setName(e.target.value)} className={`flex-1 ${field}`} />
                <input type="email" aria-label="Email" placeholder="Email" value={email}
                  onChange={(e) => setEmail(e.target.value)} className={`flex-1 ${field}`} />
                <input type="tel" aria-label="Phone (optional)" placeholder="Phone (optional)" value={phone}
                  onChange={(e) => setPhone(e.target.value)} className={`flex-1 ${field}`} />
                <button type="submit" disabled={status === 'sending'}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-sm bg-bg px-6 py-2.5 font-semibold text-accent transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50"
                  style={{ boxShadow: '4px 4px 0px 0px rgba(0,0,0,0.25)' }}>
                  {status === 'sending' ? 'Sending...' : <E p="finalCta.cta">{finalCta.cta}</E>}
                  {status !== 'sending' && <ArrowRight size={16} weight="bold" />}
                </button>
              </div>
              {note && <p className="mt-3 text-sm text-accentFg/90">{note}</p>}
              {status === 'error' && (
                <p className="mt-4 text-sm text-accentFg/90">
                  Could not send. Email us at{' '}
                  <a href={`mailto:${brand.email}`} className="underline">{brand.email}</a>.
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
