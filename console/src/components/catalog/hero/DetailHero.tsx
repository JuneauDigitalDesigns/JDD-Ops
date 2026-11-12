'use client';
// ─────────────────────────────────────────────────────────────────────────────
// DetailHero — "finish only reads against black" hero, premium pass (2026-11-09, approved mockup).
// CENTRED and vignetted (every other vertical's hero is left-anchored): a radial + linear scrim
// over a desaturated photo, a thin champagne hairline above the headline (emphasis in the accent),
// the sub, the accent phone button + ghost "See packages", and the friction row under a hairline
// divider as uppercase tracked labels. On a phone the hero drops its min-height and both buttons
// go full width.
//
// "See packages →" routes to /services, not /contact (PLAN D16 — the one allowlisted exception
// to the universal CTA-routes-to-/contact rule, EXEC T9.2/cta-routing.test.mjs). It is a browse
// action (pick a package) that feeds into the real conversion action, not a conversion itself.
//
// THE LEAD FORM (operator decision 2026-11-09: every hero carries one): the shared <LeadForm>,
// same props as the final CTA, in a wide row-layout glass card under the reducers so the centred
// composition holds (the row stacks on a phone). Its title is hero.formLabel; an EMPTY label
// switches it off for a site.
//
// LCP: the H1, sub and form card never animate; the buttons and reducers take the pure-CSS
// hero-rise fade. Every colour is a palette token (ink-panel, on-ink, accent, rule). The glass
// card is bg mixed toward ink, which is the slate the mockup draws: this palette's derived
// --ink-panel-2 is accent-tinted (olive) and would swallow the rule around the card.
// ─────────────────────────────────────────────────────────────────────────────
import { Phone, ArrowRight } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { LeadForm } from '@/lib/LeadForm';
import { imageAt } from '@/lib/localImage';

export const meta = {
  id: 'detail-hero',
  category: 'hero',
  label: 'Car Detailing / Centred vignette hero',
  consumes: ['hero.headline', 'hero.headlineEmphasis', 'hero.sub', 'hero.cta', 'hero.formLabel', 'hero.frictionReducers', 'brand.phone', 'brand.phoneHref', 'images.hero.slides'],
  sharedDeps: ['@phosphor-icons/react', '@/lib/editable', '@/lib/LeadForm', '@/lib/localImage'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

/** Headline with the emphasised phrase in the accent (champagne), matching `.hero h1 .em`. */
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

/** The near-black panel at a given opacity, for the vignette scrim. */
const panel = (pct: number) => `color-mix(in srgb, var(--ink-panel) ${pct}%, transparent)`;

export default function DetailHero({ content = CONTENT }: { content?: SiteContent }) {
  const { hero, brand, images, _meta } = content;
  const slide = images.hero?.slides?.[0]?.url ?? images.hero?.portrait;
  // The hero lead form (operator decision 2026-11-09): the shared <LeadForm>, same props as the
  // final CTA, in a wide row-layout card under the reducers so the centred composition holds.
  // An empty hero.formLabel switches it off for a site.
  const mode = _meta?.selectedPlan === 'starter' ? 'email' : 'phone';
  const formLabel = hero.formLabel?.trim();

  return (
    <header className="relative isolate flex items-center overflow-hidden bg-inkPanel text-center text-onInk sm:min-h-[700px]">
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
            `radial-gradient(120% 90% at 50% 40%, transparent 18%, ${panel(72)} 68%, ${panel(95)} 100%),` +
            `linear-gradient(180deg, ${panel(62)}, ${panel(42)} 42%, ${panel(93)})`,
        }}
      />

      <div className="relative mx-auto w-full max-w-[860px] px-5 pb-12 pt-16 sm:px-6 sm:py-[104px]">
        <div
          className="mx-auto h-px w-[72px]"
          style={{ background: 'linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 65%, black) 60%, transparent)' }}
          aria-hidden="true"
        />

        <h1 className="mt-[22px] font-heading text-[42px] font-extrabold leading-[0.98] tracking-[-0.016em] text-onInk sm:text-[clamp(44px,6vw,74px)]">
          <Headline text={hero.headline} emphasis={hero.headlineEmphasis} />
        </h1>

        {hero.sub && (
          <p className="mx-auto mt-5 max-w-[52ch] text-[17px] leading-[1.62] text-onInkSoft sm:text-[18.5px]">
            <E p="hero.sub">{hero.sub}</E>
          </p>
        )}

        <div className="hero-rise mt-8 flex flex-wrap justify-center gap-[13px]">
          <a
            href={brand.phoneHref}
            className="inline-flex w-full items-center justify-center gap-[10px] rounded-[8px] bg-accent px-[22px] py-[14px] font-heading text-[16px] font-extrabold text-accentFg transition-[transform,filter] hover:-translate-y-0.5 hover:brightness-105 active:scale-[0.98] sm:w-auto"
            style={{ boxShadow: '0 10px 24px -8px color-mix(in srgb, var(--accent) 55%, transparent)' }}
          >
            <Phone size={18} weight="fill" aria-hidden="true" />
            <E p="brand.phone">{brand.phone}</E>
          </a>
          <a
            href="/services"
            className="inline-flex w-full items-center justify-center gap-2 rounded-[8px] border-2 border-[color:color-mix(in_srgb,var(--on-ink)_22%,transparent)] px-[22px] py-[14px] text-[16px] font-bold text-onInk transition-[color,border-color,transform] hover:-translate-y-0.5 hover:border-accent hover:text-accent active:scale-[0.98] sm:w-auto"
          >
            See packages
            <ArrowRight size={16} weight="bold" aria-hidden="true" />
          </a>
        </div>

        {hero.frictionReducers.length > 0 && (
          <div
            className="hero-rise mx-auto mt-[34px] flex max-w-[620px] flex-wrap justify-center gap-x-[34px] gap-y-2 border-t border-[color:color-mix(in_srgb,var(--on-ink)_14%,transparent)] pt-6"
            style={{ animationDelay: '.08s' }}
          >
            {hero.frictionReducers.map((f, i) => (
              <span key={f} className="text-[12px] font-bold uppercase leading-none tracking-[0.17em] text-inkSoft">
                <E p={`hero.frictionReducers.${i}`}>{f}</E>
              </span>
            ))}
          </div>
        )}

        {formLabel && (
          <div
            className="relative z-[1] mx-auto mt-9 max-w-[820px] rounded-[12px] border border-rule p-[18px] text-left sm:px-6 sm:py-[22px]"
            style={{
              background: 'color-mix(in srgb, color-mix(in srgb, var(--bg) 93%, var(--ink)) 85%, transparent)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <h2 className="font-heading text-[19px] font-extrabold tracking-[-0.016em] text-onInk">
              <E p="hero.formLabel">{formLabel}</E>
            </h2>
            <LeadForm
              mode={mode}
              surface="dark"
              layout="row"
              className="mt-3.5"
              submitLabel={<E p="hero.cta">{hero.cta}</E>}
            />
          </div>
        )}
      </div>
    </header>
  );
}
