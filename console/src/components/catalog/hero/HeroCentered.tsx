'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { PhoneCall, CheckCircle } from '@phosphor-icons/react';
import { CONTENT } from '@/data/site';
import type { SiteContent } from '@/data/site';
import { E, useEditing } from '@/lib/editable';

export const meta = {
  id: 'hero-centered',
  category: 'hero',
  label: 'Hero / Centered',
  consumes: [
    'hero.eyebrow', 'hero.headline', 'hero.headlineEmphasis', 'hero.sub',
    'hero.badge', 'hero.cta', 'hero.secondaryCta', 'hero.frictionReducers', 'hero.heroBullets',
    'brand.phoneHref',
  ],
  sharedDeps: ['framer-motion', '@phosphor-icons/react'],
} as const;

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

export default function HeroCentered({ content = CONTENT }: { content?: SiteContent }) {
  const reduce = useReducedMotion() ?? false;
  const editing = useEditing();
  const { hero, brand } = content;

  return (
    <section className="bg-bgSoft px-6 py-20 text-center">
      <div className="mx-auto max-w-3xl">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          {hero.badge && (
            <div className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-rule bg-bg px-4 py-1.5 text-xs font-medium text-inkSoft">
              <E p="hero.badge">{hero.badge}</E>
            </div>
          )}

          <p className="text-sm font-semibold uppercase tracking-widest text-accent"><E p="hero.eyebrow">{hero.eyebrow}</E></p>

          <h1 className="mt-4 font-heading text-4xl leading-tight text-ink md:text-5xl lg:text-6xl">
            {editing
              ? <E p="hero.headline" fit>{hero.headline}</E>
              : <Headline text={hero.headline} emphasis={hero.headlineEmphasis} />}
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-inkSoft"><E p="hero.sub">{hero.sub}</E></p>

          {/* CTAs */}
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <a
              href="#cta"
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-7 py-3.5 font-medium text-accentFg transition-opacity hover:opacity-90"
            >
              <E p="hero.cta">{hero.cta}</E>
            </a>
            {hero.secondaryCta && (
              <a
                href={brand.phoneHref}
                className="inline-flex items-center gap-2 rounded-lg border border-rule bg-bg px-7 py-3.5 font-medium text-ink transition-colors hover:border-accent hover:text-accent"
              >
                <PhoneCall size={18} weight="bold" />
                <E p="hero.secondaryCta">{hero.secondaryCta}</E>
              </a>
            )}
          </div>

          {/* Friction reducers */}
          {hero.frictionReducers.length > 0 && (
            <div className="mt-6 flex flex-wrap justify-center gap-5">
              {hero.frictionReducers.map((s, i) => (
                <span key={s} className="flex items-center gap-1.5 text-sm text-inkSoft">
                  <CheckCircle size={14} weight="fill" className="text-accent" />
                  <E p={`hero.frictionReducers.${i}`}>{s}</E>
                </span>
              ))}
            </div>
          )}
        </motion.div>

        {/* heroBullets row */}
        {hero.heroBullets.length > 0 && (
          <motion.div
            className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-rule sm:grid-cols-4"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          >
            {hero.heroBullets.map((b, i) => (
              <div key={b.label} className={`px-5 py-5 ${i % 2 === 0 ? 'bg-bg' : 'bg-bgSoft'}`}>
                <p className="font-heading text-2xl font-bold text-accent"><E p={`hero.heroBullets.${i}.value`} fit>{b.value}</E></p>
                <p className="mt-1 text-xs text-inkSoft"><E p={`hero.heroBullets.${i}.label`}>{b.label}</E></p>
              </div>
            ))}
          </motion.div>
        )}
      </div>
    </section>
  );
}
