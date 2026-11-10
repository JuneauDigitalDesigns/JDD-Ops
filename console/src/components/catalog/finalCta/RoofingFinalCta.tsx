'use client';
// ─────────────────────────────────────────────────────────────────────────────
// RoofingFinalCta — "structural / weatherproof" final CTA, premium pass (2026-11-09, approved
// mockup). A photo band under a dark left-to-right scrim with a SINGLE INLINE FORM ROW (name +
// phone/email + submit, side by side from sm up, stacked on a phone) — not HVAC's two-column
// layout-with-a-card. <LeadForm layout="row"> is exactly this treatment. mode stays
// plan-derived (D11): starter captures email, growth/enterprise captures phone so the Retell
// callback keeps working. Eyebrow with the accent-bar tick, headline up to 54px with the
// emphasis word in accent2, ✓ reducers under the form.
//
// Background photo: the schema has no dedicated finalCta/cta image slot, so this reuses a
// SECOND hero slide (images.hero.slides[1]) rather than inventing a new content field — the
// per-vertical image-placeholder curation already populates multiple hero slides for exactly
// this kind of reuse. Falls back to slide 0, then the hero portrait, so a single-slide client
// never renders with no photo at all (just visual repetition, never a blank band).
//
// Colours are palette tokens: ground and scrim are ink-panel, the hardcoded amber is now
// var(--accent-2) (the editable accent2 slot), greys on dark are on-ink-soft.
// ─────────────────────────────────────────────────────────────────────────────
import { CheckCircle } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { LeadForm } from '@/lib/LeadForm';
import { imageAt } from '@/lib/localImage';
import { serviceBySlug, serviceMessage } from '@/lib/serviceLinks';

export const meta = {
  id: 'roofing-final-cta',
  category: 'finalCta',
  label: 'Roofing / Photo-band final CTA',
  consumes: ['finalCta.eyebrow', 'finalCta.headline', 'finalCta.headlineEmphasis', 'finalCta.sub', 'finalCta.frictionReducers', 'images.hero.slides', 'services.items'],
  sharedDeps: ['@phosphor-icons/react', '@/lib/editable', '@/lib/LeadForm', '@/lib/localImage', '@/lib/serviceLinks'],
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
      <span className="text-[color:var(--accent-2)]">{emphasis}</span>
      {text.slice(i + emphasis.length)}
    </>
  );
}

export default function RoofingFinalCta({
  content = CONTENT,
  serviceSlug,
}: {
  content?: SiteContent;
  /** On a service page (wirePages and the Studio pass it): the form opens with "Service: {service}"
   *  in its message box, the page's only form (Xander 2026-11-10). */
  serviceSlug?: string;
}) {
  const { finalCta, images, _meta } = content;
  const service = serviceBySlug(content, serviceSlug);
  const mode = _meta?.selectedPlan === 'starter' ? 'email' : 'phone';
  const slide = images.hero?.slides?.[1]?.url ?? images.hero?.slides?.[0]?.url ?? images.hero?.portrait;

  return (
    // id="cta": the service page's "Ask for a quote" button (and the vertical's own "#cta" nav and
    // footer links) scroll here; until 2026-11-10 this section had no id, so those went nowhere.
    <section id="cta" className="relative isolate overflow-hidden bg-inkPanel py-16 text-onInk lg:py-24">
      {slide && (
        <div className="absolute inset-0 bg-cover bg-[center_35%]" style={{ backgroundImage: `url(${imageAt(slide, 1536)})` }} aria-hidden="true" />
      )}
      <div
        className="absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            'linear-gradient(90deg, color-mix(in srgb, var(--ink-panel) 95%, transparent), color-mix(in srgb, var(--ink-panel) 72%, transparent))',
        }}
      />

      <div className="relative mx-auto max-w-[1120px] px-5 sm:px-6">
        {finalCta.eyebrow && (
          <div className="flex items-center gap-2.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-[color:var(--accent-2)]">
            <span className="accent-bar !h-[3px] !w-7 !rounded-[2px]" aria-hidden="true" />
            <E p="finalCta.eyebrow">{finalCta.eyebrow}</E>
          </div>
        )}
        <h2 className="mt-3.5 max-w-[20ch] text-balance font-heading text-[clamp(32px,4.2vw,54px)] font-extrabold leading-[1.0] tracking-[-0.024em] text-onInk">
          <CtaHeadline text={finalCta.headline} emphasis={finalCta.headlineEmphasis} />
        </h2>
        <p className="mt-3.5 max-w-[52ch] text-[17px] leading-[1.65] text-onInkSoft">
          <E p="finalCta.sub">{finalCta.sub}</E>
        </p>

        <LeadForm
          mode={mode}
          surface="dark"
          layout="row"
          className="mt-[34px] max-w-[780px]"
          submitLabel="Book my inspection"
          {...(service ? { withMessage: true, initialMessage: serviceMessage(service) } : {})}
        />

        {finalCta.frictionReducers.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
            {finalCta.frictionReducers.map((f, i) => (
              <span key={f} className="flex items-center gap-2 text-[13px] font-semibold text-onInkSoft">
                <CheckCircle size={15} weight="fill" className="text-[color:var(--accent-2)]" aria-hidden="true" />
                <E p={`finalCta.frictionReducers.${i}`}>{f}</E>
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
