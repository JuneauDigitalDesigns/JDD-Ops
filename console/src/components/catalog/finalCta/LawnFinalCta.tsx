'use client';
// ─────────────────────────────────────────────────────────────────────────────
// LawnFinalCta — "seasonal / organic / airy" final CTA, premium pass (2026-11-09, approved
// mockup). The forest band (ink-panel-2 → ink-panel, a faint sun glow top-right) with the pitch
// on the left — sun eyebrow with a short accent-bar, display heading whose emphasis is sun, lede,
// ✓ reducers — and a white form card on the right carrying the OFFER RIBBON: client-supplied
// (extensions.offerBadge, D10), never invented. A promotional promise to the client's own
// customers, collected at onboarding from a short per-vertical pick list plus free text; absent
// -> the ribbon is simply not rendered (D5), never a default.
// mode stays plan-derived (D11): starter captures email, growth/enterprise captures phone so
// the Retell callback keeps working.
//
// Every colour is a palette token: forest = ink-panel(-2), light text = on-ink / on-ink-soft, the
// sun gold (eyebrow, emphasis, ✓ icons, ribbon) = the editable accent2 slot, with the ribbon's
// label on --accent-2-fg so it stays readable whatever accent2 a client picks. Literal rgba()
// values left are shadow alphas only. Fixed design, no skin.
// ─────────────────────────────────────────────────────────────────────────────
import { CheckCircle } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { LeadForm } from '@/lib/LeadForm';

export const meta = {
  id: 'lawn-final-cta',
  category: 'finalCta',
  label: 'Lawn / Offer-ribbon final CTA',
  consumes: ['finalCta.eyebrow', 'finalCta.headline', 'finalCta.headlineEmphasis', 'finalCta.sub', 'finalCta.cta', 'finalCta.frictionReducers', 'extensions.offerBadge'],
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
      <span className="text-[color:var(--accent-2)]">{emphasis}</span>
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
      className="relative isolate overflow-hidden bg-inkPanel py-16 text-onInk lg:py-24"
      style={{
        background:
          'radial-gradient(900px 340px at 88% -16%, color-mix(in srgb, var(--accent-2) 14%, transparent), transparent 62%),' +
          'linear-gradient(180deg, var(--ink-panel-2), var(--ink-panel))',
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
          <h2 className="mt-3.5 font-heading text-[clamp(32px,3.8vw,48px)] font-extrabold leading-[1.04] tracking-[-0.02em] text-onInk">
            <CtaHeadline text={finalCta.headline} emphasis={finalCta.headlineEmphasis} />
          </h2>
          <p className="mt-3.5 max-w-[48ch] text-[17px] leading-[1.65] text-onInkSoft">
            <E p="finalCta.sub">{finalCta.sub}</E>
          </p>
          {finalCta.frictionReducers.length > 0 && (
            <div className="mt-[22px] flex flex-wrap gap-x-5 gap-y-2">
              {finalCta.frictionReducers.map((f, i) => (
                <span key={f} className="flex items-center gap-2 text-[14.5px] font-semibold text-onInk">
                  <CheckCircle size={18} weight="fill" className="shrink-0 text-[color:var(--accent-2)]" aria-hidden="true" />
                  <E p={`finalCta.frictionReducers.${i}`}>{f}</E>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="relative rounded-[22px] bg-bg p-6 text-ink shadow-[0_30px_60px_-24px_rgba(0,0,0,0.55)] sm:p-7">
          {offerBadge && (
            <span
              className="absolute -top-[14px] right-[22px] max-w-[calc(100%-44px)] rounded-full bg-[color:var(--accent-2)] px-[15px] py-[7px] text-[12px] font-extrabold uppercase leading-[1.15] tracking-[0.05em] text-[color:var(--accent-2-fg)] shadow-[0_8px_20px_-8px_rgba(0,0,0,0.4)]"
            >
              <E p="extensions.offerBadge">{offerBadge}</E>
            </span>
          )}
          <h3 className="font-heading text-[22px] font-extrabold tracking-[-0.02em] text-ink">
            <E p="finalCta.cta">{finalCta.cta}</E>
          </h3>
          <p className="mt-1.5 text-[14px] text-inkSoft">We&rsquo;ll call with a flat quote &mdash; usually same day.</p>
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
