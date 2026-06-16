'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { PhoneCall, CheckCircle, Star } from '@phosphor-icons/react';
import { CONTENT } from '@/data/site';
import type { SiteContent } from '@/data/site';
import { E, useEditing } from '@/lib/editable';

export const meta = {
  id: 'hero-split',
  category: 'hero',
  label: 'Hero / Split (offset)',
  consumes: [
    'hero.eyebrow', 'hero.headline', 'hero.headlineEmphasis', 'hero.sub',
    'hero.badge', 'hero.cta', 'hero.frictionReducers', 'hero.heroBullets',
    'brand.phoneHref', 'brand.phone', 'images.hero.slides', 'extensions.reviewBadge',
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

export default function HeroSplit({ content = CONTENT }: { content?: SiteContent }) {
  const reduce = useReducedMotion() ?? false;
  const editing = useEditing();
  const { hero, brand, images, extensions } = content;
  const slide = images.hero.slides?.[0];
  const review = extensions.reviewBadge;

  return (
    <section className="overflow-hidden bg-bg">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center lg:grid-cols-[1.05fr_0.95fr]">

        {/* Left: text content */}
        <motion.div
          className="flex flex-col justify-center px-6 py-20 lg:px-12 lg:py-28"
          initial={reduce ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          {hero.badge && (
            <div className="mb-4 inline-flex w-fit items-center gap-1.5 rounded-full border border-rule bg-bgSoft px-3 py-1 text-xs font-medium text-inkSoft">
              <E p="hero.badge">{hero.badge}</E>
            </div>
          )}

          <p className="text-sm font-semibold uppercase tracking-widest text-accent">
            <E p="hero.eyebrow">{hero.eyebrow}</E>
          </p>
          <h1 className="mt-3 font-heading text-4xl leading-tight text-ink lg:text-5xl xl:text-6xl">
            {editing
              ? <E p="hero.headline" fit>{hero.headline}</E>
              : <Headline text={hero.headline} emphasis={hero.headlineEmphasis} />}
          </h1>
          <p className="mt-4 max-w-prose leading-relaxed text-inkSoft"><E p="hero.sub">{hero.sub}</E></p>

          {/* CTAs */}
          <div className="mt-8 flex flex-wrap gap-4">
            <a
              href="#cta"
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3 font-medium text-accentFg shadow-sm shadow-accent/20 transition-all hover:-translate-y-px hover:opacity-95 active:translate-y-0"
            >
              <E p="hero.cta">{hero.cta}</E>
            </a>
            <a
              href={brand.phoneHref}
              className="inline-flex items-center gap-2 rounded-lg border border-rule px-6 py-3 font-medium text-ink transition-colors hover:border-accent hover:text-accent"
            >
              <PhoneCall size={18} weight="bold" />
              <E p="brand.phone">{brand.phone}</E>
            </a>
          </div>

          {/* Friction reducers */}
          {hero.frictionReducers.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-5">
              {hero.frictionReducers.map((s, i) => (
                <span key={s} className="flex items-center gap-1.5 text-sm text-inkSoft">
                  <CheckCircle size={15} weight="fill" className="text-accent" />
                  <E p={`hero.frictionReducers.${i}`}>{s}</E>
                </span>
              ))}
            </div>
          )}
        </motion.div>

        {/* Right: offset image with floating review card */}
        <motion.div
          className="relative px-6 pb-16 lg:p-10"
          initial={reduce ? false : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
        >
          <div className="relative overflow-hidden rounded-3xl bg-bgSoft" style={{ aspectRatio: '4/5' }}>
            {slide?.url ? (
              <img
                src={slide.url}
                alt={slide.alt}
                loading="eager"
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(0,0,0,0.03)_10px,rgba(0,0,0,0.03)_20px)] p-10">
                <span className="font-sans text-xs uppercase tracking-widest text-inkSoft">
                  {images.hero.slides?.[0]?.alt ?? 'Hero image'}
                </span>
              </div>
            )}

            {/* heroBullets glass strip */}
            {hero.heroBullets.length > 0 && (
              <div className="absolute inset-x-0 bottom-0 grid grid-cols-2 gap-px bg-ink/10 sm:grid-cols-4">
                {hero.heroBullets.map((b, i) => (
                  <div key={b.label} className="bg-ink/75 px-3 py-3 text-center backdrop-blur-sm">
                    <p className="font-heading text-lg font-bold text-bg"><E p={`hero.heroBullets.${i}.value`} fit>{b.value}</E></p>
                    <p className="mt-0.5 text-xs text-bg/70"><E p={`hero.heroBullets.${i}.label`}>{b.label}</E></p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Floating review/badge card overlapping the seam */}
          {review ? (
            <div className="absolute bottom-10 left-2 z-10 rounded-2xl border border-rule bg-bg p-4 shadow-xl lg:-left-6">
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star key={i} size={14} weight="fill" className={i < Math.round(review.rating) ? 'text-accent' : 'text-rule'} />
                ))}
              </div>
              <p className="mt-1.5 font-heading text-lg font-bold text-ink">{review.rating} / 5</p>
              <p className="text-xs text-inkSoft">{review.count}+ verified reviews</p>
            </div>
          ) : hero.badge ? (
            <div className="absolute bottom-10 left-2 z-10 inline-flex items-center gap-2 rounded-full border border-rule bg-bg px-4 py-2 text-sm font-semibold text-ink shadow-xl lg:-left-6">
              <Star size={15} weight="fill" className="text-accent" />
              <E p="hero.badge">{hero.badge}</E>
            </div>
          ) : null}
        </motion.div>

      </div>
    </section>
  );
}
