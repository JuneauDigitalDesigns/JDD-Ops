'use client';
// ─────────────────────────────────────────────────────────────────────────────
// PlumbingHero — "a plumbing emergency is a dispatch problem" hero, mirrored from home-
// mockups.html #plumbing .hero/.intake. A SPLIT PANEL, not a photo with a scrim: solid deep-blue
// left with the lead-capture form living INSIDE the hero ("the intake card"), photo right with a
// left-to-right tint so the panel seam stays readable. The intake card is a real <LeadForm>
// (plan-derived mode, D11/D9 — same reasoning as RoofingHero's storm-damage card), not the
// mockup's two-bare-input illustration.
//
// The mockup's live-dispatch pill reads "3 trucks out now · next slot today 2:40pm" — a specific
// fleet count and a specific time. Shipped verbatim that becomes a fabricated operational claim
// on every client's site regardless of their actual fleet size (PLAN D4: never invent a fact
// about the business). This renders the same urgency texture with no invented number instead.
// Fixed design, no skin.
// ─────────────────────────────────────────────────────────────────────────────
import { Phone } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { LeadForm } from '@/lib/LeadForm';
import { imageAt } from '@/lib/localImage';

export const meta = {
  id: 'plumbing-hero',
  category: 'hero',
  label: 'Plumbing / Split intake hero',
  consumes: ['hero.headline', 'hero.headlineEmphasis', 'hero.sub', 'hero.frictionReducers', 'brand.phone', 'brand.phoneHref', 'images.hero.slides'],
  sharedDeps: ['@phosphor-icons/react', '@/lib/editable', '@/lib/LeadForm'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

/** Headline with the emphasised phrase in light blue, matching `.hero h1 .em`. */
function Headline({ text, emphasis }: { text: string; emphasis: string | null }) {
  if (!emphasis) return <>{text}</>;
  const i = text.indexOf(emphasis);
  if (i === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <span className="text-[#6FC4F5]">{emphasis}</span>
      {text.slice(i + emphasis.length)}
    </>
  );
}

export default function PlumbingHero({ content = CONTENT }: { content?: SiteContent }) {
  const { hero, brand, images, _meta } = content;
  const slide = images.hero?.slides?.[0]?.url ?? images.hero?.portrait;
  const mode = _meta?.selectedPlan === 'starter' ? 'email' : 'phone';

  return (
    <header className="grid min-h-[620px] grid-cols-1 bg-[#0E2A3D] lg:grid-cols-[1.02fr_0.98fr]">
      <div className="flex items-center px-6 py-[72px] lg:px-0 lg:py-[84px] lg:pr-14">
        <div className="w-full max-w-[560px] lg:ml-auto lg:pl-6">
          <span className="inline-flex items-center gap-[9px] rounded-full border border-[rgba(255,255,255,0.22)] bg-[rgba(255,255,255,0.12)] px-[15px] py-[7px] text-[13px] font-bold text-[#CFE3F1]">
            <span className="h-2 w-2 rounded-full bg-[#49D18B] shadow-[0_0_0_4px_rgba(73,209,139,0.22)]" aria-hidden="true" />
            Taking calls now · same-day slots available
          </span>

          <h1 className="mt-5 font-heading text-[clamp(38px,4.6vw,56px)] font-extrabold leading-[1.02] tracking-[-0.02em] text-[#fff]">
            <Headline text={hero.headline} emphasis={hero.headlineEmphasis} />
          </h1>

          <p className="mt-4 max-w-[44ch] text-[18px] leading-[1.6] text-[#B4CCDC]">
            <E p="hero.sub">{hero.sub}</E>
          </p>

          {hero.frictionReducers.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-[9px]">
              {hero.frictionReducers.map((f, i) => (
                <span key={f} className="flex items-center gap-[7px] rounded-full bg-[rgba(255,255,255,0.08)] px-[14px] py-[7px] text-[13.5px] font-semibold text-[#CFE3F1]">
                  <E p={`hero.frictionReducers.${i}`}>{f}</E>
                </span>
              ))}
            </div>
          )}

          {/* The intake card — a real LeadForm, overlapping the panel seam. */}
          <div className="relative z-[3] mt-[30px] max-w-[470px] rounded-[20px] bg-bg p-6 shadow-[0_10px_24px_rgba(8,32,47,0.14),0_40px_70px_-30px_rgba(8,32,47,0.5)]">
            <div className="font-heading text-[19px] font-extrabold tracking-[-0.018em] text-ink">What&apos;s going on?</div>
            <p className="mt-1.5 text-[13.5px] text-inkSoft">Tell us the problem — a real person calls you back in minutes.</p>
            <LeadForm mode={mode} surface="light" className="mt-3.5" submitLabel="Get a callback now" />
            <a href={brand.phoneHref} className="mt-3 flex items-center justify-center gap-2 text-[13.5px] font-semibold text-inkSoft hover:text-ink">
              <Phone size={14} weight="fill" className="text-accent" aria-hidden="true" />
              Or call <E p="brand.phone">{brand.phone}</E>
            </a>
          </div>
        </div>
      </div>

      <div className="relative min-h-[300px] overflow-hidden lg:min-h-0">
        {slide && (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${imageAt(slide, 1536)})` }}
            role="img"
            aria-label={images.hero?.slides?.[0]?.alt ?? `${brand.name} plumbing work`}
          />
        )}
        <div
          className="absolute inset-0 hidden lg:block"
          aria-hidden="true"
          style={{ background: 'linear-gradient(90deg,rgba(14,42,61,.9),rgba(14,42,61,0) 42%)' }}
        />
      </div>
    </header>
  );
}
