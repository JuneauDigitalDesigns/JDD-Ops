'use client';
// ─────────────────────────────────────────────────────────────────────────────
// ContactOverlapStarter — starter-tier (email) Contact (see DESIGN-LANGUAGE.md).
// Dark accent-lit details panel with the email form card overlapping its edge.
// Shown only for starter clients. Email capture: name + email + phone (at least
// one of email/phone) + message → /api/contact.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { PhoneCall, Envelope, MapPin } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { skinClasses, type SkinId } from '@/lib/skins';
import { EASE, viewportOnce, stillFor } from '@/lib/motion';

export const meta = {
  id: 'contact-overlap-starter',
  category: 'contact',
  label: 'Contact / Overlap — Starter (email)',
  consumes: ['finalCta.eyebrow', 'finalCta.headline', 'finalCta.sub', 'finalCta.cta', 'brand.phone', 'brand.phoneHref', 'brand.email', 'brand.address', 'extensions.contactDetails'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react', '@/lib/skins', '@/lib/motion'],
  skins: ['editorial', 'contrast'],
  leadMode: 'email',
} as const;

type Status = 'idle' | 'loading' | 'done' | 'error';

export default function ContactOverlapStarter({
  content = CONTENT,
  skin = 'editorial',
}: {
  content?: SiteContent;
  skin?: SkinId;
}) {
  const reduce = useReducedMotion() ?? false;
  const still = stillFor(skin, reduce);
  const s = skinClasses(skin);
  const { finalCta, brand, extensions } = content;
  const mapsUrl = extensions.contactDetails?.mapsUrl;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [note, setNote] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setNote('Name is required.'); return; }
    if (!email.trim() && !phone.trim()) { setNote('Add an email or phone so we can reach you back.'); return; }
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
    <section id="contact" className={`py-24 ${s.section}`}>
      <div className="mx-auto max-w-5xl px-6">
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          {/* Details card — dark, accent-lit panel */}
          <motion.div
            className="relative overflow-hidden rounded-[28px] p-8 text-onInk shadow-xl lg:sticky lg:top-24"
            style={{ background: 'radial-gradient(120% 80% at 100% 0%, color-mix(in srgb, var(--accent) 35%, transparent), transparent 60%), var(--ink-panel)' }}
            initial={still ? false : { opacity: 0, y: 16 }}
            whileInView={still ? undefined : { opacity: 1, y: 0 }}
            viewport={viewportOnce}
            transition={{ duration: 0.5, ease: EASE }}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent200"><E p="finalCta.eyebrow">{finalCta.eyebrow}</E></p>
            <h2 className="mt-3 font-heading text-3xl font-bold tracking-[-0.02em] text-onInk md:text-4xl"><E p="finalCta.headline">{finalCta.headline}</E></h2>
            <p className="mt-3 text-onInkSoft"><E p="finalCta.sub">{finalCta.sub}</E></p>
            <div className="mt-8 space-y-4">
              <a href={brand.phoneHref} className="flex items-center gap-3 text-onInk/90 hover:text-onInk">
                <PhoneCall size={18} className="shrink-0 text-accent" weight="bold" />
                <E p="brand.phone">{brand.phone}</E>
              </a>
              <a href={`mailto:${brand.email}`} className="flex items-center gap-3 text-onInk/90 hover:text-onInk">
                <Envelope size={18} className="shrink-0 text-accent" />
                <E p="brand.email">{brand.email}</E>
              </a>
              {mapsUrl ? (
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 text-onInk/90 hover:text-onInk">
                  <MapPin size={18} className="mt-0.5 shrink-0 text-accent" />
                  <E p="brand.address">{brand.address}</E>
                </a>
              ) : (
                <div className="flex items-start gap-3 text-onInk/90">
                  <MapPin size={18} className="mt-0.5 shrink-0 text-accent" />
                  <E p="brand.address">{brand.address}</E>
                </div>
              )}
            </div>
          </motion.div>

          {/* Email form card — overlaps */}
          <motion.div
            className={`relative z-10 rounded-[28px] border ${s.cardRule} ${s.card} p-8 shadow-xl lg:-ml-10 lg:mt-12`}
            initial={still ? false : { opacity: 0, y: 24 }}
            whileInView={still ? undefined : { opacity: 1, y: 0 }}
            viewport={viewportOnce}
            transition={{ duration: 0.5, ease: EASE, delay: 0.08 }}
          >
            {status === 'done' ? (
              <div className="py-6 text-center">
                <p className={`font-heading text-xl font-bold ${s.heading}`}>Message received.</p>
                <p className={`mt-2 ${s.body}`}>We&apos;ll email you back shortly.</p>
              </div>
            ) : (
              <>
                <h3 className={`font-heading text-xl font-bold ${s.heading}`}>Get a free estimate</h3>
                <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
                  <input type="text" placeholder="Your name" required value={name}
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
                    className="w-full rounded-sm bg-accent py-3.5 font-semibold text-accentFg transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60"
                    style={{ boxShadow: '4px 4px 0px 0px rgba(0,0,0,0.85)' }}>
                    {status === 'loading' ? 'Sending...' : <E p="finalCta.cta">{finalCta.cta}</E>}
                  </button>
                  {note && <p className="text-center text-sm text-amber-600">{note}</p>}
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
