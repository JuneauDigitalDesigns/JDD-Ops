'use client';
// ─────────────────────────────────────────────────────────────────────────────
// PlumbingFinalCta — the signature ACCENT-BLUE band (not navy — that's the hero and the footer),
// premium pass (2026-11-09, approved mockup). Same two-column shape as HvacFinalCta (pitch left,
// white LeadForm card right; stacked on a phone): eyebrow on its accent-bar, the headline with its
// emphasis in the editable accent2 light blue, the sub, the ✓ reducers, then the capture card.
//
// Colours: every one is a palette token. The band is built from --accent (a lighter mix at the
// top-left into a mix with --ink-panel at the bottom-right, under a soft white highlight), so a
// client's own accent re-tints it; light text is on-ink, emphasis and checks are accent2.
// Fixed design, no skin.
// ─────────────────────────────────────────────────────────────────────────────
import { CheckCircle } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { LeadForm } from '@/lib/LeadForm';

/** Headline with an optional emphasis phrase in the editable accent2, matching `.pl-cta h2 .em`. */
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
      className="relative isolate overflow-hidden py-16 text-onInk lg:py-24"
      style={{
        background:
          'radial-gradient(900px 340px at 12% -20%, color-mix(in srgb, var(--on-ink) 16%, transparent), transparent 62%),' +
          'linear-gradient(135deg, color-mix(in srgb, var(--accent) 92%, var(--on-ink)), color-mix(in srgb, var(--accent) 55%, var(--ink-panel)))',
      }}
    >
      <div className="mx-auto grid max-w-[1120px] items-center gap-10 px-5 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12">
        <div>
          {finalCta.eyebrow && (
            <div className="flex items-center gap-2.5 text-[12px] font-bold uppercase tracking-[0.14em] text-[color:var(--accent-2)]">
              <span className="accent-bar !h-[3px] !w-7" aria-hidden="true" />
              <E p="finalCta.eyebrow">{finalCta.eyebrow}</E>
            </div>
          )}
          <h2 className="mt-3.5 font-heading text-[clamp(32px,3.8vw,48px)] font-extrabold leading-[1.02] tracking-[-0.02em] text-onInk">
            <CtaHeadline text={finalCta.headline} emphasis={finalCta.headlineEmphasis} />
          </h2>
          <p className="mt-3.5 max-w-[46ch] text-[17px] leading-[1.65] text-onInkSoft">
            <E p="finalCta.sub">{finalCta.sub}</E>
          </p>
          {finalCta.frictionReducers.length > 0 && (
            <div className="mt-[22px] flex flex-wrap gap-x-5 gap-y-[10px]">
              {finalCta.frictionReducers.map((f, i) => (
                <span key={f} className="flex items-center gap-2 text-[14.5px] font-semibold text-onInk">
                  <CheckCircle size={18} weight="fill" className="shrink-0 text-[color:var(--accent-2)]" aria-hidden="true" />
                  <E p={`finalCta.frictionReducers.${i}`}>{f}</E>
                </span>
              ))}
            </div>
          )}
        </div>

        <div
          className="rounded-[20px] bg-bg p-6 text-ink sm:p-7"
          style={{
            boxShadow:
              '0 4px 10px color-mix(in srgb, var(--ink-panel) 12%, transparent), 0 30px 60px -24px color-mix(in srgb, var(--ink-panel) 60%, transparent)',
          }}
        >
          <h3 className="font-heading text-[22px] font-extrabold tracking-[-0.02em] text-ink">
            <E p="finalCta.cta">{finalCta.cta}</E>
          </h3>
          <p className="mt-1.5 text-[14px] text-inkSoft">Tell us what&apos;s going on — we&apos;ll call you right back.</p>
          <LeadForm mode={mode} surface="light" className="mt-3.5" submitLabel={<E p="finalCta.cta">{finalCta.cta}</E>} />
        </div>
      </div>
    </section>
  );
}
