'use client';
// ─────────────────────────────────────────────────────────────────────────────
// DetailFinalCta — the ONE LIGHT band on an otherwise all-dark page, premium pass (2026-11-09,
// approved mockup). It inverts on purpose (the mockup calls the inversion "the punch"): a light
// ground with dark-gold eyebrow, emphasis and check icons, copy on the left, and the dark form
// card on the right (stacked below lg). The card keeps surface="dark".
//
// Colours are palette tokens, expressed as the light inverse of this dark palette rather than
// literal hex: the ground is ink with a touch of accent, the text is bg, the sub and reducers are
// bg eased toward ink, dark gold is the accent pulled toward black. The card is ink-panel with the
// rule as its border, so a brand or per-section palette reaches the whole band.
//
// On a service page (Xander 2026-11-10) wirePages passes serviceSlug and the form opens with
// "Service: {service}" in its message box. The band is id="cta", the target of the service page's
// "Ask for a quote" button (as HvacFinalCta).
// ─────────────────────────────────────────────────────────────────────────────
import { CheckCircle } from '@phosphor-icons/react';
import { CONTENT, type SiteContent } from '@/data/site';
import { E } from '@/lib/editable';
import { LeadForm } from '@/lib/LeadForm';
import { serviceBySlug, serviceMessage } from '@/lib/serviceLinks';

/** Dark gold: legible as text on the light band, where the champagne accent is not. */
const DARK_GOLD = 'color-mix(in srgb, var(--accent) 65%, black)';
const GOLD_BAR = `linear-gradient(90deg, var(--accent), ${DARK_GOLD} 60%, transparent)`;

function CtaHeadline({ text, emphasis }: { text: string; emphasis: string | null }) {
  if (!emphasis) return <>{text}</>;
  const i = text.indexOf(emphasis);
  if (i === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <span style={{ color: DARK_GOLD }}>{emphasis}</span>
      {text.slice(i + emphasis.length)}
    </>
  );
}

export const meta = {
  id: 'detail-final-cta',
  category: 'finalCta',
  label: 'Car Detailing / Inverted light band',
  consumes: ['finalCta.eyebrow', 'finalCta.headline', 'finalCta.headlineEmphasis', 'finalCta.sub', 'finalCta.cta', 'finalCta.frictionReducers'],
  sharedDeps: ['@phosphor-icons/react', '@/lib/editable', '@/lib/LeadForm', '@/lib/serviceLinks'],
  signature: false,
  verticalTemplate: true, // bespoke vertical-template component; exempt from anti-slop heuristics
} as const;

export default function DetailFinalCta({
  content = CONTENT,
  serviceSlug,
}: {
  content?: SiteContent;
  /** On a service page (wirePages and the Studio pass it): the form opens with "Service: {service}"
   *  in its message box, the page's only form (Xander 2026-11-10). */
  serviceSlug?: string;
}) {
  const { finalCta, _meta } = content;
  const service = serviceBySlug(content, serviceSlug);
  const mode = _meta?.selectedPlan === 'starter' ? 'email' : 'phone';

  return (
    <section
      id="cta"
      className="py-16 sm:py-24"
      style={{ background: 'color-mix(in srgb, var(--ink) 94%, var(--accent) 6%)', color: 'var(--bg)' }}
    >
      <div className="mx-auto grid max-w-[1120px] items-center gap-10 px-5 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12">
        <div>
          {finalCta.eyebrow && (
            <div className="flex items-center gap-2.5 text-[11.5px] font-semibold uppercase leading-none tracking-[0.26em]" style={{ color: DARK_GOLD }}>
              <span className="h-[3px] w-7 shrink-0 rounded-sm" style={{ background: GOLD_BAR }} aria-hidden="true" />
              <E p="finalCta.eyebrow">{finalCta.eyebrow}</E>
            </div>
          )}
          <h2 className="mt-3.5 font-heading text-[clamp(32px,3.8vw,48px)] font-extrabold leading-[1.04] tracking-[-0.016em]" style={{ color: 'var(--bg)' }}>
            <CtaHeadline text={finalCta.headline} emphasis={finalCta.headlineEmphasis} />
          </h2>
          <p className="mt-3.5 max-w-[52ch] text-[17px] leading-[1.65]" style={{ color: 'color-mix(in srgb, var(--bg) 70%, var(--ink))' }}>
            <E p="finalCta.sub">{finalCta.sub}</E>
          </p>
          {finalCta.frictionReducers.length > 0 && (
            <div className="mt-[22px] flex flex-wrap gap-x-[22px] gap-y-[10px]">
              {finalCta.frictionReducers.map((f, i) => (
                <span key={f} className="flex items-center gap-[9px] text-[14.5px] font-semibold leading-[1.3]" style={{ color: 'color-mix(in srgb, var(--bg) 82%, var(--ink))' }}>
                  <CheckCircle size={18} weight="fill" className="shrink-0" style={{ color: DARK_GOLD }} aria-hidden="true" />
                  <E p={`finalCta.frictionReducers.${i}`}>{f}</E>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-[12px] border border-rule bg-inkPanel p-6 text-onInk sm:p-7">
          <h3 className="font-heading text-[21px] font-extrabold tracking-[-0.02em] text-onInk">
            <E p="finalCta.cta">{finalCta.cta}</E>
          </h3>
          <p className="mt-1.5 text-[13.5px] leading-[1.5] text-onInkSoft">Tell us what&apos;s going on — we&apos;ll call you right back.</p>
          <LeadForm
            mode={mode}
            surface="dark"
            className="mt-3.5"
            submitLabel={<E p="finalCta.cta">{finalCta.cta}</E>}
            {...(service ? { withMessage: true, initialMessage: serviceMessage(service) } : {})}
          />
        </div>
      </div>
    </section>
  );
}
