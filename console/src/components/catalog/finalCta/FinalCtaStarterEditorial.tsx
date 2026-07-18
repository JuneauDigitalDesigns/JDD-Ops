'use client';
// ─────────────────────────────────────────────────────────────────────────────
// FinalCtaStarterEditorial — starter-tier (email) Final CTA, editorial layout
// (see DESIGN-LANGUAGE.md). A breakout headline over a full-width form laid out
// as a horizontal row of underline-style fields. Form-forward and type-led;
// distinct from the starter split / card / banner variants.
// Email capture: name + email + phone (at least one of email/phone) + message.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { skinClasses, type SkinId } from '@/lib/skins';
import { EASE, viewportOnce, stillFor } from '@/lib/motion';

export const meta = {
  id: 'finalcta-starter-editorial',
  category: 'finalCta',
  label: 'Final CTA / Starter — Editorial',
  consumes: ['finalCta.eyebrow', 'finalCta.headline', 'finalCta.sub', 'finalCta.cta'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react', '@/lib/skins', '@/lib/motion'],
  skins: ['editorial', 'contrast'],
  leadMode: 'email',
} as const;

type Status = 'idle' | 'loading' | 'done' | 'error';

export default function FinalCtaStarterEditorial({
  content = CONTENT,
  skin = 'editorial',
}: {
  content?: SiteContent;
  skin?: SkinId;
}) {
  const reduce = useReducedMotion() ?? false;
  const still = stillFor(skin, reduce);
  const s = skinClasses(skin);
  const dark = skin === 'contrast';
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

  const field = `w-full border-b bg-transparent px-0 py-3 outline-none transition-colors focus:border-accent ${
    dark ? 'border-ruleInk text-onInk placeholder:text-onInkSoft/50' : 'border-rule text-ink placeholder:text-inkSoft/60'
  }`;

  return (
    <section id="cta" className={`px-6 py-24 ${s.section}`}>
      <div className="mx-auto max-w-5xl">
        <motion.div
          className="max-w-3xl"
          initial={still ? false : { opacity: 0, y: 16 }}
          whileInView={still ? undefined : { opacity: 1, y: 0 }}
          viewport={viewportOnce}
          transition={{ duration: 0.55, ease: EASE }}
        >
          <p className={`flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] ${s.eyebrow}`}>
            <span className="hidden h-px w-8 bg-accent sm:inline-block" />
            <E p="finalCta.eyebrow">{finalCta.eyebrow}</E>
          </p>
          <h2 className={`mt-4 font-heading text-5xl font-bold leading-[0.92] tracking-[-0.035em] ${s.heading} md:text-6xl`}><E p="finalCta.headline">{finalCta.headline}</E></h2>
          <p className={`mt-4 max-w-xl leading-relaxed ${s.body}`}><E p="finalCta.sub">{finalCta.sub}</E></p>
        </motion.div>

        {status === 'done' ? (
          <div className={`mt-10 border-t ${s.rule} pt-10`}>
            <p className={`font-heading text-2xl font-bold ${s.heading}`}>Thanks — we&apos;ll email you back.</p>
            <p className={`mt-2 ${s.body}`}>Usually within a business day.</p>
          </div>
        ) : (
          <motion.form
            onSubmit={submit}
            noValidate
            className={`mt-12 border-t ${s.rule} pt-10`}
            initial={still ? false : { opacity: 0, y: 16 }}
            whileInView={still ? undefined : { opacity: 1, y: 0 }}
            viewport={viewportOnce}
            transition={{ duration: 0.55, ease: EASE, delay: 0.1 }}
          >
            <div className="grid gap-x-8 gap-y-6 sm:grid-cols-3">
              <input type="text" required placeholder="Your name" value={name}
                onChange={(e) => setName(e.target.value)} className={field} />
              <input type="email" placeholder="Email" value={email}
                onChange={(e) => setEmail(e.target.value)} className={field} />
              <input type="tel" placeholder="Phone (optional)" value={phone}
                onChange={(e) => setPhone(e.target.value)} className={field} />
            </div>
            <div className="mt-6">
              <input type="text" placeholder="How can we help?" value={message}
                onChange={(e) => setMessage(e.target.value)} className={field} />
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              <button type="submit" disabled={status === 'loading'}
                className="group inline-flex items-center gap-2 rounded-sm bg-accent px-8 py-4 font-semibold text-accentFg transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60"
                style={{ boxShadow: dark ? '4px 4px 0px 0px rgba(255,255,255,0.14)' : '4px 4px 0px 0px rgba(0,0,0,0.85)' }}>
                {status === 'loading' ? 'Sending...' : <E p="finalCta.cta">{finalCta.cta}</E>}
                <ArrowRight size={17} weight="bold" className="transition-transform group-hover:translate-x-1" />
              </button>
              {note && <p className="text-sm text-amber-600">{note}</p>}
              {status === 'error' && <p className="text-sm text-red-500">Something went wrong. Please try again.</p>}
            </div>
          </motion.form>
        )}
      </div>
    </section>
  );
}
