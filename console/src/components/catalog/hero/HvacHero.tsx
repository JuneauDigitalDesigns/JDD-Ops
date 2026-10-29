'use client';
// ─────────────────────────────────────────────────────────────────────────────
// HvacHero — Northstar "Home — Standard" hero, mirrored 1:1 (design: home-mockups.html
// `.hero-std`). A full-bleed background photograph under a left→right dark navy gradient scrim,
// with the copy laid over the LEFT: a star rating line, a condensed (Oswald) headline whose
// emphasis word is gold, a sub, a warm-accent phone button + a ghost "Book a visit" button, and
// a two-column ✓ reducer grid with a hairline top border.
//
// Colors are the mockup's literal values (navy scrim, gold #F6B54A, #D7E0EA / #EAF1F8 text) —
// these are the approved look, not token approximations. Content stays schema-driven
// ("react to the LOOK, not the copy"). Fixed design, no skin.
// ─────────────────────────────────────────────────────────────────────────────
import { PhoneCall, Check, ArrowRight } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';

export const meta = {
  id: 'hvac-hero',
  category: 'hero',
  label: 'HVAC / Standard hero',
  consumes: [
    'hero.headline', 'hero.headlineEmphasis', 'hero.sub', 'hero.cta', 'hero.frictionReducers',
    'brand.phone', 'brand.phoneHref', 'extensions.reviewBadge', 'images.hero.slides',
  ],
  sharedDeps: ['@phosphor-icons/react', '@/lib/editable'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

/** Headline with the emphasised phrase in the hero's gold, matching `.hero-std h1 .em`. */
function Headline({ text, emphasis }: { text: string; emphasis: string | null }) {
  if (!emphasis) return <>{text}</>;
  const i = text.indexOf(emphasis);
  if (i === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <span className="text-[#F6B54A]">{emphasis}</span>
      {text.slice(i + emphasis.length)}
    </>
  );
}

export default function HvacHero({ content = CONTENT }: { content?: SiteContent }) {
  const { hero, brand, extensions, images } = content;
  const review = extensions.reviewBadge;
  const slide = images.hero?.slides?.[0]?.url ?? images.hero?.portrait;

  return (
    <section id="top" className="relative isolate flex min-h-[600px] items-center overflow-hidden bg-ink">
      {/* Full-bleed background photograph */}
      {slide && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${slide})` }}
          role="img"
          aria-label={images.hero?.slides?.[0]?.alt ?? `${brand.name} technician`}
        />
      )}
      {/* Dark navy scrim — the mockup's two stacked linear gradients (transparent bleed to the right) */}
      <div
        className="absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            'linear-gradient(90deg,rgba(10,22,38,.86) 0%,rgba(10,22,38,.60) 45%,rgba(10,22,38,.28) 100%),' +
            'linear-gradient(180deg,rgba(10,22,38,.2),rgba(10,22,38,.55))',
        }}
      />

      <div className="relative mx-auto w-full max-w-[1120px] px-6 pb-[84px] pt-[92px]">
        <div className="max-w-[640px] text-[#fff]">
          {review && (
            <div className="mb-4 flex items-center gap-[9px] text-[15px] font-bold text-[#fff]">
              <span className="tracking-[2px] text-[#F6B54A]">★★★★★</span> {review.rating}
              <span className="font-semibold text-[#C6D2DE]">from {review.count}+ verified reviews</span>
            </div>
          )}

          <h1 className="font-heading text-[clamp(40px,5.4vw,60px)] font-semibold leading-[1.04] tracking-[-0.01em] text-[#fff] [text-shadow:0_3px_18px_rgba(0,0,0,0.45)]">
            <Headline text={hero.headline} emphasis={hero.headlineEmphasis} />
          </h1>

          <p className="mt-[18px] max-w-[46ch] text-[19px] leading-[1.6] text-[#D7E0EA]">
            <E p="hero.sub">{hero.sub}</E>
          </p>

          <div className="mt-[30px] flex flex-wrap gap-[14px]">
            <a
              href={brand.phoneHref}
              className="inline-flex items-center gap-[10px] rounded-[10px] bg-accent px-[22px] py-[14px] font-heading text-[21px] font-semibold tracking-[0.01em] text-accentFg shadow-[0_10px_24px_-8px_rgba(224,96,44,0.5)] transition-transform hover:-translate-y-0.5"
            >
              <PhoneCall size={20} weight="fill" aria-hidden="true" />
              <E p="brand.phone">{brand.phone}</E>
            </a>
            <a
              href="/contact"
              className="inline-flex items-center gap-2 rounded-[10px] border-2 border-[rgba(255,255,255,0.4)] px-[22px] py-[14px] text-[16px] font-bold text-[#fff] transition-colors hover:border-accent hover:text-accent"
            >
              <E p="hero.cta">{hero.cta}</E>
              <ArrowRight size={16} weight="bold" aria-hidden="true" />
            </a>
          </div>

          {hero.frictionReducers.length > 0 && (
            <div className="mt-[30px] grid max-w-[520px] grid-cols-2 gap-x-[22px] gap-y-[10px] border-t border-[rgba(255,255,255,0.18)] pt-[20px]">
              {hero.frictionReducers.map((f, i) => (
                <span key={f} className="flex items-center gap-[9px] text-[14.5px] font-semibold text-[#EAF1F8]">
                  <Check size={16} weight="bold" className="shrink-0 text-accent" aria-hidden="true" />
                  <E p={`hero.frictionReducers.${i}`}>{f}</E>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
