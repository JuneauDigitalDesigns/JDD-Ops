'use client';
// ─────────────────────────────────────────────────────────────────────────────
// LawnFinalCta — "seasonal / organic / airy" final CTA, mirrored 1:1 (#lawn .band-cta /
// .cta-form / .ribbon). Forest band + white form card with a gold OFFER RIBBON — client-
// supplied (extensions.offerBadge, D10), never invented. A promotional promise to the client's
// own customers, collected at onboarding from a short per-vertical pick list plus free text;
// absent -> the ribbon is simply not rendered (D5), never a default like "First mow free".
// mode stays plan-derived (D11): starter captures email, growth/enterprise captures phone so
// the Retell callback keeps working. Fixed design, no skin.
// ─────────────────────────────────────────────────────────────────────────────
import { CheckCircle } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { LeadForm } from '@/lib/LeadForm';

export const meta = {
  id: 'lawn-final-cta',
  category: 'finalCta',
  label: 'Lawn / Offer-ribbon final CTA',
  consumes: ['finalCta.eyebrow', 'finalCta.headline', 'finalCta.headlineEmphasis', 'finalCta.sub', 'finalCta.frictionReducers', 'extensions.offerBadge'],
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
      <span className="text-[#E8B33A]">{emphasis}</span>
      {text.slice(i + emphasis.length)}
    </>
  );
}

export default function LawnFinalCta({ content = CONTENT }: { content?: SiteContent }) {
  const { finalCta, extensions, _meta } = content;
  const mode = _meta?.selectedPlan === 'starter' ? 'email' : 'phone';
  const offerBadge = extensions.offerBadge?.trim();

  return (
    <section
      className="relative isolate overflow-hidden py-[92px] text-[#DCE8DB]"
      style={{
        background:
          'radial-gradient(900px 340px at 88% -16%, rgba(232,179,58,0.14), transparent 62%),' +
          'linear-gradient(180deg,#1E4028,#14301C)',
      }}
    >
      <div className="mx-auto grid max-w-[1140px] items-center gap-12 px-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          {finalCta.eyebrow && (
            <div className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#E8B33A]">
              <E p="finalCta.eyebrow">{finalCta.eyebrow}</E>
            </div>
          )}
          <h2 className="mt-3 font-heading text-[clamp(30px,3.6vw,44px)] font-extrabold leading-[1.06] text-[#fff]">
            <CtaHeadline text={finalCta.headline} emphasis={finalCta.headlineEmphasis} />
          </h2>
          <p className="mt-3.5 max-w-[48ch] text-[17px] leading-[1.6] text-[#BACCB9]">
            <E p="finalCta.sub">{finalCta.sub}</E>
          </p>
          {finalCta.frictionReducers.length > 0 && (
            <div className="mt-[22px] flex flex-wrap gap-x-5 gap-y-2">
              {finalCta.frictionReducers.map((f, i) => (
                <span key={f} className="flex items-center gap-2 text-[14.5px] font-semibold text-[#D3E0D2]">
                  <CheckCircle size={18} weight="fill" className="text-[#E8B33A]" aria-hidden="true" />
                  <E p={`finalCta.frictionReducers.${i}`}>{f}</E>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="relative rounded-[26px] bg-bg p-[30px] shadow-[0_30px_60px_-24px_rgba(14,38,20,0.6)]">
          {offerBadge && (
            <span className="absolute -top-[14px] right-[22px] rounded-full bg-[#E8B33A] px-[15px] py-[7px] text-[12px] font-extrabold uppercase tracking-[0.05em] text-[#2A1F04]">
              <E p="extensions.offerBadge">{offerBadge}</E>
            </span>
          )}
          <h3 className="font-heading text-[21px] font-extrabold tracking-[-0.02em] text-ink">
            <E p="finalCta.cta">{finalCta.cta}</E>
          </h3>
          <p className="mt-1.5 text-[13.5px] text-inkSoft">We&rsquo;ll call with a flat quote &mdash; usually same day.</p>
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
