'use client';
// ─────────────────────────────────────────────────────────────────────────────
// FinalCtaStarterCentered — starter-tier (email) Final CTA, centered card
// (see DESIGN-LANGUAGE.md). A single contained card: headline + email form.
// Distinct from the starter split / banner / editorial variants.
// Email capture: name + email + phone (at least one of email/phone) + message.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { EnvelopeSimple } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { skinClasses, type SkinId } from '@/lib/skins';
import { EASE, viewportOnce, stillFor } from '@/lib/motion';

export const meta = {
  id: 'finalcta-starter-centered',
  category: 'finalCta',
  label: 'Final CTA / Starter — Card',
  consumes: ['finalCta.eyebrow', 'finalCta.headline', 'finalCta.sub', 'finalCta.cta'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react', '@/lib/skins', '@/lib/motion'],
  skins: ['editorial', 'contrast', 'quiet'],
  leadMode: 'email',
} as const;

type Status = 'idle' | 'loading' | 'done' | 'error';

export default function FinalCtaStarterCentered({
  content = CONTENT,
  skin = 'editorial',
}: {
  content?: SiteContent;
  skin?: SkinId;
}) {
  const reduce = useReducedMotion() ?? false;
  const still = stillFor(skin, reduce);
  const s = skinClasses(skin);
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

  const field = 'w-full rounded-xl border border-rule bg-bg px-4 py-3 text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent';

  return (
    <section id="cta" className={`px-6 py-24 ${s.section}`}>
      <motion.div
        className={`mx-auto max-w-xl rounded-[28px] border ${s.cardRule} ${s.card} p-8 shadow-xl sm:p-10`}
        initial={still ? false : { opacity: 0, y: 18 }}
        whileInView={still ? undefined : { opacity: 1, y: 0 }}
        viewport={viewportOnce}
        transition={{ duration: 0.55, ease: EASE }}
      >
        {status === 'done' ? (
          <div className="rounded-2xl bg-accent/10 p-8 text-center">
            <EnvelopeSimple size={28} weight="fill" className="mx-auto text-accent" />
            <p className={`mt-3 font-heading text-lg font-bold ${s.heading}`}>Thanks — we&apos;ll email you back.</p>
            <p className={`mt-2 text-sm ${s.body}`}>Usually within a business day.</p>
          </div>
        ) : (
          <>
            <div className="text-center">
              <p className={`flex items-center justify-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] ${s.eyebrow}`}>
                <span className="hidden h-px w-8 bg-accent sm:inline-block" />
                <E p="finalCta.eyebrow">{finalCta.eyebrow}</E>
                <span className="hidden h-px w-8 bg-accent sm:inline-block" />
              </p>
              <h2 className={`mt-4 font-heading text-3xl font-bold leading-[0.98] tracking-[-0.02em] ${s.heading} md:text-4xl`}><E p="finalCta.headline">{finalCta.headline}</E></h2>
              <p className={`mx-auto mt-3 max-w-md text-sm leading-relaxed ${s.body}`}><E p="finalCta.sub">{finalCta.sub}</E></p>
            </div>

            <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
              <input type="text" required placeholder="Your name" value={name}
                onChange={(e) => setName(e.target.value)} className={field} />
              <div className="grid gap-4 sm:grid-cols-2">
                <input type="email" placeholder="Email" value={email}
                  onChange={(e) => setEmail(e.target.value)} className={field} />
                <input type="tel" placeholder="Phone (optional)" value={phone}
                  onChange={(e) => setPhone(e.target.value)} className={field} />
              </div>
              <textarea rows={3} placeholder="How can we help?" value={message}
                onChange={(e) => setMessage(e.target.value)} className={`${field} resize-none`} />
              <button type="submit" disabled={status === 'loading'}
                className="w-full rounded-sm bg-accent px-6 py-3.5 font-semibold text-accentFg transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60"
                style={{ boxShadow: '4px 4px 0px 0px rgba(0,0,0,0.85)' }}>
                {status === 'loading' ? 'Sending...' : <E p="finalCta.cta">{finalCta.cta}</E>}
              </button>
              {note && <p className="text-center text-sm text-amber-600">{note}</p>}
              {status === 'error' && <p className="text-center text-sm text-red-500">Something went wrong. Please try again.</p>}
            </form>
          </>
        )}
      </motion.div>
    </section>
  );
}
