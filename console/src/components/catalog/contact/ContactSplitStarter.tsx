'use client';
// ─────────────────────────────────────────────────────────────────────────────
// ContactSplitStarter — starter-tier (email) Contact (see DESIGN-LANGUAGE.md).
// Brand details on the left, an email lead form on the right. Shown only for
// starter clients (plan gating in build/categories.tsx). Email capture:
// name + email + phone (at least one of email/phone) + message → /api/contact.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { PhoneCall, Envelope, MapPin, CheckCircle, ArrowRight } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { skinClasses, type SkinId } from '@/lib/skins';
import { EASE, viewportOnce, stillFor } from '@/lib/motion';

export const meta = {
  id: 'contact-split-starter',
  category: 'contact',
  label: 'Contact / Split — Starter (email)',
  consumes: ['finalCta.eyebrow', 'finalCta.headline', 'finalCta.sub', 'finalCta.cta', 'finalCta.frictionReducers', 'brand.phone', 'brand.phoneHref', 'brand.email', 'brand.address', 'extensions.contactDetails'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react', '@/lib/skins', '@/lib/motion'],
  skins: ['editorial', 'contrast', 'quiet'],
  leadMode: 'email',
} as const;

type Status = 'idle' | 'sending' | 'sent' | 'error';

export default function ContactSplitStarter({
  content = CONTENT,
  skin = 'editorial',
}: {
  content?: SiteContent;
  skin?: SkinId;
}) {
  const reduce = useReducedMotion() ?? false;
  const still = stillFor(skin, reduce);
  const s = skinClasses(skin);
  const { brand, finalCta, extensions } = content;
  const mapsUrl = extensions.contactDetails?.mapsUrl;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
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
        body: JSON.stringify({ name, email, phone, message }),
      });
      setStatus(res.ok ? 'sent' : 'error');
    } catch {
      setStatus('error');
    }
  }

  const field = 'w-full rounded-xl border border-rule bg-bg px-4 py-2.5 text-ink outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent';

  return (
    <section id="contact" className={`px-6 py-24 ${s.section}`}>
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2">
        {/* Left: details */}
        <motion.div
          initial={still ? false : { opacity: 0, x: -16 }}
          whileInView={still ? undefined : { opacity: 1, x: 0 }}
          viewport={viewportOnce}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <p className={`flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] ${s.eyebrow}`}>
            <span className="hidden h-px w-8 bg-accent sm:inline-block" />
            <E p="finalCta.eyebrow">{finalCta.eyebrow}</E>
          </p>
          <h2 className={`mt-4 font-heading text-4xl font-bold leading-[0.95] tracking-[-0.03em] ${s.heading} md:text-5xl`}><E p="finalCta.headline">{finalCta.headline}</E></h2>
          <p className={`mt-4 leading-relaxed ${s.body}`}><E p="finalCta.sub">{finalCta.sub}</E></p>

          <div className="mt-8 space-y-4">
            <a href={brand.phoneHref} className={`flex items-center gap-3 ${s.body} hover:text-accent`}>
              <PhoneCall size={18} className="shrink-0 text-accent" />
              <E p="brand.phone">{brand.phone}</E>
            </a>
            <a href={`mailto:${brand.email}`} className={`flex items-center gap-3 ${s.body} hover:text-accent`}>
              <Envelope size={18} className="shrink-0 text-accent" />
              <E p="brand.email">{brand.email}</E>
            </a>
            {mapsUrl ? (
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className={`flex items-start gap-3 ${s.body} hover:text-accent`}>
                <MapPin size={18} className="mt-0.5 shrink-0 text-accent" />
                <E p="brand.address">{brand.address}</E>
              </a>
            ) : (
              <div className={`flex items-start gap-3 ${s.body}`}>
                <MapPin size={18} className="mt-0.5 shrink-0 text-accent" />
                <E p="brand.address">{brand.address}</E>
              </div>
            )}
          </div>

          {finalCta.frictionReducers.length > 0 && (
            <div className={`mt-8 space-y-3 border-t ${s.rule} pt-8`}>
              {finalCta.frictionReducers.map((r, i) => (
                <div key={r} className={`flex items-center gap-2 text-sm ${s.body}`}>
                  <CheckCircle size={16} weight="fill" className="shrink-0 text-accent" />
                  <E p={`finalCta.frictionReducers.${i}`}>{r}</E>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Right: email form */}
        <motion.div
          initial={still ? false : { opacity: 0, x: 16 }}
          whileInView={still ? undefined : { opacity: 1, x: 0 }}
          viewport={viewportOnce}
          transition={{ duration: 0.5, ease: EASE, delay: 0.07 }}
        >
          {status === 'sent' ? (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <CheckCircle size={52} weight="fill" className="text-accent" />
              <div>
                <p className={`text-lg font-semibold ${s.heading}`}>Message received!</p>
                <p className={`mt-1 ${s.body}`}>We&apos;ll email you back shortly.</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div>
                <label className={`mb-1.5 block text-sm font-medium ${s.heading}`} htmlFor="css-name">Name</label>
                <input id="css-name" type="text" required value={name} onChange={(e) => setName(e.target.value)} className={field} />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className={`mb-1.5 block text-sm font-medium ${s.heading}`} htmlFor="css-email">Email</label>
                  <input id="css-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
                </div>
                <div>
                  <label className={`mb-1.5 block text-sm font-medium ${s.heading}`} htmlFor="css-phone">Phone <span className={s.body}>(optional)</span></label>
                  <input id="css-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={field} />
                </div>
              </div>
              <div>
                <label className={`mb-1.5 block text-sm font-medium ${s.heading}`} htmlFor="css-message">Message</label>
                <textarea id="css-message" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} className={`${field} resize-none`} />
              </div>
              <button type="submit" disabled={status === 'sending'}
                className="flex w-full items-center justify-center gap-2 rounded-sm bg-accent py-3.5 font-semibold text-accentFg transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50"
                style={{ boxShadow: '4px 4px 0px 0px rgba(0,0,0,0.85)' }}>
                {status === 'sending' ? 'Sending...' : <E p="finalCta.cta">{finalCta.cta}</E>}
                {status !== 'sending' && <ArrowRight size={16} weight="bold" />}
              </button>
              {note && <p className="text-center text-sm text-amber-600">{note}</p>}
              {status === 'error' && (
                <p className={`text-center text-sm ${s.body}`}>
                  Could not send. Please email{' '}
                  <a href={`mailto:${brand.email}`} className="text-accent hover:underline">{brand.email}</a>.
                </p>
              )}
            </form>
          )}
        </motion.div>
      </div>
    </section>
  );
}
