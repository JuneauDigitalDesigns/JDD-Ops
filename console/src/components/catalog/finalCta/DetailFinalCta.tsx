'use client';
// ─────────────────────────────────────────────────────────────────────────────
// DetailFinalCta — the ONE LIGHT band on an otherwise all-dark page, mirrored 1:1 (#detail
// .band-cta/.cta-form). Deliberately does NOT use the ink/bg Tailwind tokens that resolve dark
// for this vertical — it inverts on purpose (the mockup calls the inversion "the punch"), so the
// light background and the dark form card are both literal hex, matching the mockup's own
// `--light`/`--near-black` tokens rather than the page's palette. Fixed design, no skin.
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
      <span style={{ color: '#8A6A26' }}>{emphasis}</span>
      {text.slice(i + emphasis.length)}
    </>
  );
}

export const meta = {
  id: 'detail-final-cta',
  category: 'finalCta',
  label: 'Car Detailing / Inverted light band',
  consumes: ['finalCta.eyebrow', 'finalCta.headline', 'finalCta.headlineEmphasis', 'finalCta.sub', 'finalCta.cta', 'finalCta.frictionReducers'],
  sharedDeps: ['@phosphor-icons/react', '@/lib/editable', '@/lib/LeadForm'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

export default function DetailFinalCta({ content = CONTENT }: { content?: SiteContent }) {
  const { finalCta, _meta } = content;
  const mode = _meta?.selectedPlan === 'starter' ? 'email' : 'phone';

  return (
    <section className="py-[92px]" style={{ background: '#F4F2EE', color: '#171922' }}>
      <div className="mx-auto grid max-w-[1180px] items-center gap-12 px-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          {finalCta.eyebrow && (
            <div className="text-[11.5px] font-bold uppercase tracking-[0.26em]" style={{ color: '#8A6A26' }}>
              <E p="finalCta.eyebrow">{finalCta.eyebrow}</E>
            </div>
          )}
          <h2 className="mt-3.5 font-heading text-[clamp(30px,3.6vw,46px)] font-extrabold leading-[1.04]" style={{ color: '#171922' }}>
            <CtaHeadline text={finalCta.headline} emphasis={finalCta.headlineEmphasis} />
          </h2>
          <p className="mt-3.5 max-w-[46ch] text-[17px] leading-[1.6]" style={{ color: '#55596A' }}>
            <E p="finalCta.sub">{finalCta.sub}</E>
          </p>
          {finalCta.frictionReducers.length > 0 && (
            <div className="mt-[22px] flex flex-wrap gap-x-[22px] gap-y-[10px]">
              {finalCta.frictionReducers.map((f, i) => (
                <span key={f} className="flex items-center gap-2 text-[14.5px] font-semibold" style={{ color: '#3D4152' }}>
                  <CheckCircle size={18} weight="fill" style={{ color: '#8A6A26' }} aria-hidden="true" />
                  <E p={`finalCta.frictionReducers.${i}`}>{f}</E>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-[14px] p-[30px]" style={{ background: '#08090C', border: '1px solid #23262F' }}>
          <h3 className="font-heading text-[21px] font-extrabold tracking-[-0.02em] text-[#fff]">
            <E p="finalCta.cta">{finalCta.cta}</E>
          </h3>
          <p className="mt-1.5 text-[13.5px]" style={{ color: '#A3ADBC' }}>Tell us what&apos;s going on — we&apos;ll call you right back.</p>
          <LeadForm mode={mode} surface="dark" className="mt-3.5" submitLabel={<E p="finalCta.cta">{finalCta.cta}</E>} />
        </div>
      </div>
    </section>
  );
}
