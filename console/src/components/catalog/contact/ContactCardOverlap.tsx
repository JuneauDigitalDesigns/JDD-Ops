'use client';
import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { PhoneCall, Envelope, MapPin } from '@phosphor-icons/react';
import { CONTENT } from '@/data/site';
import type { SiteContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'contact-card-overlap',
  category: 'contact',
  label: 'Contact / Overlap cards',
  consumes: ['finalCta.headline', 'finalCta.sub', 'brand.phone', 'brand.phoneHref', 'brand.email', 'brand.address', 'extensions.contactDetails'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react'],
} as const;

type Status = 'idle' | 'loading' | 'done' | 'error';

export default function ContactCardOverlap({ content = CONTENT }: { content?: SiteContent }) {
  const reduce = useReducedMotion() ?? false;
  const { finalCta, brand, extensions } = content;
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const mapsUrl = extensions.contactDetails?.mapsUrl;

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
    <section id="contact" className="bg-bgSoft py-24">
      <div className="mx-auto max-w-5xl px-6">
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          {/* Details card */}
          <motion.div
            className="relative overflow-hidden rounded-2xl p-8 text-bg shadow-xl lg:sticky lg:top-24"
            style={{ background: 'radial-gradient(120% 80% at 100% 0%, color-mix(in srgb, var(--accent) 35%, transparent), transparent 60%), var(--ink)' }}
            initial={reduce ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-accent"><E p="finalCta.eyebrow">{finalCta.eyebrow}</E></p>
            <h2 className="mt-3 font-heading text-3xl text-bg"><E p="finalCta.headline">{finalCta.headline}</E></h2>
            <p className="mt-3 text-bg/70"><E p="finalCta.sub">{finalCta.sub}</E></p>
            <div className="mt-8 space-y-4">
              <a href={brand.phoneHref} className="flex items-center gap-3 text-bg/90 hover:text-bg">
                <PhoneCall size={18} className="shrink-0 text-accent" weight="bold" />
                <E p="brand.phone">{brand.phone}</E>
              </a>
              <a href={`mailto:${brand.email}`} className="flex items-center gap-3 text-bg/90 hover:text-bg">
                <Envelope size={18} className="shrink-0 text-accent" />
                <E p="brand.email">{brand.email}</E>
              </a>
              {mapsUrl ? (
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-start gap-3 text-bg/90 hover:text-bg">
                  <MapPin size={18} className="mt-0.5 shrink-0 text-accent" />
                  <E p="brand.address">{brand.address}</E>
                </a>
              ) : (
                <div className="flex items-start gap-3 text-bg/90">
                  <MapPin size={18} className="mt-0.5 shrink-0 text-accent" />
                  <E p="brand.address">{brand.address}</E>
                </div>
              )}
            </div>
          </motion.div>

          {/* Form card */}
          <motion.div
            className="relative z-10 rounded-2xl bg-bg p-8 shadow-xl ring-1 ring-rule lg:-ml-10 lg:mt-12"
            initial={reduce ? false : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.08 }}
          >
            {status === 'done' ? (
              <div className="py-6 text-center">
                <p className="font-heading text-xl font-semibold text-ink">Message received.</p>
                <p className="mt-2 text-inkSoft">We'll be in touch shortly.</p>
              </div>
            ) : (
              <>
                <h3 className="font-heading text-xl font-bold text-ink">Get a free estimate</h3>
                <form onSubmit={submit} className="mt-5 space-y-4">
                  <input type="text" placeholder="Your name" required value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg border border-rule px-4 py-3 text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent" />
                  <input type="tel" placeholder="Phone number" required value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-lg border border-rule px-4 py-3 text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent" />
                  <button type="submit" disabled={status === 'loading'}
                    className="w-full rounded-lg bg-accent py-3.5 font-semibold text-accentFg transition-opacity hover:opacity-90 disabled:opacity-60">
                    {status === 'loading' ? 'Sending...' : <E p="finalCta.cta">{finalCta.cta}</E>}
                  </button>
                  {status === 'error' && <p className="text-center text-sm text-red-500">Something went wrong.</p>}
                </form>
              </>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
