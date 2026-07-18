'use client';
// ─────────────────────────────────────────────────────────────────────────────
// FinalCtaStarter — the STARTER-tier Final CTA (see DESIGN-LANGUAGE.md).
// Starter clients capture leads by email (Resend), not a phone callback. Asymmetric
// split: pitch on the left, an email form on the right that posts name/email/phone/
// message to /api/contact (the starter route emails the owner from all fields, with
// reply_to = the lead's email). At least one of email/phone is required.
// Shown only when _meta.selectedPlan === 'starter' (see build/categories.tsx).
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CheckCircle, EnvelopeSimple } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { skinClasses, type SkinId } from '@/lib/skins';
import { EASE, viewportOnce, stillFor } from '@/lib/motion';

export const meta = {
  id: 'finalcta-starter',
  category: 'finalCta',
  label: 'Final CTA / Starter (email)',
  consumes: ['finalCta.eyebrow', 'finalCta.headline', 'finalCta.sub', 'finalCta.cta', 'finalCta.frictionReducers', 'brand.email'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react', '@/lib/skins', '@/lib/motion'],
  skins: ['editorial', 'contrast'],
  leadMode: 'email',
} as const;

type Status = 'idle' | 'loading' | 'done' | 'error';

export default function FinalCtaStarter({
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
    // Email or phone — at least one way to reach the lead back.
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
      <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-2 lg:items-center">
        {/* Pitch */}
        <motion.div
          initial={still ? false : { opacity: 0, x: -16 }}
          whileInView={still ? undefined : { opacity: 1, x: 0 }}
          viewport={viewportOnce}
          transition={{ duration: 0.55, ease: EASE }}
        >
          <p className={`flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] ${s.eyebrow}`}>
            <span className="hidden h-px w-8 bg-accent sm:inline-block" />
            <E p="finalCta.eyebrow">{finalCta.eyebrow}</E>
          </p>
          <h2 className={`mt-4 font-heading text-4xl font-bold leading-[0.95] tracking-[-0.03em] ${s.heading} md:text-5xl`}><E p="finalCta.headline">{finalCta.headline}</E></h2>
          <p className={`mt-4 max-w-md leading-relaxed ${s.body}`}><E p="finalCta.sub">{finalCta.sub}</E></p>

          {finalCta.frictionReducers.length > 0 && (
            <ul className="mt-7 space-y-2">
              {finalCta.frictionReducers.map((r, i) => (
                <li key={r} className={`flex items-center gap-2 text-sm ${s.body}`}>
                  <CheckCircle size={16} weight="fill" className="text-accent" />
                  <E p={`finalCta.frictionReducers.${i}`}>{r}</E>
                </li>
              ))}
            </ul>
          )}
        </motion.div>

        {/* Email form */}
        <motion.div
          className={`rounded-2xl border ${s.cardRule} ${s.card} p-8 shadow-xl`}
          initial={still ? false : { opacity: 0, x: 16 }}
          whileInView={still ? undefined : { opacity: 1, x: 0 }}
          viewport={viewportOnce}
          transition={{ duration: 0.55, ease: EASE, delay: 0.1 }}
        >
          {status === 'done' ? (
            <div className="rounded-2xl bg-accent/10 p-8 text-center">
              <EnvelopeSimple size={28} weight="fill" className="mx-auto text-accent" />
              <p className={`mt-3 font-heading text-lg font-bold ${s.heading}`}>Thanks — we&apos;ll email you back.</p>
              <p className={`mt-2 text-sm ${s.body}`}>Usually within a business day.</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4" noValidate>
              <div>
                <label className={`mb-1.5 block text-sm font-medium ${s.heading}`}>Your name</label>
                <input type="text" required placeholder="Jane Smith" value={name}
                  onChange={(e) => setName(e.target.value)} className={field} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={`mb-1.5 block text-sm font-medium ${s.heading}`}>Email</label>
                  <input type="email" placeholder="jane@email.com" value={email}
                    onChange={(e) => setEmail(e.target.value)} className={field} />
                </div>
                <div>
                  <label className={`mb-1.5 block text-sm font-medium ${s.heading}`}>Phone <span className={`font-normal ${s.body}`}>(optional)</span></label>
                  <input type="tel" placeholder="(907) 555-0100" value={phone}
                    onChange={(e) => setPhone(e.target.value)} className={field} />
                </div>
              </div>
              <div>
                <label className={`mb-1.5 block text-sm font-medium ${s.heading}`}>How can we help?</label>
                <textarea rows={3} placeholder="Tell us about the job…" value={message}
                  onChange={(e) => setMessage(e.target.value)} className={`${field} resize-none`} />
              </div>
              <button type="submit" disabled={status === 'loading'}
                className="w-full rounded-sm bg-accent px-6 py-3.5 font-semibold text-accentFg transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60"
                style={{ boxShadow: '4px 4px 0px 0px rgba(0,0,0,0.85)' }}>
                {status === 'loading' ? 'Sending...' : <E p="finalCta.cta">{finalCta.cta}</E>}
              </button>
              {note && <p className="text-center text-sm text-amber-600">{note}</p>}
              {status === 'error' && (
                <p className="text-center text-sm text-red-500">Something went wrong. Please try again.</p>
              )}
            </form>
          )}
        </motion.div>
      </div>
    </section>
  );
}
