'use client';
import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CheckCircle } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E, useEditing } from '@/lib/editable';
import { skinClasses, type SkinId } from '@/lib/skins';
import { EASE, viewportOnce, stillFor } from '@/lib/motion';

export const meta = {
  id: 'hero-form',
  category: 'hero',
  label: 'Hero / Lead form',
  consumes: ['hero.eyebrow', 'hero.headline', 'hero.headlineEmphasis', 'hero.sub', 'hero.formLabel', 'hero.cta', 'hero.frictionReducers'],
  sharedDeps: ['framer-motion', '@phosphor-icons/react', '@/lib/skins', '@/lib/motion'],
  skins: ['editorial', 'quiet'],
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

export default function HeroFormFocus({
  content = CONTENT,
  skin = 'editorial',
}: {
  content?: SiteContent;
  skin?: SkinId;
}) {
  const reduce = useReducedMotion() ?? false;
  const editing = useEditing();
  const still = stillFor(skin, reduce);
  const s = skinClasses(skin);
  const { hero } = content;
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
    <section className={`py-24 ${s.section}`}>
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-14 px-6 lg:grid-cols-2 lg:items-center">
        {/* Copy */}
        <motion.div
          initial={still ? false : { opacity: 0, y: 20 }}
          whileInView={still ? undefined : { opacity: 1, y: 0 }}
          viewport={viewportOnce}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${s.eyebrow}`}>
            <E p="hero.eyebrow">{hero.eyebrow}</E>
          </p>
          <h1 className={`mt-4 font-heading text-5xl font-bold leading-[0.98] tracking-[-0.02em] ${s.heading} md:text-6xl`}>
            {editing
              ? <E p="hero.headline" fit>{hero.headline}</E>
              : <Headline text={hero.headline} emphasis={hero.headlineEmphasis} />}
          </h1>
          <p className={`mt-6 text-lg leading-relaxed ${s.body}`}><E p="hero.sub">{hero.sub}</E></p>

          {hero.frictionReducers.length > 0 && (
            <ul className="mt-9 space-y-3">
              {hero.frictionReducers.map((r, i) => (
                <li key={r} className={`flex items-center gap-2.5 ${s.body}`}>
                  <CheckCircle size={17} weight="fill" className="shrink-0 text-accent" />
                  <E p={`hero.frictionReducers.${i}`}>{r}</E>
                </li>
              ))}
            </ul>
          )}
        </motion.div>

        {/* Form card — always a bright, high-contrast surface for conversion clarity */}
        <motion.div
          className="rounded-3xl border border-rule bg-bg p-8 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.25)]"
          initial={still ? false : { opacity: 0, x: 20 }}
          whileInView={still ? undefined : { opacity: 1, x: 0 }}
          viewport={viewportOnce}
          transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
        >
          {status === 'done' ? (
            <div className="py-6 text-center">
              <CheckCircle size={36} weight="fill" className="mx-auto text-accent" />
              <p className="mt-3 font-heading text-xl font-semibold text-ink">We&apos;ll call you shortly.</p>
              <p className="mt-2 text-inkSoft">Expect to hear from us within the hour.</p>
            </div>
          ) : (
            <>
              <p className="font-heading text-lg font-semibold text-ink"><E p="hero.formLabel">{hero.formLabel}</E></p>
              <form onSubmit={submit} className="mt-5 space-y-4">
                <input type="text" placeholder="Your name" required value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-rule bg-bg px-4 py-3 text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent" />
                <input type="tel" placeholder="Phone number" required value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-xl border border-rule bg-bg px-4 py-3 text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent" />
                <button type="submit" disabled={status === 'loading'}
                  className="w-full rounded-xl bg-accent py-3.5 font-semibold text-accentFg shadow-[0_10px_30px_-10px_var(--accent-glow)] transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60">
                  {status === 'loading' ? 'Sending...' : <E p="hero.cta">{hero.cta}</E>}
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
