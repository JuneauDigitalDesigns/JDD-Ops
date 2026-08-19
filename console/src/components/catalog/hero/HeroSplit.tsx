'use client';
// ─────────────────────────────────────────────────────────────────────────────
// HeroSplit — recomposed 2026-08-19 against design/catalog-v2/SPEC.md.
//
// WHAT CHANGED AND WHY
// This was the editorial flagship: a -rotate-90 spine label, a 136px masthead
// (`text-[min(9.5vw,8.5rem)]` at leading-[0.88]/tracking-[-0.04em]), a 16rem ghost
// numeral, a diagonal clip mask, and the phone number rendered as a plain text link
// beside the real button. It read like an agency portfolio, not a contractor.
//
// NO MOTION AT ALL, DELIBERATELY. Every element here is above the fold, and SPEC §9
// forbids above-fold entrance animation. This is measured, not taste: the sub
// paragraph below is this page's LCP element and it used to sit in a motion.div with
// `initial={{opacity:0}}` plus a 350ms delay, so it could not paint until hydration
// finished — 84% of a 4.2s LCP was Render Delay on plain text. framer-motion is
// therefore not imported by this component at all. Do not reintroduce it here.
//
// The review badge is no longer `hidden lg:block`. Trust has to survive on the
// device most of these visitors use (SPEC §7).
// ─────────────────────────────────────────────────────────────────────────────
import { PhoneCall, CheckCircle, Star, ArrowRight } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { responsiveImage } from '@/lib/img';
import { skinClasses, type SkinId } from '@/lib/skins';

export const meta = {
  id: 'hero-split',
  category: 'hero',
  label: 'Hero / Image-led split',
  consumes: [
    'hero.eyebrow', 'hero.headline', 'hero.headlineEmphasis', 'hero.sub', 'hero.badge',
    'hero.cta', 'hero.secondaryCta', 'hero.frictionReducers', 'hero.heroBullets',
    'brand.phoneHref', 'brand.phone', 'brand.short', 'brand.name',
    'images.hero.slides', 'extensions.reviewBadge',
  ],
  sharedDeps: ['@phosphor-icons/react', '@/lib/skins'],
  skins: ['default', 'inverted'],
} as const;

/** Splits the headline so the emphasised phrase can carry the accent, without animation. */
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

export default function HeroSplit({
  content = CONTENT,
  skin = 'default',
}: {
  content?: SiteContent;
  skin?: SkinId;
}) {
  const s = skinClasses(skin);
  const { hero, brand, images, extensions } = content;
  const slide = images.hero.slides?.[0];
  const review = extensions.reviewBadge;

  return (
    <section id="top" className={`relative ${s.section}`}>
      <div className="mx-auto max-w-6xl px-5 pt-8 sm:px-6 lg:grid lg:grid-cols-[1.05fr_.95fr] lg:items-end lg:gap-12 lg:pt-14">
        {/* Copy column. On desktop it is lifted clear of the stat band below, which is
            pulled up over this section — a centred grid would let the band clip the proof
            list instead of the photograph. */}
        <div className="lg:pb-11">
          {review && (
            <p className="mb-3.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[15px] font-bold">
              <span className="flex text-accent" aria-hidden="true">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star key={i} size={17} weight="fill" className={i < Math.round(review.rating) ? '' : 'opacity-25'} />
                ))}
              </span>
              <span>{review.rating}</span>
              <span className={`font-semibold ${s.body}`}>from {review.count}+ customer reviews</span>
            </p>
          )}

          {/* Capped at 58px, normal tracking, leading ~1.05. Names the service, not a mood. */}
          <h1 className={`font-heading text-[34px] font-extrabold leading-[1.05] tracking-[-0.015em] sm:text-[42px] lg:text-[58px] ${s.heading}`}>
            <Headline text={hero.headline} emphasis={hero.headlineEmphasis} />
          </h1>

          {/* THE LCP ELEMENT. Nothing may gate its paint. */}
          <p className={`mt-4 max-w-[46ch] text-[17px] leading-relaxed sm:text-[18px] ${s.body}`}>
            <E p="hero.sub">{hero.sub}</E>
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-stretch">
            {/* The digits, not the word "Call" — a visible number is itself a trust signal.
                `whitespace-nowrap` so it can never break mid-number when the row goes
                horizontal. */}
            <a
              href={brand.phoneHref}
              className="flex flex-col items-center justify-center gap-0.5 rounded-lg bg-accent px-6 py-3.5 text-accentFg transition-[filter] hover:brightness-105"
            >
              <span className="flex items-center gap-2.5 whitespace-nowrap text-[23px] font-extrabold tracking-[-0.02em]">
                <PhoneCall size={22} weight="fill" aria-hidden="true" />
                <E p="brand.phone">{brand.phone}</E>
              </span>
              {hero.secondaryCta && (
                <span className="text-[13.5px] font-semibold opacity-80">
                  <E p="hero.secondaryCta">{hero.secondaryCta}</E>
                </span>
              )}
            </a>

            <a
              href="#cta"
              className={`group flex items-center justify-center gap-2 rounded-lg border-2 px-6 py-3.5 text-[17px] font-bold transition-colors ${s.heading} border-current/30 hover:bg-accent hover:text-accentFg hover:border-transparent`}
            >
              <E p="hero.cta">{hero.cta}</E>
              <ArrowRight size={17} weight="bold" aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
            </a>
          </div>

          {hero.frictionReducers.length > 0 && (
            <ul className={`mt-7 grid max-w-[520px] grid-cols-2 gap-x-4 gap-y-3 border-t pt-5 ${s.rule}`}>
              {hero.frictionReducers.map((f, i) => (
                <li key={f} className="flex items-start gap-2 text-[15px] font-semibold leading-snug">
                  <CheckCircle size={19} weight="fill" className="mt-px shrink-0 text-accent" aria-hidden="true" />
                  <E p={`hero.frictionReducers.${i}`}>{f}</E>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* THE SIGNATURE DEVICE: a solid accent slab behind the photograph, offset down and
            right like a printed layer out of register. The wrapper's padding reserves the
            space it occupies so it can never overlap a neighbour. Flat colour, offset — not
            a rotation, mask or texture, which are the editorial moves this pass removed. */}
        <div className="relative mt-8 pb-3.5 pr-3.5 lg:mt-0">
          <div className="absolute bottom-0 left-3.5 right-0 top-3.5 rounded-lg bg-accent" aria-hidden="true" />
          {slide?.url ? (
            <img
              {...responsiveImage(slide.url)}
              alt={slide.alt}
              loading="eager"
              fetchPriority="high"
              decoding="async"
              /* `sizes` lives here, not in responsiveImage(), because only this component
                 knows the rendered box: full bleed minus gutters on phones, and roughly a
                 520px column once the grid splits at lg. A wrong `sizes` is worse than none,
                 since the browser trusts it over layout. */
              sizes="(min-width: 1024px) 520px, 100vw"
              /* Load-bearing: the only intrinsic ratio available before the bytes land.
                 Without it this shifted the page by 1400px (CLS 0.193). */
              width={1600}
              height={1000}
              className="relative h-[240px] w-full rounded-lg object-cover sm:h-[320px] lg:h-[440px]"
            />
          ) : (
            <div
              role="img"
              aria-label={`${brand.name} placeholder image`}
              className="relative h-[240px] w-full rounded-lg bg-accent-grad sm:h-[320px] lg:h-[440px]"
            />
          )}
        </div>
      </div>

      {/* THE ACCENT BAND — the one full accent surface on the page, and the overlap that
          makes the composition read as stacked planes rather than a column of blocks. Real
          numbers at size; this is not the decorative-numeral device that was cut.
          `text-accentFg` (measured against the accent, never assumed) keeps it legible on
          any brand colour. */}
      {hero.heroBullets.length > 0 && (
        <div className="relative z-10 -mt-5 bg-accent text-accentFg shadow-[0_-10px_26px_-14px_rgba(0,0,0,.45)] lg:-mt-7">
          <ul className="mx-auto grid max-w-6xl grid-cols-2 gap-y-5 px-5 py-6 sm:grid-cols-4 sm:px-6 lg:py-7">
            {hero.heroBullets.map((b, i) => (
              <li key={b.label}>
                <p className="font-heading text-[34px] font-extrabold leading-none tracking-[-0.03em] lg:text-[44px]">
                  <E p={`hero.heroBullets.${i}.value`} fit>{b.value}</E>
                </p>
                <p className="mt-1.5 text-[14px] font-bold leading-tight opacity-80">
                  <E p={`hero.heroBullets.${i}.label`}>{b.label}</E>
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
