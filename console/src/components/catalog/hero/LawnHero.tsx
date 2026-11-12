'use client';
// ─────────────────────────────────────────────────────────────────────────────
// LawnHero — "seasonal / organic / airy" hero, premium pass (2026-11-09, approved mockup).
// A full-bleed photo under a forest colour-wash and a forest scrim (heavy left, light right on
// desktop; climbing from the bottom on a phone), copy on the left with the plan PICKER
// (weekly/bi-weekly/one-time) — the only hero in the set that quotes a price — and the lead form
// card on the right. Real client-side state (useState), not static chrome: the visitor's
// selection changes which option is highlighted, which frequency the "See my price" link carries
// through to the contact form (D8), and the plan the hero form submits.
//
// "See my price" routes to /contact?frequency=<selection> — a WHITELISTED set of known values,
// never the raw param echoed. The contact page maps that param to a fixed string and seeds
// <LeadForm initialMessage>, so the field stays fully editable and nothing user-controlled
// reaches an owner email unvalidated.
//
// The price anchor reads services.items[0]?.priceFrom (the primary/weekly service) rather than
// inventing a standalone hero price field — absent → the price line is simply omitted (D5).
//
// THE LEAD FORM (operator decision 2026-11-09: every hero carries one): the shared <LeadForm>,
// titled hero.formLabel (empty = no card), with the picked plan as its editable message. On a
// phone the card follows the picker. LCP: the H1 and sub never animate; the review pill and picker
// take the pure-CSS hero-rise fade; the form card does not, so it is usable the moment it is seen.
//
// Colours are palette tokens: forest panels = ink-panel-2, light text = on-ink / on-ink-soft,
// the sun-gold emphasis and review pill = the editable accent2 slot (--accent-2), green tints =
// accent mixed into bg. Literal rgba() values left are shadow alphas only. Fixed design, no skin.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { LeadForm } from '@/lib/LeadForm';
import { HeroPhotos, heroPhotos } from '@/lib/PhotoCarousel';
import { primaryCity } from '@/lib/serviceLinks';

/** A client photo's alt when it came with none: facts only, "{business} in {city}" (never a guess at what it shows). */
const placeAlt = (c: SiteContent) => [c.brand.name, primaryCity(c)].filter(Boolean).join(' in ');

export const meta = {
  id: 'lawn-hero',
  category: 'hero',
  label: 'Lawn / Plan-picker hero',
  consumes: [
    'hero.headline', 'hero.headlineEmphasis', 'hero.sub', 'hero.formLabel', 'hero.cta',
    'extensions.reviewBadge', 'services.items', 'images.hero.slides',
  ],
  sharedDeps: ['@/lib/PhotoCarousel', '@/lib/CoverImage', '@/lib/editable', '@/lib/LeadForm'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

const FREQUENCIES = [
  { key: 'weekly', label: 'Weekly', sub: 'Mar to Oct' },
  { key: 'biweekly', label: 'Bi-weekly', sub: 'Year-round' },
  { key: 'onetime', label: 'One-time', sub: 'Cleanup' },
] as const;

/** Headline with the emphasised phrase in the editable accent2 slot (sun gold in the mockup). */
function Headline({ text, emphasis }: { text: string; emphasis: string | null }) {
  if (!emphasis) return <>{text}</>;
  const i = text.indexOf(emphasis);
  if (i === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <span className="text-[color:var(--accent-2)]">{emphasis}</span>
      {text.slice(i + emphasis.length)}
    </>
  );
}

export default function LawnHero({ content = CONTENT }: { content?: SiteContent }) {
  const { hero, extensions, services, images, _meta } = content;
  const [selected, setSelected] = useState<(typeof FREQUENCIES)[number]['key']>('weekly');
  // The hero lead form (operator decision 2026-11-09): the shared <LeadForm> beside the picker.
  // The picked plan travels with the submission as the editable message, the same contract
  // LawnContact honours from ?frequency=. An empty hero.formLabel switches the card off.
  const mode = _meta?.selectedPlan === 'starter' ? 'email' : 'phone';
  const formLabel = hero.formLabel?.trim();
  const plan = FREQUENCIES.find((f) => f.key === selected) ?? FREQUENCIES[0];
  const slide = images.hero?.slides?.[0]?.url ?? images.hero?.portrait;
  // Every general work photo, photo 1 first (Xander 2026-11-11: more than one goes in a carousel).
  const photos = heroPhotos(content, placeAlt(content));
  const review = extensions.reviewBadge;
  // items[0], not a find() over all items: the <E> edit path below has to name a FIXED index,
  // and a find() that lands on item 2 while the edit path says item 0 writes the operator's
  // change to the wrong service with no error anywhere. The first service is the primary one
  // (weekly, in every lawn preset); unpriced → no price line (D5).
  const priceFrom = services.items[0]?.priceFrom;

  return (
    <section className="relative isolate flex items-center overflow-hidden bg-inkPanel2 text-onInk lg:min-h-[660px]">
      {slide && (
        <HeroPhotos photos={photos} controlsClassName="bottom-3 left-5 sm:left-6 lg:bottom-6" />
      )}
      {/* Forest wash: one grade for any client photo (colour blend of the forest panel). */}
      <div className="absolute inset-0 bg-inkPanel2 opacity-35 mix-blend-color" aria-hidden="true" />
      {/* Scrim: on a phone it climbs from the bottom; on desktop heavy over the copy, light over the photo. */}
      <div
        className="absolute inset-0 lg:hidden"
        aria-hidden="true"
        style={{
          background:
            'linear-gradient(180deg, color-mix(in srgb, var(--ink-panel-2) 62%, transparent), color-mix(in srgb, var(--ink-panel-2) 92%, transparent) 60%)',
        }}
      />
      <div
        className="absolute inset-0 hidden lg:block"
        aria-hidden="true"
        style={{
          background:
            'linear-gradient(95deg, color-mix(in srgb, var(--ink-panel-2) 90%, transparent) 0%, color-mix(in srgb, var(--ink-panel-2) 62%, transparent) 46%, color-mix(in srgb, var(--ink-panel-2) 14%, transparent) 100%),' +
            'linear-gradient(180deg, color-mix(in srgb, var(--ink-panel-2) 10%, transparent), color-mix(in srgb, var(--ink-panel-2) 50%, transparent))',
        }}
      />

      <div
        className={`relative mx-auto grid w-full max-w-[1120px] items-center gap-8 px-5 pb-12 pt-14 sm:px-6 lg:gap-12 lg:py-[88px] ${
          formLabel ? 'lg:grid-cols-[1.05fr_0.95fr]' : ''
        }`}
      >
        <div className="min-w-0 max-w-[620px]">
          {review && (
            <span
              className="hero-rise inline-flex items-center gap-2 rounded-full border px-[15px] py-[7px] text-[13px] font-bold text-[color:var(--accent-2)]"
              style={{
                borderColor: 'color-mix(in srgb, var(--accent-2) 42%, transparent)',
                background: 'color-mix(in srgb, var(--accent-2) 18%, transparent)',
              }}
            >
              ★ {review.rating} from {review.count}+ neighbours
            </span>
          )}

          <h1 className="mt-5 font-heading text-[42px] font-extrabold leading-none tracking-[-0.02em] text-onInk sm:text-[clamp(44px,5.6vw,68px)]">
            <Headline text={hero.headline} emphasis={hero.headlineEmphasis} />
          </h1>

          {hero.sub && (
            <p className="mt-[18px] max-w-[46ch] text-[17px] leading-[1.6] text-onInkSoft sm:text-[18.5px]">
              <E p="hero.sub">{hero.sub}</E>
            </p>
          )}

          {/* The plan picker — lawn care's signature hero device (D8). Real state, not chrome.
              Full 18px inner padding on every edge: nothing inside touches the panel's border. */}
          <div
            className="hero-rise mt-7 max-w-[520px] rounded-[22px] border p-[18px] backdrop-blur-md"
            style={{
              animationDelay: '.08s',
              borderColor: 'color-mix(in srgb, var(--on-ink) 20%, transparent)',
              background: 'color-mix(in srgb, var(--on-ink) 10%, transparent)',
            }}
          >
            <div className="text-[12px] font-bold uppercase tracking-[0.13em] text-onInkSoft">How often?</div>
            <div className="mt-[11px] grid grid-cols-3 gap-2">
              {FREQUENCIES.map((f) => {
                const on = selected === f.key;
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setSelected(f.key)}
                    aria-pressed={on}
                    className={`min-w-0 rounded-[13px] border-[1.5px] px-2 py-3 text-center text-[14px] font-bold leading-[1.2] transition-colors ${
                      on ? 'border-onInk bg-onInk text-inkPanel2' : 'text-onInk'
                    }`}
                    style={on ? undefined : { borderColor: 'color-mix(in srgb, var(--on-ink) 22%, transparent)' }}
                  >
                    {f.label}
                    <small
                      className="mt-[3px] block text-[11.5px] font-semibold leading-none"
                      style={{
                        color: on
                          ? 'color-mix(in srgb, var(--ink-panel-2) 60%, var(--on-ink))'
                          : 'var(--on-ink-soft)',
                      }}
                    >
                      {f.sub}
                    </small>
                  </button>
                );
              })}
            </div>
            <div
              className="mt-[15px] flex items-center justify-between gap-3.5 border-t pt-[14px]"
              style={{ borderColor: 'color-mix(in srgb, var(--on-ink) 18%, transparent)' }}
            >
              {priceFrom ? (
                <div className="font-heading text-[17px] font-extrabold leading-none tracking-[-0.015em] text-onInk">
                  <E p="services.items.0.priceFrom">{priceFrom}</E>{' '}
                  <small className="font-sans text-[12.5px] font-semibold text-onInkSoft">/ visit</small>
                </div>
              ) : (
                <span />
              )}
              <a
                href={`/contact?frequency=${selected}`}
                className="inline-flex shrink-0 items-center whitespace-nowrap rounded-[14px] bg-accent px-[18px] py-[11px] text-[14.5px] font-bold text-accentFg transition-[transform,filter] hover:-translate-y-0.5 hover:brightness-105 active:scale-[0.98]"
                style={{ boxShadow: '0 10px 24px -8px color-mix(in srgb, var(--accent) 55%, transparent)' }}
              >
                See my price →
              </a>
            </div>
          </div>
        </div>

        {formLabel && (
          <div
            className="shadow-brand-3 relative z-[1] w-full rounded-[22px] bg-bg p-6 text-ink sm:p-7 lg:max-w-[460px] lg:justify-self-end"
          >
            <h2 className="font-heading text-[20px] font-extrabold leading-[1.15] tracking-[-0.02em] text-ink sm:text-[22px]">
              <E p="hero.formLabel">{formLabel}</E>
            </h2>
            <p className="mt-1.5 text-[14px] text-inkSoft">We&rsquo;ll call you back with a quote.</p>
            <span
              className="mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12.5px] font-bold text-accent"
              style={{ background: 'color-mix(in srgb, var(--accent) 12%, var(--bg))' }}
            >
              Plan: {plan.label}
            </span>
            <LeadForm
              key={selected}
              mode={mode}
              withMessage
              initialMessage={`Mowing frequency: ${plan.label} (${plan.sub})`}
              surface="light"
              className="mt-3.5"
              submitLabel={<E p="hero.cta">{hero.cta}</E>}
            />
          </div>
        )}
      </div>
    </section>
  );
}
