'use client';
// ─────────────────────────────────────────────────────────────────────────────
// RoofingHero — "structural / weatherproof" hero, mirrored 1:1 (design: home-mockups.html
// #roofing .hero). A full-bleed photograph under a scrim that climbs from the BOTTOM (not
// left-to-right like HVAC's) so the sky stays legible — a roof needs sky. Copy sits bottom-left:
// an amber kicker, a condensed (Archivo 800) headline with an amber emphasis word, a sub, a
// clay phone button + a ghost "Book a free inspection" link, and a friction-reducer pill row.
// The right column is the storm-damage card — the one urgent object on the page, and the one
// non-phone CTA on this page that is a real lead-capture form (D9), not the illustrative
// single-email-input the mockup draws: LeadForm always needs a name, and its mode stays
// plan-derived (D11) so the Retell callback keeps working for growth/enterprise.
// Content stays schema-driven. Fixed design, no skin.
// ─────────────────────────────────────────────────────────────────────────────
import { Phone, ArrowRight } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { LeadForm } from '@/lib/LeadForm';

export const meta = {
  id: 'roofing-hero',
  category: 'hero',
  label: 'Roofing / Standard hero',
  consumes: [
    'hero.headline', 'hero.headlineEmphasis', 'hero.sub', 'hero.cta', 'hero.frictionReducers',
    'brand.phone', 'brand.phoneHref', 'images.hero.slides',
  ],
  sharedDeps: ['@phosphor-icons/react', '@/lib/editable', '@/lib/LeadForm'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

/** Headline with the emphasised phrase in amber, matching `.hero h1 .em`. */
function Headline({ text, emphasis }: { text: string; emphasis: string | null }) {
  if (!emphasis) return <>{text}</>;
  const i = text.indexOf(emphasis);
  if (i === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <span className="text-[#E8A33D]">{emphasis}</span>
      {text.slice(i + emphasis.length)}
    </>
  );
}

export default function RoofingHero({ content = CONTENT }: { content?: SiteContent }) {
  const { hero, brand, images, _meta } = content;
  const slide = images.hero?.slides?.[0]?.url ?? images.hero?.portrait;
  const mode = _meta?.selectedPlan === 'starter' ? 'email' : 'phone';

  return (
    <section className="relative isolate flex min-h-[640px] items-end overflow-hidden bg-[#241E1B]">
      {slide && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${slide})` }}
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
            'linear-gradient(180deg,rgba(23,17,15,.28) 0%,rgba(23,17,15,.10) 30%,' +
            'rgba(23,17,15,.82) 78%,rgba(23,17,15,.95) 100%)',
        }}
      />

      <div className="relative mx-auto grid w-full max-w-[1160px] grid-cols-1 gap-12 px-6 pb-24 pt-[140px] lg:grid-cols-[1fr_330px] lg:items-end">
        <div className="max-w-[660px] text-[#fff]">
          <span className="inline-flex items-center border-l-[3px] border-[#E8A33D] pl-[11px] text-[12px] font-bold uppercase tracking-[0.2em] text-[#E8A33D]">
            Licensed · Bonded · GAF Certified
          </span>

          <h1 className="mt-5 font-heading text-[clamp(42px,5.8vw,66px)] font-extrabold leading-[0.98] tracking-[-0.024em] text-[#fff]">
            <Headline text={hero.headline} emphasis={hero.headlineEmphasis} />
          </h1>

          <p className="mt-[18px] max-w-[48ch] text-[18.5px] leading-[1.6] text-[#D6C9C0]">
            <E p="hero.sub">{hero.sub}</E>
          </p>

          <div className="mt-[30px] flex flex-wrap gap-3">
            <a
              href={brand.phoneHref}
              className="inline-flex items-center gap-[10px] rounded-[4px] bg-accent px-[22px] py-[14px] font-heading text-[18px] font-extrabold tracking-[-0.01em] text-accentFg"
            >
              <Phone size={20} weight="fill" aria-hidden="true" />
              <E p="brand.phone">{brand.phone}</E>
            </a>
            <a
              href="/contact"
              className="inline-flex items-center gap-2 rounded-[4px] border-2 border-[rgba(255,255,255,0.4)] px-[22px] py-[14px] text-[16px] font-bold text-[#fff] transition-colors hover:border-accent hover:text-accent"
            >
              <E p="hero.cta">{hero.cta}</E>
              <ArrowRight size={16} weight="bold" aria-hidden="true" />
            </a>
          </div>

          {hero.frictionReducers.length > 0 && (
            <div className="mt-[26px] flex flex-wrap gap-2">
              {hero.frictionReducers.map((f, i) => (
                <span
                  key={f}
                  className="border border-[rgba(255,255,255,0.22)] px-3 py-[7px] text-[12.5px] font-bold uppercase tracking-[0.08em] text-[#D6C9C0]"
                >
                  <E p={`hero.frictionReducers.${i}`}>{f}</E>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Storm-damage card — the one urgent object on the page, and a real lead-capture form. */}
        <div className="relative z-[1] border-t-4 border-[#E8A33D] bg-bg p-6">
          <div className="font-heading text-[21px] font-extrabold tracking-[-0.02em] text-ink">Storm damage?</div>
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
