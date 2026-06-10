'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { PhoneCall, CheckCircle } from '@phosphor-icons/react';
import { CONTENT } from '@/data/site';

export const meta = {
  id: 'hero-overlap',
  category: 'hero',
  label: 'Hero / Full-bleed overlap',
  consumes: [
    'hero.eyebrow', 'hero.headline', 'hero.headlineEmphasis', 'hero.sub',
    'hero.badge', 'hero.cta', 'hero.frictionReducers',
    'brand.phoneHref', 'brand.phone', 'images.hero.slides',
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

export default function HeroOverlap() {
  const reduce = useReducedMotion() ?? false;
  const { hero, brand, images } = CONTENT;
  const slide = images.hero.slides?.[0];

  return (
    <section className="relative isolate flex min-h-[100dvh] items-center overflow-hidden bg-ink">
      {/* Full-bleed background image */}
      {slide?.url ? (
        <img
          src={slide.url}
          alt={slide.alt}
          loading="eager"
          className="absolute inset-0 -z-10 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 -z-10 bg-ink bg-[repeating-linear-gradient(45deg,transparent,transparent_12px,rgba(255,255,255,0.03)_12px,rgba(255,255,255,0.03)_24px)]" />
      )}
      {/* Legibility wash toward the card side */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ink/70 via-ink/30 to-transparent" />

      <div className="mx-auto w-full max-w-6xl px-6 py-20 lg:py-28">
        <motion.div
          className="max-w-xl rounded-3xl border border-white/15 bg-bg/95 p-8 shadow-2xl backdrop-blur-md lg:p-10"
          initial={reduce ? false : { opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          {hero.badge && (
            <div className="mb-4 inline-flex w-fit items-center gap-1.5 rounded-full border border-rule bg-bgSoft px-3 py-1 text-xs font-medium text-inkSoft">
              {hero.badge}
            </div>
          )}

          <p className="text-sm font-semibold uppercase tracking-widest text-accent">{hero.eyebrow}</p>
          <h1 className="mt-3 font-heading text-4xl leading-tight text-ink md:text-5xl">
            <Headline text={hero.headline} emphasis={hero.headlineEmphasis} />
          </h1>
          <p className="mt-4 leading-relaxed text-inkSoft">{hero.sub}</p>

          <div className="mt-8 flex flex-wrap gap-4">
            <a
              href="#cta"
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3 font-medium text-accentFg shadow-sm shadow-accent/20 transition-all hover:-translate-y-px hover:opacity-95 active:translate-y-0"
            >
              {hero.cta}
            </a>
            <a
              href={brand.phoneHref}
              className="inline-flex items-center gap-2 rounded-lg border border-rule px-6 py-3 font-medium text-ink transition-colors hover:border-accent hover:text-accent"
            >
              <PhoneCall size={18} weight="bold" />
              {brand.phone}
            </a>
          </div>

          {hero.frictionReducers.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
              {hero.frictionReducers.map((s) => (
                <span key={s} className="flex items-center gap-1.5 text-sm text-inkSoft">
                  <CheckCircle size={15} weight="fill" className="text-accent" />
                  {s}
                </span>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
