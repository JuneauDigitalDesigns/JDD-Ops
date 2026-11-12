'use client';
// ─────────────────────────────────────────────────────────────────────────────
// HvacHero — Northstar "Home — Standard" hero, premium pass (2026-11-09, approved mockup).
//
// A full-bleed photograph under a LIGHTER left→right scrim than before (the photo now reads on the
// right) with a navy colour-blend wash so any client photo takes one grade. Copy on the left: steel
// eyebrow is not used here (the rating line opens the hero), a condensed headline up to 76px whose
// emphasis word is the brand ACCENT (editable; gold is reserved for stars), the sub, the accent
// phone button + ghost "Book a visit", the two-column ✓ reducer grid, and the license line when
// intake supplied one.
//
// THE LEAD FORM (operator decision 2026-11-09: every hero carries one). The card on the right is
// the SAME @jdd/ui <LeadForm> the final CTA and the contact page mount, with the same props: mode
// from the plan, surface light, submit label from hero.cta. Its title is hero.formLabel, which
// already exists in the schema; an EMPTY label means "no form on this site", so the per-site
// switch needs no schema change. On a phone the card follows the reducers, so the rating, H1 and
// call button stay in the first screen and the form is one swipe down.
//
// LCP: the H1 and sub never animate. The rating line, buttons, reducers and the card take the
// pure-CSS hero-rise fade (reduced-motion → none). The card ships in server HTML, no fetch.
//
// Colours: every one is a palette token now (ink-panel, on-ink, accent, --star for the stars),
// so the Studio's palette pane and per-section overrides reach the whole hero. The two literal
// rgba() values are shadow alphas, not colours.
// ─────────────────────────────────────────────────────────────────────────────
import { PhoneCall, Check, ArrowRight } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { LeadForm } from '@/lib/LeadForm';
import { CoverImage } from '@/lib/CoverImage';
import { primaryCity } from '@/lib/serviceLinks';

/** A client photo's alt when it came with none: facts only, "{business} in {city}" (never a guess at what it shows). */
const placeAlt = (c: SiteContent) => [c.brand.name, primaryCity(c)].filter(Boolean).join(' in ');

export const meta = {
  id: 'hvac-hero',
  category: 'hero',
  label: 'HVAC / Standard hero',
  consumes: [
    'hero.headline', 'hero.headlineEmphasis', 'hero.sub', 'hero.cta', 'hero.formLabel',
    'hero.frictionReducers', 'brand.phone', 'brand.phoneHref', 'brand.license',
    'extensions.reviewBadge', 'images.hero.slides',
  ],
  sharedDeps: ['@/lib/CoverImage', '@phosphor-icons/react', '@/lib/editable', '@/lib/LeadForm'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

/** Headline with the emphasised phrase in the brand accent (editable), matching `.hero h1 .em`. */
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

export default function HvacHero({ content = CONTENT }: { content?: SiteContent }) {
  const { hero, brand, extensions, images, _meta } = content;
  const review = extensions.reviewBadge;
  const slide = images.hero?.slides?.[0]?.url ?? images.hero?.portrait;
  const mode = _meta?.selectedPlan === 'starter' ? 'email' : 'phone';
  const formLabel = hero.formLabel?.trim();
  const license = brand.license?.trim();

  return (
    <section id="top" className="relative isolate flex min-h-[560px] items-center overflow-hidden bg-inkPanel text-onInk lg:min-h-[640px]">
      {/* Full-bleed background photograph */}
      {slide && (
        <div
          className="absolute inset-0 isolate overflow-hidden"
        >
          <CoverImage url={slide} alt={images.hero?.slides?.[0]?.alt?.trim() || placeAlt(content)} sizes="100vw" priority avif position="object-[62%_50%]" />
        </div>
      )}
      {/* Navy wash: one grade for any photo (colour blend of the structural accent) */}
      <div className="absolute inset-0 bg-[color:var(--accent-2)] opacity-55 mix-blend-color" aria-hidden="true" />
      {/* Scrim: heavy over the copy, light over the photo. On a phone it climbs from the bottom. */}
      <div
        className="absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            'linear-gradient(180deg, color-mix(in srgb, var(--ink-panel) 55%, transparent), color-mix(in srgb, var(--ink-panel) 92%, transparent) 60%)',
        }}
      />
      <div
        className="absolute inset-0 hidden lg:block"
        aria-hidden="true"
        style={{
          background:
            'linear-gradient(90deg, color-mix(in srgb, var(--ink-panel) 92%, transparent) 0%, color-mix(in srgb, var(--ink-panel) 72%, transparent) 42%, color-mix(in srgb, var(--ink-panel) 18%, transparent) 78%, transparent 100%),' +
            'linear-gradient(180deg, color-mix(in srgb, var(--ink-panel) 10%, transparent), color-mix(in srgb, var(--ink-panel) 55%, transparent))',
        }}
      />

      <div
        className={`relative mx-auto grid w-full max-w-[1120px] items-center gap-9 px-5 py-14 sm:px-6 lg:gap-14 lg:py-[88px] ${
          formLabel ? 'lg:grid-cols-[1.05fr_0.95fr]' : ''
        }`}
      >
        <div className="max-w-[640px]">
          {review && (
            <div className="hero-rise flex items-center gap-[9px] text-[15px] font-bold text-onInk">
              <span className="tracking-[2px] text-[color:var(--star)]" aria-hidden="true">★★★★★</span> {review.rating}
              <span className="font-semibold text-onInkSoft">from {review.count}+ verified reviews</span>
            </div>
          )}

          <h1 className="mt-[18px] font-heading text-[42px] font-medium leading-[0.98] tracking-[-0.015em] text-onInk [text-shadow:0_3px_18px_rgba(0,0,0,0.35)] sm:text-[clamp(44px,6vw,76px)]">
            <Headline text={hero.headline} emphasis={hero.headlineEmphasis} />
          </h1>

          {hero.sub && (
            <p className="mt-5 max-w-[46ch] text-[17px] leading-[1.55] text-onInkSoft sm:text-[20px]">
              <E p="hero.sub">{hero.sub}</E>
            </p>
          )}

          <div className="hero-rise mt-8 flex flex-wrap gap-[14px]" style={{ animationDelay: '.08s' }}>
            <a
              href={brand.phoneHref}
              className="inline-flex w-full items-center justify-center gap-[10px] rounded-[10px] bg-accent px-[22px] py-[14px] font-heading text-[21px] font-semibold tracking-[0.01em] text-accentFg transition-[transform,filter] hover:-translate-y-0.5 hover:brightness-105 active:scale-[0.98] sm:w-auto"
              style={{ boxShadow: '0 10px 24px -8px color-mix(in srgb, var(--accent) 50%, transparent)' }}
            >
              <PhoneCall size={20} weight="fill" aria-hidden="true" />
              <E p="brand.phone">{brand.phone}</E>
            </a>
            <a
              href="/contact"
              className="inline-flex w-full items-center justify-center gap-2 rounded-[10px] border-2 border-ruleInk px-[22px] py-[14px] text-[16px] font-bold text-onInk transition-colors hover:border-accent hover:text-accent sm:w-auto"
            >
              <E p="hero.cta">{hero.cta}</E>
              <ArrowRight size={16} weight="bold" aria-hidden="true" />
            </a>
          </div>

          {hero.frictionReducers.length > 0 && (
            <div
              className="hero-rise mt-[34px] grid max-w-[520px] grid-cols-2 gap-x-[22px] gap-y-[10px] border-t border-ruleInk pt-5"
              style={{ animationDelay: '.16s' }}
            >
              {hero.frictionReducers.map((f, i) => (
                <span key={f} className="flex items-center gap-[9px] text-[14.5px] font-semibold leading-[1.3] text-onInk">
                  <Check size={16} weight="bold" className="shrink-0 text-accent" aria-hidden="true" />
                  <E p={`hero.frictionReducers.${i}`}>{f}</E>
                </span>
              ))}
            </div>
          )}

          {license && (
            <p className="mt-4 text-[13px] font-medium tracking-[0.02em] text-onInkSoft">
              Licensed &amp; insured · <E p="brand.license">{license}</E>
            </p>
          )}
        </div>

        {/* The lead form: the shared <LeadForm>, same props as the final CTA. Empty formLabel = off. */}
        {formLabel && (
          <div
            className="shadow-brand-3 relative z-[1] w-full rounded-[18px] bg-bg p-6 text-ink sm:p-7 lg:max-w-[460px] lg:justify-self-end"
          >
            <h2 className="font-heading text-[20px] font-semibold leading-[1.15] text-ink sm:text-[22px]">
              <E p="hero.formLabel">{formLabel}</E>
            </h2>
            <p className="mt-1.5 text-[14px] text-inkSoft">Tell us what&rsquo;s going on. We&rsquo;ll call you right back.</p>
            <LeadForm
              mode={mode}
              surface="light"
              className="mt-3.5"
              submitLabel={<E p="hero.cta">{hero.cta}</E>}
            />
            <p className="mt-3 text-center text-[13px] text-inkSoft">
              Prefer to talk now?{' '}
              <a href={brand.phoneHref} className="font-heading text-[15px] font-semibold text-accent">
                <E p="brand.phone">{brand.phone}</E>
              </a>
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
