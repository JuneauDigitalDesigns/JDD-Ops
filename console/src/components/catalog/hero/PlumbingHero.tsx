'use client';
// ─────────────────────────────────────────────────────────────────────────────
// PlumbingHero — "a plumbing emergency is a dispatch problem" hero, premium pass (2026-11-09,
// approved mockup). Still a SPLIT PANEL, not a photo with a scrim: the deep-navy left holds the
// live-dispatch pill, the headline (emphasis in the editable accent2 light blue), the sub and the
// reducer pills; the right column is the photo under a navy colour wash with the seam gradient,
// and the INTAKE CARD sits on it, beside the copy. On a phone the card follows the copy, with the
// photo behind it fading in from the panel above.
//
// The intake card is the hero's lead form: a real <LeadForm> (plan-derived mode, D11/D9 — same
// reasoning as RoofingHero's storm-damage card), always mounted, with its own fixed title and
// "Get a callback now" label, not the mockup's two-bare-input illustration.
//
// The original mockup's live-dispatch pill read "3 trucks out now · next slot today 2:40pm" — a
// specific fleet count and a specific time. Shipped verbatim that becomes a fabricated operational
// claim on every client's site regardless of their actual fleet size (PLAN D4: never invent a fact
// about the business). This renders the same urgency texture with no invented number instead.
//
// LCP: the H1 and sub never animate; the reducer pills take the pure-CSS hero-rise. The form
// card does not fade in: a form should be usable the moment it is seen.
// Colours: every one is a palette token (ink-panel-2, on-ink, accent, accent-2), plus the fixed
// --live semantic for the green dot. Shadow alphas are mixes of ink-panel. Fixed design, no skin.
// ─────────────────────────────────────────────────────────────────────────────
import { Phone } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { LeadForm } from '@/lib/LeadForm';
import { HeroPhotos, heroPhotos } from '@/lib/PhotoCarousel';
import { primaryCity } from '@/lib/serviceLinks';

/** A client photo's alt when it came with none: facts only, "{business} in {city}" (never a guess at what it shows). */
const placeAlt = (c: SiteContent) => [c.brand.name, primaryCity(c)].filter(Boolean).join(' in ');

export const meta = {
  id: 'plumbing-hero',
  category: 'hero',
  label: 'Plumbing / Split intake hero',
  consumes: ['hero.headline', 'hero.headlineEmphasis', 'hero.sub', 'hero.frictionReducers', 'brand.phone', 'brand.phoneHref', 'images.hero.slides'],
  sharedDeps: ['@/lib/PhotoCarousel', '@/lib/CoverImage', '@phosphor-icons/react', '@/lib/editable', '@/lib/LeadForm'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

/** Headline with the emphasised phrase in the editable accent2 (light blue), matching `.pl-hero h1 .em`. */
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

export default function PlumbingHero({ content = CONTENT }: { content?: SiteContent }) {
  const { hero, brand, images, _meta } = content;
  const slide = images.hero?.slides?.[0]?.url ?? images.hero?.portrait;
  // Every general work photo, photo 1 first (Xander 2026-11-11: more than one goes in a carousel).
  const photos = heroPhotos(content, placeAlt(content));
  const mode = _meta?.selectedPlan === 'starter' ? 'email' : 'phone';

  return (
    <header className="grid grid-cols-1 bg-inkPanel2 text-onInk lg:min-h-[640px] lg:grid-cols-[1.02fr_0.98fr]">
      <div className="flex items-center px-5 pb-10 pt-14 sm:px-6 lg:py-[88px] lg:pl-0 lg:pr-14">
        <div className="w-full max-w-[560px] lg:ml-auto lg:pl-6">
          <span
            className="inline-flex items-center gap-[9px] rounded-full border px-[15px] py-[7px] text-[13px] font-bold leading-[1.2] text-onInkSoft"
            style={{
              borderColor: 'color-mix(in srgb, var(--on-ink) 22%, transparent)',
              background: 'color-mix(in srgb, var(--on-ink) 12%, transparent)',
            }}
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full bg-[color:var(--live)]"
              style={{ boxShadow: '0 0 0 4px color-mix(in srgb, var(--live) 22%, transparent)' }}
              aria-hidden="true"
            />
            Taking calls now
          </span>

          <h1 className="mt-[22px] font-heading text-[40px] font-extrabold leading-none tracking-[-0.02em] text-onInk sm:text-[clamp(42px,5.2vw,64px)]">
            <Headline text={hero.headline} emphasis={hero.headlineEmphasis} />
          </h1>

          {hero.sub && (
            <p className="mt-[18px] max-w-[44ch] text-[17px] leading-[1.6] text-onInkSoft sm:text-[18px]">
              <E p="hero.sub">{hero.sub}</E>
            </p>
          )}

          {hero.frictionReducers.length > 0 && (
            <div className="hero-rise mt-6 flex flex-wrap gap-[9px]">
              {hero.frictionReducers.map((f, i) => (
                <span
                  key={f}
                  className="flex items-center gap-[7px] rounded-full px-[14px] py-[7px] text-[13.5px] font-semibold leading-[1.2] text-onInkSoft"
                  style={{ background: 'color-mix(in srgb, var(--on-ink) 8%, transparent)' }}
                >
                  <E p={`hero.frictionReducers.${i}`}>{f}</E>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Photo column: the intake card sits on it, beside the copy (after it on a phone). */}
      <div className="relative grid items-center justify-items-start overflow-hidden px-5 pb-12 sm:px-6 lg:min-h-[300px] lg:justify-items-center lg:py-14 lg:pl-10 lg:pr-6">
        {slide && (
          <>
            <HeroPhotos photos={photos} controlsClassName="bottom-3 right-4 lg:bottom-5 lg:right-6" />
            {/* Navy wash: one grade for any client photo (colour blend of accent2). */}
            <div className="absolute inset-0 bg-accent opacity-40 mix-blend-color" aria-hidden="true" />
            {/* Seam: the panel runs into the photo. Top-down on a phone, left-to-right on desktop. */}
            <div
              className="absolute inset-0 lg:hidden"
              aria-hidden="true"
              style={{ background: 'linear-gradient(180deg, var(--ink-panel-2), transparent 45%, color-mix(in srgb, var(--ink-panel-2) 70%, transparent))' }}
            />
            <div
              className="absolute inset-0 hidden lg:block"
              aria-hidden="true"
              style={{ background: 'linear-gradient(90deg, var(--ink-panel-2), transparent 42%)' }}
            />
          </>
        )}

        {/* The intake card — the hero's lead form. */}
        <div
          className="relative z-[3] w-full rounded-[20px] bg-bg p-[22px] text-ink sm:max-w-[560px] sm:p-[26px] lg:max-w-[440px]"
          style={{
            boxShadow:
              '0 10px 24px color-mix(in srgb, var(--ink-panel) 14%, transparent), 0 40px 70px -30px color-mix(in srgb, var(--ink-panel) 50%, transparent)',
          }}
        >
          <div className="font-heading text-[20px] font-extrabold leading-[1.15] tracking-[-0.02em] text-ink">What&apos;s going on?</div>
          <p className="mt-1.5 text-[13.5px] leading-[1.5] text-inkSoft">Tell us what&apos;s going on. We&apos;ll call you right back.</p>
          <LeadForm mode={mode} surface="light" className="mt-3.5" submitLabel="Get a callback now" />
          <a href={brand.phoneHref} className="mt-3 flex items-center justify-center gap-1.5 text-[13.5px] font-semibold text-inkSoft transition-colors hover:text-ink">
            <Phone size={14} weight="fill" className="text-accent" aria-hidden="true" />
            Or call <E p="brand.phone">{brand.phone}</E>
          </a>
        </div>
      </div>
    </header>
  );
}
