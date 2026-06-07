'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { PhoneCall, CheckCircle } from '@phosphor-icons/react';
import { CONTENT } from '@/data/site';

export const meta = {
  id: 'hero-split',
  category: 'hero',
  label: 'Hero / Split',
  consumes: [
    'hero.eyebrow', 'hero.headline', 'hero.headlineEmphasis', 'hero.sub',
    'hero.badge', 'hero.cta', 'hero.frictionReducers', 'hero.heroBullets',
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

export default function HeroSplit() {
  const reduce = useReducedMotion() ?? false;
  const { hero, brand, images } = CONTENT;
  const slide = images.hero.slides?.[0];

  return (
    <section className="overflow-hidden bg-bg">
      <div className="mx-auto grid max-w-6xl grid-cols-1 lg:grid-cols-2">

        {/* Left: text content */}
        <motion.div
          className="flex flex-col justify-center px-6 py-20 lg:px-12 lg:py-28"
          initial={reduce ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          {hero.badge && (
            <div className="mb-4 inline-flex w-fit items-center gap-1.5 rounded-full border border-rule bg-bgSoft px-3 py-1 text-xs font-medium text-inkSoft">
              {hero.badge}
            </div>
          )}

          <p className="text-sm font-semibold uppercase tracking-widest text-accent">
            {hero.eyebrow}
          </p>
          <h1 className="mt-3 font-heading text-4xl font-bold leading-tight text-ink lg:text-5xl">
            <Headline text={hero.headline} emphasis={hero.headlineEmphasis} />
          </h1>
          <p className="mt-4 max-w-prose leading-relaxed text-inkSoft">{hero.sub}</p>

          {/* CTAs */}
          <div className="mt-8 flex flex-wrap gap-4">
            <a
              href="#cta"
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3 font-medium text-bg transition-opacity hover:opacity-90"
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

          {/* Friction reducers */}
          {hero.frictionReducers.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-5">
              {hero.frictionReducers.map((s) => (
                <span key={s} className="flex items-center gap-1.5 text-sm text-inkSoft">
                  <CheckCircle size={15} weight="fill" className="text-accent" />
                  {s}
                </span>
              ))}
            </div>
          )}
        </motion.div>

        {/* Right: image panel */}
        <motion.div
          className="relative flex flex-col overflow-hidden bg-bgSoft lg:rounded-l-3xl"
          initial={reduce ? false : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
        >
          {slide?.url ? (
            <img
              src={slide.url}
              alt={slide.alt}
              loading="eager"
              className="h-full w-full object-cover"
              style={{ minHeight: '400px' }}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center bg-bgSoft bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(0,0,0,0.03)_10px,rgba(0,0,0,0.03)_20px)] p-10">
              <span className="font-sans text-xs uppercase tracking-widest text-inkSoft">
                {hero.rotatingImages[0]?.caption ?? 'Hero image'}
              </span>
            </div>
          )}

          {/* heroBullets overlay bar */}
          {hero.heroBullets.length > 0 && (
            <div className="absolute bottom-0 left-0 right-0 grid grid-cols-4 gap-px bg-ink/20">
              {hero.heroBullets.map((b) => (
                <div key={b.label} className="bg-ink/80 px-3 py-3 text-center backdrop-blur-sm">
                  <p className="font-heading text-lg font-bold text-bg">{b.value}</p>
                  <p className="mt-0.5 text-xs text-bg/70">{b.label}</p>
                </div>
              ))}
            </div>
          )}
        </motion.div>

      </div>
    </section>
  );
}
