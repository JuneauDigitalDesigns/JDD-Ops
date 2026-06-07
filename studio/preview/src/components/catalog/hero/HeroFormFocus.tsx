'use client';
import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CheckCircle } from '@phosphor-icons/react';
import { CONTENT } from '@/data/site';

export const meta = {
  id: 'hero-form',
  category: 'hero',
  label: 'Hero / Lead form',
  consumes: ['hero.eyebrow', 'hero.headline', 'hero.headlineEmphasis', 'hero.sub', 'hero.formLabel', 'hero.cta', 'hero.frictionReducers'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react'],
} as const;

type Status = 'idle' | 'loading' | 'done' | 'error';

function Headline({ text, emphasis }: { text: string; emphasis: string | null }) {
  if (!emphasis) return <>{text}</>;
  const idx = text.indexOf(emphasis);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span className="text-accent">{emphasis}</span>
      {text.slice(idx + emphasis.length)}
    </>
  );
}

export default function HeroFormFocus() {
  const reduce = useReducedMotion() ?? false;
  const { hero } = CONTENT;
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
    <section className="bg-bg py-20">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-6 lg:grid-cols-2 lg:items-center">
        {/* Copy */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">{hero.eyebrow}</p>
          <h1 className="mt-3 font-heading text-4xl font-bold leading-tight text-ink md:text-5xl">
            <Headline text={hero.headline} emphasis={hero.headlineEmphasis} />
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-inkSoft">{hero.sub}</p>

          {hero.frictionReducers.length > 0 && (
            <ul className="mt-8 space-y-2.5">
              {hero.frictionReducers.map((r) => (
                <li key={r} className="flex items-center gap-2.5 text-inkSoft">
                  <CheckCircle size={17} weight="fill" className="shrink-0 text-accent" />
                  {r}
                </li>
              ))}
            </ul>
          )}
        </motion.div>

        {/* Form */}
        <motion.div
          className="rounded-2xl border border-rule bg-bgSoft p-8"
          initial={reduce ? false : { opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
        >
          {status === 'done' ? (
            <div className="py-6 text-center">
              <p className="font-heading text-xl font-semibold text-ink">We'll call you shortly.</p>
              <p className="mt-2 text-inkSoft">Expect to hear from us within the hour.</p>
            </div>
          ) : (
            <>
              <p className="font-heading text-lg font-semibold text-ink">{hero.formLabel}</p>
              <form onSubmit={submit} className="mt-5 space-y-4">
                <input type="text" placeholder="Your name" required value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-rule bg-bg px-4 py-3 text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent" />
                <input type="tel" placeholder="Phone number" required value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-lg border border-rule bg-bg px-4 py-3 text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent" />
                <button type="submit" disabled={status === 'loading'}
                  className="w-full rounded-lg bg-accent py-3.5 font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-60">
                  {status === 'loading' ? 'Sending...' : hero.cta}
                </button>
                {status === 'error' && (
                  <p className="text-center text-sm text-red-500">Something went wrong. Please try again.</p>
                )}
              </form>
            </>
          )}
        </motion.div>
      </div>
    </section>
  );
}
