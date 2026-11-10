'use client';
// ─────────────────────────────────────────────────────────────────────────────
// RoofingHero — "structural / weatherproof" hero, premium pass (2026-11-09, approved mockup).
// A full-bleed photograph under a scrim that climbs from the BOTTOM (not left-to-right like
// HVAC's) so the sky stays legible — a roof needs sky. Copy sits bottom-left: the hardcoded
// kicker on a frosted panel with the emphasis-colour bar, an Archivo 800 headline up to 78px with
// the emphasis word in accent2, the sub, the accent phone button + a ghost link to /contact, and
// the squared uppercase reducer tags.
//
// The right column is the storm-damage card: the one urgent object on the page, and the hero's
// lead form (D9), so no second form is added. It is the real @jdd/ui <LeadForm> (not the
// mockup's illustrative inputs), mode plan-derived (D11) so the Retell callback keeps working.
// The card now carries the premium shadow and 6px lower corners. Buttons and tags take
// the pure-CSS hero-rise (reduced-motion → none); the H1, sub and the form card never animate.
//
// Colours: every one is a palette token — the ground is ink-panel-2, the scrim mixes ink-panel,
// the amber that used to be hardcoded is var(--accent-2) (the editable accent2 slot), greys on
// dark are on-ink-soft. The only literal rgba is the card's shadow alpha, via shadow-brand-3.
// ─────────────────────────────────────────────────────────────────────────────
import { Phone, ArrowRight } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { LeadForm } from '@/lib/LeadForm';
import { imageAt } from '@/lib/localImage';

export const meta = {
  id: 'roofing-hero',
  category: 'hero',
  label: 'Roofing / Standard hero',
  consumes: [
    'hero.headline', 'hero.headlineEmphasis', 'hero.sub', 'hero.cta', 'hero.frictionReducers',
    'brand.phone', 'brand.phoneHref', 'images.hero.slides',
  ],
  sharedDeps: ['@phosphor-icons/react', '@/lib/editable', '@/lib/LeadForm', '@/lib/localImage'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

/** Headline with the emphasised phrase in accent2 (editable), matching `.rf-hero h1 .em`. */
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

export default function RoofingHero({ content = CONTENT }: { content?: SiteContent }) {
  const { hero, brand, images, _meta } = content;
  const slide = images.hero?.slides?.[0]?.url ?? images.hero?.portrait;
  const mode = _meta?.selectedPlan === 'starter' ? 'email' : 'phone';

  return (
    <section className="relative isolate flex items-end overflow-hidden bg-inkPanel2 text-onInk lg:min-h-[660px]">
      {slide && (
        <div
          className="absolute inset-0 bg-cover bg-[center_30%]"
          style={{ backgroundImage: `url(${imageAt(slide, 1536)})` }}
          role="img"
          aria-label={images.hero?.slides?.[0]?.alt ?? `${brand.name} roof`}
        />
      )}
      {/* Scrim climbs from the BOTTOM — sky stays visible, unlike HVAC's left-to-right scrim. */}
      <div
        className="absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            'linear-gradient(180deg, color-mix(in srgb, var(--ink-panel) 22%, transparent) 0%, color-mix(in srgb, var(--ink-panel) 6%, transparent) 32%, ' +
            'color-mix(in srgb, var(--ink-panel) 84%, transparent) 74%, color-mix(in srgb, var(--ink-panel) 96%, transparent) 100%)',
        }}
      />

      <div className="relative mx-auto grid w-full max-w-[1120px] grid-cols-1 gap-8 px-5 pb-12 pt-16 sm:px-6 lg:grid-cols-[1fr_360px] lg:items-end lg:gap-12 lg:pb-[88px] lg:pt-[150px]">
        <div className="min-w-0 max-w-[680px]">
          <span className="inline-flex items-center border-l-[3px] border-[color:var(--accent-2)] py-2 pl-[11px] pr-3 text-[12px] font-bold uppercase tracking-[0.2em] text-[color:var(--accent-2)] backdrop-blur-[6px]" style={{ background: 'color-mix(in srgb, var(--ink-panel) 55%, transparent)' }}>
            Licensed · Bonded · GAF Certified
          </span>

          <h1 className="mt-[22px] text-balance font-heading text-[44px] font-extrabold leading-[0.95] tracking-[-0.024em] text-onInk sm:text-[clamp(46px,6.2vw,78px)]">
            <Headline text={hero.headline} emphasis={hero.headlineEmphasis} />
          </h1>

          <p className="mt-5 max-w-[48ch] text-[17px] leading-[1.6] text-onInkSoft sm:text-[19px]">
            <E p="hero.sub">{hero.sub}</E>
          </p>

          <div className="hero-rise mt-[30px] flex flex-wrap gap-3">
            <a
              href={brand.phoneHref}
              className="inline-flex items-center gap-[10px] rounded-[4px] bg-accent px-[22px] py-[14px] font-heading text-[18px] font-extrabold tracking-[-0.01em] text-accentFg transition-[transform,filter] hover:-translate-y-0.5 hover:brightness-105 active:scale-[0.98]"
              style={{ boxShadow: '0 10px 24px -8px color-mix(in srgb, var(--accent) 55%, transparent)' }}
            >
              <Phone size={20} weight="fill" aria-hidden="true" />
              <E p="brand.phone">{brand.phone}</E>
            </a>
            <a
              href="/contact"
              className="inline-flex items-center gap-2 rounded-[4px] border-2 border-[color:color-mix(in_srgb,var(--on-ink)_40%,transparent)] px-[22px] py-[14px] text-[16px] font-bold text-onInk transition-[color,border-color,transform] hover:-translate-y-0.5 hover:border-accent hover:text-accent active:scale-[0.98]"
            >
              <E p="hero.cta">{hero.cta}</E>
              <ArrowRight size={16} weight="bold" aria-hidden="true" />
            </a>
          </div>

          {hero.frictionReducers.length > 0 && (
            <div className="hero-rise mt-[26px] flex flex-wrap gap-2" style={{ animationDelay: '.08s' }}>
              {hero.frictionReducers.map((f, i) => (
                <span
                  key={f}
                  className="border border-[color:color-mix(in_srgb,var(--on-ink)_22%,transparent)] px-3 py-[7px] text-[12.5px] font-bold uppercase tracking-[0.08em] text-onInkSoft"
                >
                  <E p={`hero.frictionReducers.${i}`}>{f}</E>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Storm-damage card — the one urgent object on the page, and the hero's lead form. */}
        <div
          className="shadow-brand-3 relative z-[1] rounded-b-[6px] border-t-4 border-[color:var(--accent-2)] bg-bg p-[22px] text-ink sm:p-[26px]"
        >
          <div className="font-heading text-[20px] font-extrabold tracking-[-0.024em] text-ink sm:text-[22px]">Storm damage?</div>
          <p className="mt-[9px] text-[14px] leading-[1.55] text-inkSoft">
            Hail and wind claims have a filing deadline. We inspect free, document everything, and
            deal with the adjuster for you.
          </p>
          <LeadForm
            mode={mode}
            surface="light"
            layout="stack"
            className="mt-4 border-t border-rule pt-4"
            submitLabel="Get a free inspection"
          />
        </div>
      </div>
    </section>
  );
}
