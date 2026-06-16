'use client';
import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { PhoneCall, Envelope, MapPin, CheckCircle, ArrowRight } from '@phosphor-icons/react';
import { CONTENT } from '@/data/site';
import type { SiteContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'contact-split',
  category: 'contact',
  label: 'Contact / Split form + details',
  consumes: ['finalCta.eyebrow', 'finalCta.headline', 'finalCta.sub', 'finalCta.cta', 'finalCta.frictionReducers', 'brand.phone', 'brand.phoneHref', 'brand.email', 'brand.address', 'extensions.contactDetails'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react'],
} as const;

type Status = 'idle' | 'sending' | 'sent' | 'error';

export default function ContactSplit({ content = CONTENT }: { content?: SiteContent }) {
  const reduce = useReducedMotion() ?? false;
  const { brand, finalCta, extensions } = content;
  const mapsUrl = extensions.contactDetails?.mapsUrl;
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const touch = (field: string) => setTouched((p) => ({ ...p, [field]: true }));
  const nameError = touched.name && !name.trim() ? 'Name is required' : '';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ name: true });
    if (!name.trim()) return;
    setStatus('sending');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, phone, message }),
      });
      setStatus(res.ok ? 'sent' : 'error');
    } catch {
      setStatus('error');
    }
  }

  return (
    <section id="contact" className="bg-bg px-6 py-20">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2">
        {/* Left: details */}
        <motion.div
          initial={reduce ? false : { opacity: 0, x: -16 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-accent"><E p="finalCta.eyebrow">{finalCta.eyebrow}</E></p>
          <h2 className="mt-3 font-heading text-3xl text-ink md:text-4xl"><E p="finalCta.headline">{finalCta.headline}</E></h2>
          <p className="mt-3 leading-relaxed text-inkSoft"><E p="finalCta.sub">{finalCta.sub}</E></p>

          <div className="mt-8 space-y-4">
            <a href={brand.phoneHref} className="flex items-center gap-3 text-inkSoft hover:text-accent">
              <PhoneCall size={18} className="shrink-0 text-accent" />
              <E p="brand.phone">{brand.phone}</E>
            </a>
            <a href={`mailto:${brand.email}`} className="flex items-center gap-3 text-inkSoft hover:text-accent">
              <Envelope size={18} className="shrink-0 text-accent" />
              <E p="brand.email">{brand.email}</E>
            </a>
            {mapsUrl ? (
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 text-inkSoft hover:text-accent">
                <MapPin size={18} className="mt-0.5 shrink-0 text-accent" />
                <E p="brand.address">{brand.address}</E>
              </a>
            ) : (
              <div className="flex items-start gap-3 text-inkSoft">
                <MapPin size={18} className="mt-0.5 shrink-0 text-accent" />
                <E p="brand.address">{brand.address}</E>
              </div>
            )}
          </div>

          {finalCta.frictionReducers.length > 0 && (
            <div className="mt-8 space-y-3 border-t border-rule pt-8">
              {finalCta.frictionReducers.map((r, i) => (
                <div key={r} className="flex items-center gap-2 text-sm text-inkSoft">
                  <CheckCircle size={16} weight="fill" className="shrink-0 text-accent" />
                  <E p={`finalCta.frictionReducers.${i}`}>{r}</E>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Right: form */}
        <motion.div
          initial={reduce ? false : { opacity: 0, x: 16 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.07 }}
        >
          {status === 'sent' ? (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <CheckCircle size={52} weight="fill" className="text-accent" />
              <div>
                <p className="text-lg font-semibold text-ink">Message received!</p>
                <p className="mt-1 text-inkSoft">We&apos;ll be in touch shortly.</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="cs-name">Name</label>
                <input id="cs-name" type="text" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => touch('name')}
                  className={`w-full rounded-xl border px-4 py-2.5 text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-rule ${nameError ? 'border-red-400' : 'border-rule bg-bg'}`} />
                {nameError && <p className="mt-1 text-xs text-red-500">{nameError}</p>}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="cs-phone">
                  Phone <span className="text-inkSoft">(optional)</span>
                </label>
                <input id="cs-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-xl border border-rule bg-bg px-4 py-2.5 text-ink outline-none transition-colors focus:border-accent" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-ink" htmlFor="cs-message">Message</label>
                <textarea id="cs-message" rows={4} value={message} onChange={(e) => setMessage(e.target.value)}
                  className="w-full rounded-xl border border-rule bg-bg px-4 py-2.5 text-ink outline-none transition-colors focus:border-accent" />
              </div>
              <button type="submit" disabled={status === 'sending'}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 font-medium text-accentFg transition-opacity hover:opacity-90 disabled:opacity-50">
                {status === 'sending' ? 'Sending...' : <E p="finalCta.cta">{finalCta.cta}</E>}
                {status !== 'sending' && <ArrowRight size={16} />}
              </button>
              {status === 'error' && (
                <p className="text-center text-sm text-inkSoft">
                  Could not send. Please call{' '}
                  <a href={brand.phoneHref} className="text-accent hover:underline">{brand.phone}</a>.
                </p>
              )}
            </form>
          )}
        </motion.div>
      </div>
    </section>
  );
}
