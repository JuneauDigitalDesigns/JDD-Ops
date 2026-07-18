'use client';
import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { PhoneCall } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { skinClasses, type SkinId } from '@/lib/skins';
import { EASE, stillFor } from '@/lib/motion';

export const meta = {
  id: 'contact-inline-strip',
  category: 'contact',
  label: 'Contact / Inline strip',
  consumes: ['finalCta.eyebrow', 'finalCta.cta', 'brand.phone', 'brand.phoneHref'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react', '@/lib/skins', '@/lib/motion'],
  skins: ['editorial', 'contrast'],
  leadMode: 'phone',
} as const;

type Status = 'idle' | 'loading' | 'done' | 'error';

export default function ContactInlineStrip({
  content = CONTENT,
  skin = 'editorial',
}: {
  content?: SiteContent;
  skin?: SkinId;
}) {
  const reduce = useReducedMotion() ?? false;
  const still = stillFor(skin, reduce);
  const s = skinClasses(skin);
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
    <section id="contact" className={`border-y ${s.rule} ${s.section} py-12`}>
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          className="flex flex-wrap items-center gap-6"
          initial={still ? false : { opacity: 0, y: 10 }}
          whileInView={still ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.45, ease: EASE }}
        >
          <div className="shrink-0">
            <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${s.eyebrow}`}><E p="finalCta.eyebrow">{finalCta.eyebrow}</E></p>
            <a href={brand.phoneHref}
              className={`mt-1 flex items-center gap-1.5 font-heading text-lg font-bold ${s.heading} hover:text-accent`}>
              <PhoneCall size={20} weight="bold" className="text-accent" />
              <E p="brand.phone">{brand.phone}</E>
            </a>
          </div>

          <div className={`hidden h-10 w-px sm:block ${skin === 'contrast' ? 'bg-ruleInk' : 'bg-rule'}`} />

          {status === 'done' ? (
            <p className="font-semibold text-accent">We&apos;ll call you shortly.</p>
          ) : (
            <form onSubmit={submit} className="flex flex-1 flex-wrap gap-3">
              <input type="text" aria-label="Your name" placeholder="Your name" required value={name}
                onChange={(e) => setName(e.target.value)}
                className="min-w-[140px] flex-1 rounded-lg border border-rule bg-bg px-4 py-2.5 text-sm text-ink outline-none focus:border-accent" />
              <input type="tel" aria-label="Phone number" placeholder="Phone number" required value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="min-w-[140px] flex-1 rounded-lg border border-rule bg-bg px-4 py-2.5 text-sm text-ink outline-none focus:border-accent" />
              <button type="submit" disabled={status === 'loading'}
                className="rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-accentFg transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60">
                {status === 'loading' ? '...' : <E p="finalCta.cta">{finalCta.cta}</E>}
              </button>
            </form>
          )}
        </motion.div>
        {status === 'error' && <p className="mt-3 text-sm text-red-500">Something went wrong. Please try again.</p>}
      </div>
    </section>
  );
}
