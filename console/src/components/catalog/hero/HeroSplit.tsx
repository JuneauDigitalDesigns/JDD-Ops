'use client';
// ─────────────────────────────────────────────────────────────────────────────
// HeroSplit — the canonical reference for the editorial-print design language.
// See console/DESIGN-LANGUAGE.md. Moves demonstrated here:
//   · Breakout display type — headline escapes its column into image territory
//   · Hairline eyebrow — accent rule + wide-tracked uppercase label
//   · Rotated edge label — vertical mark + year up the left edge
//   · Geometric cut — hard diagonal clip on the image seam (no soft feather)
//   · Offset-shadow CTA — sharp rounded-sm button that lifts off a hard shadow
//   · Heavy numerals — font-black proof-bar stats
//   · Asymmetric split — dominant 52vw image bleed vs. constrained copy column
//   · Floating seam card — review badge straddling the copy/image boundary
//   · Signature motion moment — one parallaxY on the image (opt-in, quiet-safe)
// ─────────────────────────────────────────────────────────────────────────────
import { useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { PhoneCall, CheckCircle, Star, ArrowRight } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E, useEditing } from '@/lib/editable';
import { skinClasses, type SkinId } from '@/lib/skins';
import { EASE, viewportOnce, stillFor, parallaxY } from '@/lib/motion';

export const meta = {
  id: 'hero-split',
  category: 'hero',
  label: 'Hero / Editorial split',
  consumes: [
    'hero.eyebrow', 'hero.headline', 'hero.headlineEmphasis', 'hero.sub', 'hero.badge',
    'hero.cta', 'hero.secondaryCta', 'hero.frictionReducers', 'hero.heroBullets',
    'brand.phoneHref', 'brand.phone', 'brand.short', 'brand.name',
    'images.hero.slides', 'extensions.reviewBadge',
  ],
  sharedDeps: ['framer-motion', '@phosphor-icons/react', '@/lib/skins', '@/lib/motion'],
  skins: ['editorial', 'contrast', 'quiet'],
} as const;

function Headline({ text, emphasis }: { text: string; emphasis: string | null }) {
  if (!emphasis) return <>{text}</>;
  const i = text.indexOf(emphasis);
  if (i === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <span className="text-accent">{emphasis}</span>
      {text.slice(i + emphasis.length)}
    </>
  );
}

/** Oversized display headline that rises word-by-word out of a clip mask. */
function KineticHeadline({
  text,
  emphasis,
  still,
}: {
  text: string;
  emphasis: string | null;
  still: boolean;
}) {
  if (still) return <Headline text={text} emphasis={emphasis} />;
  const emph = emphasis ? new Set(emphasis.split(/\s+/)) : null;
  const words = text.split(/\s+/);
  return (
    <motion.span
      className="inline"
      initial="hidden"
      whileInView="show"
      viewport={viewportOnce}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.08 } } }}
    >
      {words.map((w, i) => (
        <span key={`${w}-${i}`} className="inline-flex overflow-hidden pr-[0.26em] align-bottom">
          <motion.span
            className={`inline-block ${emph?.has(w) ? 'text-accent' : ''}`}
            variants={{ hidden: { y: '115%' }, show: { y: 0, transition: { duration: 0.75, ease: EASE } } }}
          >
            {w}
          </motion.span>
        </span>
      ))}
    </motion.span>
  );
}

export default function HeroSplit({
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
  const dark = skin === 'contrast';
  const { hero, brand, images, extensions } = content;
  const slide = images.hero.slides?.[0];
  const review = extensions.reviewBadge;
  const mark = brand.short || brand.name || '';

  const sectionRef = useRef<HTMLElement>(null);
  // Signature motion moment: gentle scroll parallax on the feature image only.
  const imgY = parallaxY(sectionRef, still);

  const barBg = dark ? 'bg-inkPanel/80' : 'bg-bg/75';

  return (
    <section
      ref={sectionRef}
      className={`relative isolate flex flex-col overflow-hidden lg:block lg:min-h-[96vh] ${s.section}`}
    >
      {/* Rotated editorial measure label up the left edge */}
      <div className="pointer-events-none absolute left-4 top-0 hidden h-full items-center lg:flex">
        <span className={`-rotate-90 whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.4em] ${s.eyebrow}`}>
          {mark} · {new Date().getFullYear()}
        </span>
      </div>

      {/* Content container */}
      <div className="relative z-10 order-1 mx-auto w-full max-w-7xl px-6 lg:px-14">

        {/* Badge + eyebrow — constrained to left half on desktop */}
        <motion.div
          className="pt-20 lg:pt-28 lg:max-w-[52%]"
          initial={still ? false : { opacity: 0, y: 16 }}
          whileInView={still ? undefined : { opacity: 1, y: 0 }}
          viewport={viewportOnce}
          transition={{ duration: 0.5, ease: EASE }}
        >
          {hero.badge && (
            <div className={`mb-5 inline-flex w-fit items-center gap-1.5 rounded-full border ${s.rule} px-3 py-1 text-xs font-medium ${s.body}`}>
              <Star size={13} weight="fill" className="text-accent" />
              <E p="hero.badge">{hero.badge}</E>
            </div>
          )}
          <p className={`flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] ${s.eyebrow}`}>
            <span className={`hidden h-px w-8 sm:inline-block ${dark ? 'bg-accent200' : 'bg-accent'}`} />
            <E p="hero.eyebrow">{hero.eyebrow}</E>
          </p>
        </motion.div>

        {/* Headline — unconstrained, breaks into image territory at desktop sizes */}
        <h1 className={`mt-5 font-heading text-[3.5rem] font-bold leading-[0.88] tracking-[-0.04em] sm:text-[5.5rem] lg:text-[min(9.5vw,8.5rem)] ${s.heading}`}>
          {editing ? (
            <E p="hero.headline" fit>{hero.headline}</E>
          ) : (
            <KineticHeadline text={hero.headline} emphasis={hero.headlineEmphasis} still={still} />
          )}
        </h1>

        {/* Sub + CTAs + friction — left column only */}
        <motion.div
          className="mt-8 pb-28 lg:mt-10 lg:max-w-[50%] lg:pr-8"
          initial={still ? false : { opacity: 0, y: 16 }}
          whileInView={still ? undefined : { opacity: 1, y: 0 }}
          viewport={viewportOnce}
          transition={{ duration: 0.6, ease: EASE, delay: 0.35 }}
        >
          <p className={`max-w-md text-lg leading-relaxed ${s.body}`}>
            <E p="hero.sub">{hero.sub}</E>
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-4">
            <a
              href="#cta"
              className="group inline-flex items-center gap-2 rounded-sm bg-accent px-7 py-3.5 text-base font-semibold text-accentFg transition-all hover:-translate-x-0.5 hover:-translate-y-0.5"
              style={{ boxShadow: dark ? '4px 4px 0px 0px rgba(255,255,255,0.12)' : '4px 4px 0px 0px rgba(0,0,0,0.85)' }}
            >
              <E p="hero.cta">{hero.cta}</E>
              <ArrowRight size={17} weight="bold" className="transition-transform group-hover:translate-x-1" />
            </a>
            <a
              href={brand.phoneHref}
              className={`inline-flex items-center gap-2 text-base font-medium ${s.heading} hover:text-accent`}
            >
              <PhoneCall size={17} weight="bold" />
              <E p="hero.secondaryCta">{hero.secondaryCta}</E>
            </a>
          </div>
          {hero.frictionReducers.length > 0 && (
            <div className={`mt-9 flex flex-wrap gap-x-6 gap-y-2 border-t ${s.rule} pt-6`}>
              {hero.frictionReducers.map((f, i) => (
                <span key={f} className={`flex items-center gap-1.5 text-sm ${s.body}`}>
                  <CheckCircle size={15} weight="fill" className="text-accent" />
                  <E p={`hero.frictionReducers.${i}`}>{f}</E>
                </span>
              ))}
            </div>
          )}
        </motion.div>

        {/* Review card — floats over the copy/image seam */}
        {review && (
          <motion.div
            className={`absolute bottom-28 right-4 z-20 hidden rounded-2xl border ${s.cardRule} ${s.card} p-4 shadow-2xl lg:block lg:-right-6`}
            initial={still ? false : { opacity: 0, y: 16 }}
            whileInView={still ? undefined : { opacity: 1, y: 0 }}
            viewport={viewportOnce}
            transition={{ duration: 0.6, ease: EASE, delay: 0.45 }}
          >
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 5 }, (_, i) => (
                <Star key={i} size={14} weight="fill" className={i < Math.round(review.rating) ? 'text-accent' : 'text-rule'} />
              ))}
            </div>
            <p className={`mt-1.5 font-heading text-lg font-bold ${s.heading}`}>{review.rating} / 5</p>
            <p className={`text-xs ${s.body}`}>{review.count}+ verified reviews</p>
          </motion.div>
        )}
      </div>

      {/* Image — bleeds to the viewport's right edge, wider panel for visual dominance */}
      <motion.div
        className="relative order-2 h-72 w-full sm:h-96 lg:absolute lg:inset-y-0 lg:right-0 lg:h-auto lg:w-[52vw]"
        style={still ? undefined : { y: imgY }}
        initial={still ? false : { clipPath: 'inset(0 0 100% 0)' }}
        whileInView={still ? undefined : { clipPath: 'inset(0 0 0% 0)' }}
        viewport={viewportOnce}
        transition={{ duration: 0.9, ease: EASE, delay: 0.1 }}
      >
        {slide?.url ? (
          <motion.img
            src={slide.url}
            alt={slide.alt}
            loading="eager"
            className="h-full w-full object-cover"
            initial={still ? false : { scale: 1.12 }}
            whileInView={still ? undefined : { scale: 1 }}
            viewport={viewportOnce}
            transition={{ duration: 1.2, ease: EASE, delay: 0.1 }}
          />
        ) : (
          <div className="absolute inset-0 bg-accent-grad">
            <div
              className="absolute inset-0 opacity-[0.16]"
              style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)', backgroundSize: '24px 24px' }}
            />
            <span className="absolute -bottom-10 -right-4 font-heading text-[16rem] font-black leading-none text-white/20">
              {mark[0] ?? '★'}
            </span>
          </div>
        )}
        {/* Diagonal geometric cut — hard editorial edge instead of a soft feather */}
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-y-0 left-0 hidden w-[18%] lg:block ${dark ? 'bg-inkPanel' : 'bg-bg'}`}
          style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}
        />
      </motion.div>

      {/* Full-bleed proof bar — spans copy + image along the bottom edge */}
      {hero.heroBullets.length > 0 && (
        <motion.div
          className={`relative z-10 order-3 border-t ${s.rule} ${barBg} backdrop-blur-md lg:absolute lg:inset-x-0 lg:bottom-0`}
          initial={still ? false : { opacity: 0, y: 12 }}
          whileInView={still ? undefined : { opacity: 1, y: 0 }}
          viewport={viewportOnce}
          transition={{ duration: 0.6, ease: EASE, delay: 0.5 }}
        >
          <div className={`mx-auto grid max-w-7xl grid-cols-2 px-6 sm:grid-cols-4 lg:px-14 ${dark ? 'divide-x divide-ruleInk' : 'divide-x divide-rule'}`}>
            {hero.heroBullets.map((b, i) => (
              <div key={b.label} className="px-4 py-5">
                <p className={`font-heading text-3xl font-black ${s.heading}`}>
                  <E p={`hero.heroBullets.${i}.value`} fit>{b.value}</E>
                </p>
                <p className={`mt-0.5 text-[11px] uppercase tracking-wide ${s.body}`}>
                  <E p={`hero.heroBullets.${i}.label`}>{b.label}</E>
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </section>
  );
}
