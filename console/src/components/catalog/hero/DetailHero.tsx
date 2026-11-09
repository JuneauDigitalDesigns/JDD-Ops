'use client';
// ─────────────────────────────────────────────────────────────────────────────
// DetailHero — "finish only reads against black" hero, mirrored 1:1 (design: home-mockups.html
// #detail .hero). CENTRED and vignetted (every other vertical's hero is left-anchored), framed by
// a thin gold hairline above the eyebrow, a radial scrim over a desaturated photo. The friction
// row sits below a hairline divider rather than beside the headline.
//
// "See packages →" routes to /services, not /contact (PLAN D16 — the one allowlisted exception
// to the universal CTA-routes-to-/contact rule, EXEC T9.2/cta-routing.test.mjs). It is a browse
// action (pick a package) that feeds into the real conversion action, not a conversion itself.
// Fixed design, no skin.
// ─────────────────────────────────────────────────────────────────────────────
import { Phone, ArrowRight } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { imageAt } from '@/lib/localImage';

export const meta = {
  id: 'detail-hero',
  category: 'hero',
  label: 'Car Detailing / Centred vignette hero',
  consumes: ['hero.headline', 'hero.headlineEmphasis', 'hero.sub', 'hero.frictionReducers', 'brand.phone', 'brand.phoneHref', 'images.hero.slides'],
  sharedDeps: ['@phosphor-icons/react', '@/lib/editable'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

/** Headline with the emphasised phrase in gold, matching `.hero h1 .em`. */
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

export default function DetailHero({ content = CONTENT }: { content?: SiteContent }) {
  const { hero, brand, images } = content;
  const slide = images.hero?.slides?.[0]?.url ?? images.hero?.portrait;

  return (
    <header className="relative isolate flex min-h-[680px] items-center overflow-hidden text-center" style={{ background: '#08090C' }}>
      {slide && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${imageAt(slide, 1536)})`, filter: 'saturate(.82) contrast(1.06)' }}
          role="img"
          aria-label={images.hero?.slides?.[0]?.alt ?? `${brand.name} detailed vehicle`}
        />
      )}
      <div
        className="absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(120% 90% at 50% 40%,transparent 18%,rgba(8,9,12,.72) 68%,rgba(8,9,12,.95) 100%),' +
            'linear-gradient(180deg,rgba(8,9,12,.62),rgba(8,9,12,.42) 42%,rgba(8,9,12,.93))',
        }}
      />

      <div className="relative mx-auto max-w-[760px] px-6 py-[104px]">
        <div className="mx-auto h-px w-[72px]" style={{ background: 'linear-gradient(90deg,#C9A14B,transparent)' }} aria-hidden="true" />

        <h1 className="mt-5 font-heading text-[clamp(40px,5.6vw,64px)] font-extrabold leading-[1.0] tracking-[-0.018em] text-[#fff]">
          <Headline text={hero.headline} emphasis={hero.headlineEmphasis} />
        </h1>

        <p className="mx-auto mt-[18px] max-w-[52ch] text-[18.5px] leading-[1.62] text-[#C4CBD6]">
          <E p="hero.sub">{hero.sub}</E>
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-[13px]">
          <a
            href={brand.phoneHref}
            className="inline-flex items-center gap-[10px] rounded-[8px] bg-accent px-[22px] py-[14px] font-heading text-[16px] font-extrabold text-accentFg"
          >
            <Phone size={18} weight="fill" aria-hidden="true" />
            <E p="brand.phone">{brand.phone}</E>
          </a>
          <a
            href="/services"
            className="inline-flex items-center gap-2 rounded-[8px] border-2 border-[rgba(255,255,255,0.22)] px-[22px] py-[14px] text-[16px] font-bold text-[#fff] transition-colors hover:border-accent hover:text-accent"
          >
            See packages
            <ArrowRight size={16} weight="bold" aria-hidden="true" />
          </a>
        </div>

        {hero.frictionReducers.length > 0 && (
          <div className="mx-auto mt-[34px] flex max-w-[620px] flex-wrap justify-center gap-x-[34px] gap-y-2 border-t border-[rgba(255,255,255,0.14)] pt-6">
            {hero.frictionReducers.map((f, i) => (
              <span key={f} className="text-[12px] font-bold uppercase tracking-[0.17em] text-[#9AA4B2]">
                <E p={`hero.frictionReducers.${i}`}>{f}</E>
              </span>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
