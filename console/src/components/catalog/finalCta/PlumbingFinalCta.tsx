'use client';
// ─────────────────────────────────────────────────────────────────────────────
// PlumbingFinalCta — the signature ACCENT-BLUE band (not navy — this template has no navy at all
// until the footer), mirrored 1:1 (#plumbing .band-cta/.cta-form). Same two-column shape as
// HvacFinalCta (pitch left, white LeadForm card right), with the gradient and emphasis colour
// swapped to plumbing's own accent blue. Fixed design, no skin.
// ─────────────────────────────────────────────────────────────────────────────
import { CheckCircle } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { LeadForm } from '@/lib/LeadForm';

function CtaHeadline({ text, emphasis }: { text: string; emphasis: string | null }) {
  if (!emphasis) return <>{text}</>;
  const i = text.indexOf(emphasis);
  if (i === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <span className="text-[#9FDCFF]">{emphasis}</span>
      {text.slice(i + emphasis.length)}
    </>
  );
}

export const meta = {
  id: 'plumbing-final-cta',
  category: 'finalCta',
  label: 'Plumbing / Accent-band final CTA',
  consumes: ['finalCta.eyebrow', 'finalCta.headline', 'finalCta.headlineEmphasis', 'finalCta.sub', 'finalCta.cta', 'finalCta.frictionReducers'],
  sharedDeps: ['@phosphor-icons/react', '@/lib/editable', '@/lib/LeadForm'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

export default function PlumbingFinalCta({ content = CONTENT }: { content?: SiteContent }) {
  const { finalCta, _meta } = content;
  const mode = _meta?.selectedPlan === 'starter' ? 'email' : 'phone';

  return (
    <section
      className="relative isolate overflow-hidden py-[84px] text-[#EAF4FB]"
      style={{
        background:
          'radial-gradient(900px 340px at 12% -20%, rgba(255,255,255,.16), transparent 62%),' +
          'linear-gradient(135deg,#2378B3,#13496D)',
      }}
    >
      <div className="mx-auto grid max-w-[1160px] items-center gap-12 px-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          {finalCta.eyebrow && (
            <div className="text-[12px] font-bold uppercase tracking-[0.15em] text-[#9FDCFF]">
              <E p="finalCta.eyebrow">{finalCta.eyebrow}</E>
            </div>
          )}
          <h2 className="mt-3 font-heading text-[clamp(30px,3.6vw,44px)] font-extrabold leading-[1.05] tracking-[-0.02em] text-[#fff]">
            <CtaHeadline text={finalCta.headline} emphasis={finalCta.headlineEmphasis} />
          </h2>
          <p className="mt-3.5 max-w-[46ch] text-[17px] leading-[1.6] text-[#C6DEEE]">
            <E p="finalCta.sub">{finalCta.sub}</E>
          </p>
          {finalCta.frictionReducers.length > 0 && (
            <div className="mt-[22px] flex flex-wrap gap-x-5 gap-y-[10px]">
              {finalCta.frictionReducers.map((f, i) => (
                <span key={f} className="flex items-center gap-2 text-[14.5px] font-semibold text-[#DCEDF8]">
                  <CheckCircle size={18} weight="fill" className="text-[#9FDCFF]" aria-hidden="true" />
                  <E p={`finalCta.frictionReducers.${i}`}>{f}</E>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-[22px] bg-bg p-[30px] shadow-[0_30px_60px_-24px_rgba(8,32,47,0.6)]">
          <h3 className="font-heading text-[21px] font-extrabold tracking-[-0.02em] text-ink">
            <E p="finalCta.cta">{finalCta.cta}</E>
          </h3>
          <p className="mt-1.5 text-[13.5px] text-inkSoft">Tell us what&apos;s going on — we&apos;ll call you right back.</p>
          <LeadForm mode={mode} surface="light" className="mt-3.5" submitLabel={<E p="finalCta.cta">{finalCta.cta}</E>} />
        </div>
      </div>
    </section>
  );
}
