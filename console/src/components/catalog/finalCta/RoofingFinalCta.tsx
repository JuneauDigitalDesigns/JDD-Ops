'use client';
// ─────────────────────────────────────────────────────────────────────────────
// RoofingFinalCta — "structural / weatherproof" final CTA, mirrored 1:1 (#roofing .ctaband).
// A photo band under a dark bitumen scrim with a SINGLE INLINE FORM ROW (name + phone/email +
// submit, side by side from sm up) — not HVAC's two-column layout-with-a-card. <LeadForm
// layout="row"> is exactly this treatment. mode stays plan-derived (D11): starter captures
// email, growth/enterprise captures phone so the Retell callback keeps working.
//
// Background photo: the schema has no dedicated finalCta/cta image slot, so this reuses a
// SECOND hero slide (images.hero.slides[1]) rather than inventing a new content field — the
// per-vertical image-placeholder curation already populates multiple hero slides for exactly
// this kind of reuse. Falls back to slide 0, then the hero portrait, so a single-slide client
// never renders with no photo at all (just visual repetition, never a blank band).
// Fixed design, no skin.
// ─────────────────────────────────────────────────────────────────────────────
import { CheckCircle } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { LeadForm } from '@/lib/LeadForm';

export const meta = {
  id: 'roofing-final-cta',
  category: 'finalCta',
  label: 'Roofing / Photo-band final CTA',
  consumes: ['finalCta.eyebrow', 'finalCta.headline', 'finalCta.headlineEmphasis', 'finalCta.sub', 'finalCta.frictionReducers', 'images.hero.slides'],
  sharedDeps: ['@phosphor-icons/react', '@/lib/editable', '@/lib/LeadForm'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

function CtaHeadline({ text, emphasis }: { text: string; emphasis: string | null }) {
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

export default function RoofingFinalCta({ content = CONTENT }: { content?: SiteContent }) {
  const { finalCta, images, _meta } = content;
  const mode = _meta?.selectedPlan === 'starter' ? 'email' : 'phone';
  const slide = images.hero?.slides?.[1]?.url ?? images.hero?.slides?.[0]?.url ?? images.hero?.portrait;

  return (
    <section className="relative isolate overflow-hidden bg-[#17110F] py-20">
      {slide && (
        <div className="absolute inset-0 bg-cover bg-[center_35%]" style={{ backgroundImage: `url(${slide})` }} aria-hidden="true" />
      )}
      <div
        className="absolute inset-0"
        aria-hidden="true"
        style={{ background: 'linear-gradient(90deg,rgba(23,17,15,.95),rgba(23,17,15,.72))' }}
      />

      <div className="relative mx-auto max-w-[1160px] px-6">
        {finalCta.eyebrow && (
          <div className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#E8A33D]">
            <E p="finalCta.eyebrow">{finalCta.eyebrow}</E>
          </div>
        )}
        <h2 className="mt-3.5 max-w-[20ch] font-heading text-[clamp(32px,4vw,50px)] font-extrabold leading-[1.0] tracking-[-0.024em] text-[#fff]">
          <CtaHeadline text={finalCta.headline} emphasis={finalCta.headlineEmphasis} />
        </h2>
        <p className="mt-4 max-w-[52ch] text-[17px] leading-[1.6] text-[#D6C9C0]">
          <E p="finalCta.sub">{finalCta.sub}</E>
        </p>

        <LeadForm
          mode={mode}
          surface="dark"
          layout="row"
          className="mt-[34px] max-w-[780px]"
          submitLabel="Book my free inspection"
        />

        {finalCta.frictionReducers.length > 0 && (
          <div className="mt-[18px] flex flex-wrap gap-x-5 gap-y-2">
            {finalCta.frictionReducers.map((f, i) => (
              <span key={f} className="flex items-center gap-2 text-[13px] font-semibold text-[#AFA096]">
                <CheckCircle size={15} weight="fill" className="text-[#E8A33D]" aria-hidden="true" />
                <E p={`finalCta.frictionReducers.${i}`}>{f}</E>
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
