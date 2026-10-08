'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { PhoneCall, CheckCircle } from '@phosphor-icons/react';
import { CONTENT } from '@/data/site';
import type { SiteContent } from '@/data/site';
import { E, useEditing } from '@/lib/editable';
import { responsiveImage, responsivePicture } from '@/lib/img';

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
  /** Structural archetype, from src/lib/archetypes.ts. Unique within the category. */
  archetype: 'full-bleed-overlay',
  /** True if this component owns a SIGNATURE motion moment (a scroll-linked transform, a pin,
   *  a count-up). Decision 26 budgets these per PAGE, not per section: at most two on a page,
   *  enforced by console/test/page-rhythm.test.mjs. Micro-reveals are free and do not count. */
  signature: false,
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

export default function HeroOverlap({ content = CONTENT }: { content?: SiteContent }) {
  const reduce = useReducedMotion() ?? false;
  const editing = useEditing();
  const { hero, brand, images } = content;
  const slide = images.hero.slides?.[0];
  // Full-bleed hero = the LCP image and the only AVIF slot (decision 44). Localized only after
  // export; in the preview the responsiveImage fallback renders (origin URL, no typed source).
  const heroPic = slide?.url ? responsivePicture(slide.url, { avif: true }) : null;

  return (
    <section className="relative isolate flex min-h-[560px] items-center overflow-hidden bg-ink lg:min-h-[640px]">
      {/* Bounded height, never a viewport unit: the studio's flow-mode preview sizes the iframe
          to measured content height, so `min-h-[100dvh]` here fed a runaway height loop that
          rendered the page blank. A fixed min-h renders identically live and in the preview. */}
      {/* Full-bleed background image */}
      {slide?.url ? (
        /* Full-bleed hero backdrop, almost always the LCP element: it must compete for bandwidth
           immediately AND be asked for at the right width. After export it serves AVIF then WebP
           via a picture element; in the preview it falls back to the responsiveImage markup. */
        heroPic?.webpSrcSet ? (
          <picture>
            {heroPic.avifSrcSet && (
              <source type="image/avif" srcSet={heroPic.avifSrcSet} sizes="100vw" />
            )}
            <source type="image/webp" srcSet={heroPic.webpSrcSet} sizes="100vw" />
            <img
              src={heroPic.src}
              alt={slide.alt}
              loading="eager"
              fetchPriority="high"
              decoding="async"
              width={1600}
              height={900}
              sizes="100vw"
              className="absolute inset-0 -z-10 h-full w-full object-cover"
            />
          </picture>
        ) : (
          <img
            {...responsiveImage(slide.url)}
            alt={slide.alt}
            loading="eager"
            fetchPriority="high"
            decoding="async"
            width={1600}
            height={900}
            sizes="100vw"
            className="absolute inset-0 -z-10 h-full w-full object-cover"
          />
        )
      ) : (
        <div className="absolute inset-0 -z-10 bg-ink bg-[repeating-linear-gradient(45deg,transparent,transparent_12px,rgba(255,255,255,0.03)_12px,rgba(255,255,255,0.03)_24px)]" />
      )}
      {/* Legibility scrim. Decision 30(b): research §6 item 1 names "a confident headline over a
          soft gradient" as the most-cited AI tell, so this is a FLAT plate at a measured opacity
          rather than a directional feather. It does the same legibility job. */}
      <div className="absolute inset-0 -z-10 bg-ink/55" />

      <div className="mx-auto w-full max-w-6xl px-6 py-20 lg:py-28">
        <motion.div
          className="max-w-xl rounded-3xl border border-white/15 bg-bg/95 p-8 shadow-2xl backdrop-blur-md lg:p-10"
          initial={reduce ? false : { opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          {hero.badge && (
            <div className="mb-4 inline-flex w-fit items-center gap-1.5 rounded-full border border-rule bg-bgSoft px-3 py-1 text-xs font-medium text-inkSoft">
              <E p="hero.badge">{hero.badge}</E>
            </div>
          )}

          <p className="text-sm font-semibold uppercase tracking-widest text-accent"><E p="hero.eyebrow">{hero.eyebrow}</E></p>
          <h1 className="mt-3 font-heading text-4xl leading-tight text-ink md:text-5xl">
            {editing
              ? <E p="hero.headline" fit>{hero.headline}</E>
              : <Headline text={hero.headline} emphasis={hero.headlineEmphasis} />}
          </h1>
          <p className="mt-4 leading-relaxed text-inkSoft"><E p="hero.sub">{hero.sub}</E></p>

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

          {(hero.frictionReducers ?? []).length > 0 && (
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
              {(hero.frictionReducers ?? []).map((s, i) => (
                <span key={s} className="flex items-center gap-1.5 text-sm text-inkSoft">
                  <CheckCircle size={15} weight="fill" className="text-accent" />
                  <E p={`hero.frictionReducers.${i}`}>{s}</E>
                </span>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
