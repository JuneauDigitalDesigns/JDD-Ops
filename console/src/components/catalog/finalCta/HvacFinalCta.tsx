'use client';
// ─────────────────────────────────────────────────────────────────────────────
// HvacFinalCta — Northstar "Home — Standard" final CTA, from the approved mockup.
// The signature navy band (steel radial glow) with the pitch on the left and a white
// lead-CAPTURE form on the right. The form is the shared <LeadForm>, so it POSTs
// {name, phone|email} to /api/contact exactly as onboard.js's provisioned contact route
// expects (Resend email for starter / Retell callback for growth+enterprise) — provisioning
// keeps working on the exported client site. Reads finalCta.* + brand phone. Fixed design, no skin.
// ─────────────────────────────────────────────────────────────────────────────
import { CheckCircle } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { LeadForm } from '@/lib/LeadForm';

/** Headline with an optional gold-accent emphasis phrase, matching `.cta-grid h2 .em`. */
function CtaHeadline({ text, emphasis }: { text: string; emphasis: string | null }) {
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

export const meta = {
  id: 'hvac-final-cta',
  category: 'finalCta',
  label: 'HVAC / Final CTA',
  consumes: ['finalCta.eyebrow', 'finalCta.headline', 'finalCta.sub', 'finalCta.cta', 'finalCta.frictionReducers'],
  sharedDeps: ['@phosphor-icons/react', '@/lib/editable', '@/lib/LeadForm'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

export default function HvacFinalCta({ content = CONTENT }: { content?: SiteContent }) {
  const { finalCta, _meta } = content;
  // Lead mode follows the plan, same as the hero/<LeadForm> pattern: starter captures by email,
  // growth/enterprise by phone callback. The provisioned /api/contact route honors the matching
  // LEAD_DELIVERY_MODE, so the posted field (email vs phone) lines up with delivery.
  const mode = _meta?.selectedPlan === 'starter' ? 'email' : 'phone';

  return (
    <section
      id="cta"
      className="relative isolate overflow-hidden py-[84px] text-[#EAF1F8]"
      style={{
        background:
          'radial-gradient(1100px 380px at 85% -10%, rgba(143,178,217,0.12), transparent 60%),' +
          'linear-gradient(180deg,#12263F,#0D1D31)',
      }}
    >
      <div className="mx-auto grid max-w-[1120px] items-center gap-12 px-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          {finalCta.eyebrow && (
            <div className="text-[12.5px] font-bold uppercase tracking-[0.17em] text-[#8FB2D9]">
              <E p="finalCta.eyebrow">{finalCta.eyebrow}</E>
            </div>
          )}
          <h2 className="mt-3 font-heading text-[clamp(30px,3.6vw,44px)] font-semibold leading-[1.05] text-[#fff]">
            <CtaHeadline text={finalCta.headline} emphasis={finalCta.headlineEmphasis} />
          </h2>
          <p className="mt-3.5 max-w-[46ch] text-[17px] leading-[1.65] text-[#B9C6D6]">
            <E p="finalCta.sub">{finalCta.sub}</E>
          </p>
          {finalCta.frictionReducers.length > 0 && (
            <div className="mt-[22px] flex flex-wrap gap-x-[22px] gap-y-[10px]">
              {finalCta.frictionReducers.map((f, i) => (
                <span key={f} className="flex items-center gap-2 text-[14.5px] font-semibold text-[#DDE6EF]">
                  <CheckCircle size={18} weight="fill" className="text-[#F6B54A]" aria-hidden="true" />
                  <E p={`finalCta.frictionReducers.${i}`}>{f}</E>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* White capture card — the shared LeadForm owns the POST to /api/contact. */}
        <div className="rounded-[18px] bg-bg p-[28px] shadow-[0_4px_10px_rgba(19,41,63,0.08),0_26px_50px_-16px_rgba(19,41,63,0.30)]">
          <h3 className="font-heading text-[22px] font-semibold text-ink">
            <E p="finalCta.cta">{finalCta.cta}</E>
          </h3>
          <p className="mt-1.5 text-[14px] text-inkSoft">Tell us what&rsquo;s going on — we&rsquo;ll call you right back.</p>
          <LeadForm
            mode={mode}
            surface="light"
            className="mt-3.5"
            submitLabel={<E p="finalCta.cta">{finalCta.cta}</E>}
          />
        </div>
      </div>
    </section>
  );
}
